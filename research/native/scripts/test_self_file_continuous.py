"""Execution-boundary regressions; no private inputs or Unicorn dependency."""
from types import SimpleNamespace
import unittest

from run_continuous_self_file import run_once


class EmulationError(Exception):
    pass


class ContinuousRunnerTests(unittest.TestCase):
    def environment(self, result=None, error=None):
        calls = []
        state = {"base": 0x140000000, "reason": None, "UC_X86_REG_RIP": 1,
                 "checkpointRegisters": {"rip": 1},
                 "un": SimpleNamespace(UcError=EmulationError)}

        def start(*args, **kwargs):
            calls.append((args, kwargs))
            state["reason"] = result
            if error:
                raise error

        state["u"] = SimpleNamespace(emu_start=start, reg_read=lambda reg: 0x144CF723C)
        return state, calls

    def test_timeout_is_terminal_and_cannot_be_resumed(self):
        state, calls = self.environment()
        result = {}
        run_once(state, 2, result)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1], {"timeout": 2_000_000, "count": 0})
        self.assertTrue(result["terminalTimeout"])
        self.assertIsNone(result["emulationError"])
        self.assertFalse(result["resumable"])
        self.assertIsNone(result["instructionLimit"])
        self.assertEqual(state["sliceObservations"], [])
        with self.assertRaisesRegex(ValueError, "fresh state"):
            run_once(state, 2, result)
        self.assertEqual(len(calls), 1)

    def test_native_stop_reason_survives_unicorn_exception(self):
        reason = {"invalidMemory": "0x1234", "rip": "0x144e89653"}
        state, calls = self.environment(reason, EmulationError("unmapped read"))
        result = {}
        run_once(state, 3, result)
        self.assertEqual(result["stopReason"], reason)
        self.assertFalse(result["terminalTimeout"])
        self.assertIsNone(result["emulationError"])
        self.assertEqual(len(calls), 1)

    def test_unreported_unicorn_error_is_not_timeout_or_success(self):
        state, _ = self.environment(error=EmulationError("invalid instruction"))
        result = {}
        run_once(state, 3, result)
        self.assertEqual(result["stopReason"], "invalid instruction")
        self.assertFalse(result["terminalTimeout"])
        self.assertEqual(result["emulationError"], "invalid instruction")
        self.assertFalse(result["resumable"])

    def test_invalid_budget_never_executes(self):
        for seconds in (0, -1, 3601):
            state, calls = self.environment()
            with self.subTest(seconds=seconds), self.assertRaises(ValueError):
                run_once(state, seconds, {})
            self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
