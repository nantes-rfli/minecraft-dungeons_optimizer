"""Short synthetic processes only; no game files or Unicorn installation needed."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from native_watchdog import supervise
import run_continuous_self_file as runner


SCRIPTS = Path(__file__).resolve().parent


def python(code):
    return [sys.executable, "-B", "-c", code]


def alive(pid):
    result = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)],
                            capture_output=True, text=True, timeout=2)
    return bool(result.stdout.strip()) and not result.stdout.strip().startswith("Z")


class WatchdogTests(unittest.TestCase):
    def test_normal_exit_preserves_result_and_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            result_path = Path(directory) / "result.json"
            code = f"from pathlib import Path; Path({str(result_path)!r}).write_text('preserved'); print('worker-output', flush=True)"
            parent = python(f"import json; from native_watchdog import supervise; print(json.dumps(supervise({python(code)!r}, 2)))")
            completed = subprocess.run(parent, cwd=SCRIPTS, capture_output=True, text=True, timeout=5)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("worker-output", completed.stdout)
            result = json.loads(completed.stdout.splitlines()[-1])
            self.assertEqual(result["status"], "exited")
            self.assertEqual(result["returncode"], 0)
            self.assertFalse(result["forcedKill"])
            self.assertTrue(result["cleanupComplete"])
            self.assertEqual(result_path.read_text(), "preserved")

    def test_deadline_terminates_sleeping_child(self):
        result = supervise(python("import time; time.sleep(60)"), .3,
                           terminate_grace=.2, kill_grace=.2)
        self.assertEqual(result["status"], "timed-out")
        self.assertEqual(result["returncode"], -signal.SIGTERM)
        self.assertFalse(result["forcedKill"])
        self.assertTrue(result["cleanupComplete"])
        self.assertLess(result["elapsedSeconds"], 2)

    def test_ignored_termination_is_forcibly_killed(self):
        result = supervise(python("import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)"),
                           .4, terminate_grace=.15, kill_grace=.2)
        self.assertEqual(result["status"], "timed-out")
        self.assertEqual(result["returncode"], -signal.SIGKILL)
        self.assertTrue(result["forcedKill"])
        self.assertTrue(result["cleanupComplete"])
        self.assertLess(result["elapsedSeconds"], 2)

    def test_crash_is_not_success(self):
        for code in ("import os; os._exit(7)", "import os,signal; os.kill(os.getpid(), signal.SIGKILL)"):
            with self.subTest(code=code):
                result = supervise(python(code), 2)
                self.assertEqual(result["status"], "failed")
                self.assertNotEqual(result["returncode"], 0)

    def test_invalid_budgets_never_spawn(self):
        for seconds in (0, -1, float("inf"), float("nan")):
            with self.subTest(seconds=seconds), patch("native_watchdog.subprocess.Popen") as spawn:
                with self.assertRaises(ValueError):
                    supervise(python("pass"), seconds)
                spawn.assert_not_called()

    def test_cleanup_wait_is_bounded_even_if_group_remains(self):
        # Model an unkillable OS task without leaving a real unkillable process.
        with patch("native_watchdog._group_exists", return_value=True):
            result = supervise(python("pass"), 1, terminate_grace=.05, kill_grace=.05)
        self.assertFalse(result["cleanupComplete"])
        self.assertTrue(result["forcedKill"])
        self.assertLess(result["elapsedSeconds"], 2)

    def test_spawn_failure_restores_parent_signal_handlers(self):
        before = {s: signal.getsignal(s) for s in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
        with self.assertRaises(FileNotFoundError):
            supervise(["/nonexistent/native-watchdog-synthetic"], 1)
        self.assertEqual(before, {s: signal.getsignal(s) for s in before})

    def test_denied_cleanup_probe_is_not_confirmation(self):
        from native_watchdog import _group_exists
        with patch("native_watchdog.os.killpg", side_effect=PermissionError):
            self.assertTrue(_group_exists(12345))

    def test_denied_group_signals_still_kill_and_reap_owned_child(self):
        with patch("native_watchdog.os.killpg", side_effect=PermissionError):
            result = supervise(python("import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)"),
                               .4, terminate_grace=.1, kill_grace=.1)
        self.assertEqual(result["returncode"], -signal.SIGKILL)
        self.assertFalse(result["cleanupComplete"])
        self.assertTrue(result["forcedKill"])
        self.assertLess(result["elapsedSeconds"], 2)

    def check_tree_cleanup(self, signum=None, leader_exits=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            grandchild = ("import os,signal,time; from pathlib import Path; "
                          "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
                          f"Path({str(root / 'grandchild')!r}).write_text(str(os.getpid())); time.sleep(60)")
            worker = ("import os,signal,subprocess,time; from pathlib import Path; "
                      "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
                      f"Path({str(root / 'child')!r}).write_text(str(os.getpid())); "
                      f"p=subprocess.Popen({python(grandchild)!r}); "
                      + ("time.sleep(.2)" if leader_exits else "time.sleep(60)"))
            parent = subprocess.Popen(python(
                "import json; from pathlib import Path; from native_watchdog import supervise; "
                f"r=supervise({python(worker)!r}, 1, terminate_grace=.15, kill_grace=.3); "
                f"Path({str(root / 'result')!r}).write_text(json.dumps(r))"), cwd=SCRIPTS)
            # This process is outside the worker session and must survive cleanup.
            unrelated = subprocess.Popen(python("import time; time.sleep(60)"))
            pids = []
            try:
                deadline = time.monotonic() + 3
                while not (root / "grandchild").exists() and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertTrue((root / "grandchild").exists())
                pids = [int((root / name).read_text()) for name in ("child", "grandchild")]
                if signum is not None:
                    parent.send_signal(signum)
                    time.sleep(.04)
                    parent.send_signal(signum)  # Repeated interrupts cannot abort cleanup.
                parent.wait(timeout=4)
                self.assertEqual(parent.returncode, 0)
                result = json.loads((root / "result").read_text())
                expected = "interrupted" if signum else "exited" if leader_exits else "timed-out"
                self.assertEqual(result["status"], expected)
                self.assertTrue(result["forcedKill"])
                self.assertEqual(result["interruptSignal"], signum)
                self.assertTrue(all(not alive(pid) for pid in pids), pids)
                self.assertIsNone(unrelated.poll())
            finally:
                if parent.poll() is None:
                    parent.kill()
                parent.wait(timeout=2)
                unrelated.terminate()
                unrelated.wait(timeout=2)
                if pids and any(alive(pid) for pid in pids):
                    try:
                        os.killpg(pids[0], signal.SIGKILL)
                    except ProcessLookupError:
                        pass

    def test_deadline_cleans_children_and_grandchildren(self):
        self.check_tree_cleanup()

    def test_cleanup_includes_descendants_after_leader_exits(self):
        self.check_tree_cleanup(leader_exits=True)

    def test_interrupt_cleans_children_and_grandchildren(self):
        for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            with self.subTest(signum=signum):
                self.check_tree_cleanup(signum)


class CaptureStatusTests(unittest.TestCase):
    def capture(self, directory, *, timeout=False, corrupt=False, exitcode=None):
        args = SimpleNamespace(profile="consistent", run_id="synthetic", seconds=1, verified_copy=False)
        output = Path(directory) / "phase6.8/native-stage2/self-file-experiments/synthetic"
        trace = b'{"synthetic": true}\n'
        observation = {"traceSha256": hashlib.sha256(trace).hexdigest(), "resumable": False,
                       "evidenceAccepted": False, "terminalTimeout": timeout, "captureComplete": not timeout}

        def worker(command, seconds):
            self.assertIn("--_worker", command)
            output.mkdir()
            (output / "api-trace.json").write_bytes(trace + (b"corrupt" if corrupt else b""))
            (output / "continuous-run.json").write_text(json.dumps(observation))
            if exitcode is None:
                code = 124 if timeout else 2
                return supervise(python(f"raise SystemExit({code})"), seconds)
            # Preserve partial output from a killed worker without accepting it.
            return supervise(python("import time; time.sleep(60)"), .1)

        with patch.dict(os.environ, {"MCD_LOCAL_GAME_DATA_ROOT": directory}), patch.object(runner, "supervise", side_effect=worker), patch.object(runner, "print", create=True):
            code = runner.supervise_capture(args)
        record = json.loads(output.with_name("synthetic.watchdog.json").read_text())
        self.assertEqual(record, json.loads((output / "watchdog-run.json").read_text()))
        self.assertFalse(record["evidenceAccepted"])
        self.assertFalse(record["resumable"])
        return code, record, output

    def test_analysis_stop_preserves_complete_conditional_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            code, record, output = self.capture(directory)
            self.assertEqual(code, 2)
            self.assertEqual(record["status"], "analysis-stopped")
            self.assertTrue(record["captureComplete"])
            self.assertTrue((output / "continuous-run.json").is_file())

    def test_emulation_timeout_is_incomplete_and_nonzero(self):
        with tempfile.TemporaryDirectory() as directory:
            code, record, _ = self.capture(directory, timeout=True)
            self.assertEqual(code, 124)
            self.assertEqual(record["status"], "emulation-timeout")
            self.assertFalse(record["captureComplete"])

    def test_outer_timeout_marks_existing_artifacts_incomplete(self):
        with tempfile.TemporaryDirectory() as directory:
            code, record, _ = self.capture(directory, exitcode=124)
            self.assertEqual(code, 124)
            self.assertEqual(record["status"], "timed-out")
            self.assertFalse(record["captureComplete"])

    def test_mismatched_trace_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            code, record, _ = self.capture(directory, corrupt=True)
            self.assertEqual(code, 1)
            self.assertEqual(record["status"], "failed")
            self.assertFalse(record["captureComplete"])

    def test_existing_output_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, output = self.capture(directory)
            before = {p.name: p.read_bytes() for p in output.iterdir()}
            with patch.dict(os.environ, {"MCD_LOCAL_GAME_DATA_ROOT": directory}), patch.object(runner, "supervise") as spawn:
                with self.assertRaisesRegex(SystemExit, "already exists"):
                    runner.supervise_capture(SimpleNamespace(run_id="synthetic"))
                spawn.assert_not_called()
            self.assertEqual(before, {p.name: p.read_bytes() for p in output.iterdir()})

    def test_exit_code_without_final_output_is_not_complete(self):
        for returncode in (0, 2, 124, -signal.SIGKILL):
            with self.subTest(returncode=returncode), tempfile.TemporaryDirectory() as directory:
                args = SimpleNamespace(profile="consistent", run_id="missing", seconds=1, verified_copy=False)
                result = {"status": "exited" if returncode == 0 else "failed", "returncode": returncode,
                          "cleanupComplete": True, "forcedKill": False}
                with patch.dict(os.environ, {"MCD_LOCAL_GAME_DATA_ROOT": directory}), patch.object(runner, "supervise", return_value=result), patch.object(runner, "print", create=True):
                    self.assertEqual(runner.supervise_capture(args), 1)
                record_path = Path(directory) / "phase6.8/native-stage2/self-file-experiments/missing.watchdog.json"
                self.assertFalse(json.loads(record_path.read_text())["captureComplete"])


if __name__ == "__main__":
    unittest.main()
