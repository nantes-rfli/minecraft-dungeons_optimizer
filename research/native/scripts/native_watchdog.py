"""Bounded POSIX process supervision; never execute native analysis in the parent."""
import math
import os
import signal
import subprocess
import time


def _group_exists(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # Unknown cleanup state must never be reported as gone.


def _signal_group(process, signum):
    pgid = process.pid
    # Only the fresh session created below is ours. Never signal the caller's group.
    if pgid <= 1 or pgid == os.getpgrp():
        raise RuntimeError("refusing to signal the supervisor's process group")
    try:
        os.killpg(pgid, signum)
    except ProcessLookupError:
        pass
    except PermissionError:
        # A denied signal is not confirmation of cleanup. The bounded drain
        # below still attempts escalation and reports cleanupComplete=False.
        # Popen also checks/reaps the owned direct child before signaling it.
        try:
            process.send_signal(signum)
        except (ProcessLookupError, PermissionError):
            pass


def _drain_group(process, grace):
    deadline = time.monotonic() + grace
    while True:
        process.poll()  # Reap our direct child, including after SIGKILL.
        if not _group_exists(process.pid):
            return True
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        time.sleep(min(0.02, remaining))


def supervise(command, seconds, *, terminate_grace=1.0, kill_grace=1.0):
    """Inherit stdout/stderr; bound execution AND cleanup, including interruptions.

    Descendants must retain the worker's process group (the native runner never
    detaches them). SIGKILL cannot be handled by a parent; SIGINT/TERM/HUP can.
    No pipes or unbounded waits are used, even when descendants outlive the leader.
    """
    if os.name != "posix":
        raise RuntimeError("native watchdog requires POSIX process groups")
    if any(not math.isfinite(value) or value <= 0
           for value in (seconds, terminate_grace, kill_grace)):
        raise ValueError("watchdog budgets must be positive and finite")
    interrupted = None

    def interrupt(signum, frame):
        nonlocal interrupted
        if interrupted is None:
            interrupted = signum

    handlers = {}
    process = None
    started = time.monotonic()
    forced = False
    cleaned = True
    status = "failed"
    try:
        for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            handlers[signum] = signal.signal(signum, interrupt)
        process = subprocess.Popen(command, start_new_session=True)
        deadline = started + seconds
        while True:
            if interrupted is not None:
                status = "interrupted"
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                status = "timed-out"
                break
            code = process.poll()
            if code is not None:
                status = "exited" if code == 0 else "failed"
                break
            time.sleep(min(0.02, remaining))
    finally:
        try:
            if process is not None and _group_exists(process.pid):
                _signal_group(process, signal.SIGTERM)
                cleaned = _drain_group(process, terminate_grace)
                if not cleaned:
                    forced = True
                    _signal_group(process, signal.SIGKILL)
                    cleaned = _drain_group(process, kill_grace)
            if process is not None:
                process.poll()
        finally:
            for signum, handler in handlers.items():
                signal.signal(signum, handler)
    if interrupted is not None:
        status = "interrupted"
    return {"status": status, "returncode": process.returncode,
            "forcedKill": forced, "cleanupComplete": cleaned,
            "interruptSignal": interrupted,
            "timeLimitSeconds": seconds, "elapsedSeconds": time.monotonic() - started}
