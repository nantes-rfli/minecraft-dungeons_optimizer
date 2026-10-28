#!/usr/bin/env python3
"""Run the pinned self-file model once; never resume an asynchronous stop.

The old adapters and their evidence hashes remain unchanged. Optional copy-loop
acceleration is hash-bound and recorded separately; API results stay unchanged.
Raw captures stay in the existing private local-game-data output directory.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import continue_self_file as historical
import verified_copy_loop
from native_watchdog import supervise


def run_once(g, seconds, observation):
    """A timeout is terminal: its PC and memory may not form a resumable state."""
    if observation.get("emuStartCalls", 0) or g["reason"] is not None:
        raise ValueError("continuous runner requires a fresh state")
    if not 1 <= seconds <= 3600:
        raise ValueError("seconds must be 1..3600")
    emu = g["u"]
    observation["emuStartCalls"] = 1
    started = time.monotonic()
    try:
        emu.emu_start(g["base"] + 0x4BB8000 + 0x2C495F, 0,
                      timeout=seconds * 1_000_000, count=0)
    except g["un"].UcError as exc:
        if g["reason"] is None:
            g["reason"] = str(exc)
    terminal_timeout = g["reason"] is None
    if terminal_timeout:
        g["reason"] = "terminal time budget; do not resume this state"
    observation.update(
        emuStartCalls=1, instructionLimit=None, timeLimitSeconds=seconds,
        elapsedSeconds=time.monotonic() - started,
        terminalTimeout=terminal_timeout, resumable=False,
        stopReason=g["reason"], stopVa=hex(emu.reg_read(g["UC_X86_REG_RIP"])),
        registers={name: hex(emu.reg_read(reg)) for name, reg in g["checkpointRegisters"].items()},
    )
    g["sliceObservations"] = []  # This run has no resumable slices.


def run_worker(args):
    """Only called in the dedicated watchdog session; all native work stays here."""
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    copy_path = Path(verified_copy_loop.__file__)
    copy_hash = hashlib.sha256(copy_path.read_bytes()).hexdigest()
    observation = {"executionMode": "single-call-no-resume", "samples": [],
                   "fileReadCount": 0, "lastFileRead": None}
    original_install = historical.install_extension
    output = None

    def install(g, settings):
        nonlocal output
        original_install(g, settings)
        output = g["outdir"]
        observation["binarySha256"] = g["expectedExe"]
        observation["stage1Sha256"] = g["expectedStage"]
        observation["unicornVersion"] = g["un"].__version__
        view_address = historical.SelfFileModel.VIEW_ADDRESS
        if args.verified_copy:
            verified_copy_loop.install(g, output, observation)

        def read(emu, access, address, size, value, user):
            observation["fileReadCount"] += 1
            count = observation["fileReadCount"]
            observation["lastFileRead"] = {"offset": address - view_address, "size": size}
            if count == 1 or count % 100_000 == 0:
                sample = {"readCount": count, **observation["lastFileRead"],
                          "instructionRva": hex(emu.reg_read(g["UC_X86_REG_RIP"]) - g["base"]),
                          "seconds": time.monotonic() - g["start"]}
                observation["samples"].append(sample)
                print(json.dumps(sample), flush=True)

        g["u"].hook_add(g["un"].UC_HOOK_MEM_READ, read, begin=view_address,
                        end=view_address + len(g["data"]) - 1)

    historical.install_extension = install
    historical.run_slices = lambda g, settings: run_once(g, args.seconds, observation)
    sys.argv = [str(Path(historical.__file__)), args.profile,
                "--run-id", args.run_id, "--slices", "1"]
    historical.main()
    if hashlib.sha256(Path(__file__).read_bytes()).hexdigest() != script_hash or hashlib.sha256(copy_path.read_bytes()).hexdigest() != copy_hash:
        raise SystemExit("runner changed during capture; discard incomplete output")
    # Correct inherited slice/count labels before hashing the trace. These are
    # execution parameters, not observations or replayable checkpoints.
    trace_path = output / "api-trace.json"
    trace = json.loads(trace_path.read_text())
    for key in ("maximumSlices", "instructionsPerSliceLimit", "microsecondsPerSliceLimit", "slices"):
        trace.pop(key, None)
    trace["continuousExecution"] = {key: observation[key] for key in (
        "executionMode", "emuStartCalls", "instructionLimit", "timeLimitSeconds",
        "terminalTimeout", "resumable")}
    trace["runnerScriptSha256"] = script_hash
    trace_path.write_text(json.dumps(trace, indent=2) + "\n")
    observation.update(
        schemaVersion=1, status="conditional-emulation", runtimePromotion=False,
        captureComplete=not observation["terminalTimeout"], evidenceAccepted=False,
        applicationImpact=False, runnerScriptSha256=script_hash,
        copySummaryEnabled=args.verified_copy, copySummaryScriptSha256=copy_hash,
        baselineScriptSha256=trace["baselineScriptSha256"],
        adapterScriptSha256=trace["adapterScriptSha256"],
        modelScriptSha256=trace["modelScriptSha256"],
        traceSha256=hashlib.sha256(trace_path.read_bytes()).hexdigest(),
        mappedImageSha256=trace["mappedImageSha256"],
        sectionHashes=trace["sectionHashes"],
        privateInputsCommitted=False,
    )
    (output / "continuous-run.json").write_text(json.dumps(observation, indent=2) + "\n")
    print(json.dumps({"output": str(output), "stopReason": observation["stopReason"],
                      "fileReadCount": observation["fileReadCount"]}), flush=True)
    # A recorded analysis stop is distinct from successful program completion.
    return 124 if observation["terminalTimeout"] else 2


def write_record(path, record):
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("x") as stream:
        stream.write(json.dumps(record, indent=2) + "\n")
    temporary.replace(path)


def supervise_capture(args):
    local_root = Path(os.environ.get(
        "MCD_LOCAL_GAME_DATA_ROOT", Path(historical.__file__).resolve().parents[3] / "local-game-data")).resolve()
    output = local_root / "phase6.8/native-stage2/self-file-experiments" / args.run_id
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise SystemExit("run output already exists; use a fresh run-id")
    # Reserve the ID and mark the whole capture incomplete BEFORE spawning. This
    # sibling survives a killed supervisor too, and never overwrites old captures.
    record_path = output.with_name(output.name + ".watchdog.json")
    record = {"schemaVersion": 1, "status": "running", "output": str(output),
              "captureComplete": False, "evidenceAccepted": False, "resumable": False,
              "runtimePromotion": False, "applicationImpact": False}
    with record_path.open("x") as stream:
        stream.write(json.dumps(record, indent=2) + "\n")
    command = [sys.executable, "-B", str(Path(__file__).resolve()), args.profile,
               "--run-id", args.run_id, "--seconds", str(args.seconds), "--_worker"]
    if args.verified_copy:
        command.append("--verified-copy")
    try:
        result = supervise(command, args.seconds)
        record.update(result)
        if result["status"] == "failed" and result["returncode"] in (2, 124):
            # A worker exit code alone cannot prove it finished writing artifacts.
            try:
                observation = json.loads((output / "continuous-run.json").read_text())
                trace = output / "api-trace.json"
                valid = (observation["traceSha256"] == hashlib.sha256(trace.read_bytes()).hexdigest()
                         and observation["resumable"] is False
                         and observation["evidenceAccepted"] is False)
                if valid and result["cleanupComplete"] and not result["forcedKill"]:
                    if result["returncode"] == 2 and observation["captureComplete"] is True and observation["terminalTimeout"] is False:
                        record.update(status="analysis-stopped", captureComplete=True)
                    elif result["returncode"] == 124 and observation["terminalTimeout"] is True:
                        record["status"] = "emulation-timeout"
            except (OSError, ValueError, KeyError, TypeError):
                pass  # Missing/partial/mismatched results are never complete captures.
        if not result["cleanupComplete"]:
            record["status"] = "cleanup-incomplete"
    except BaseException as exc:
        record.update(status="supervisor-error", error=str(exc))
        raise
    finally:
        write_record(record_path, record)
        if output.is_dir():
            write_record(output / "watchdog-run.json", record)
        print(json.dumps(record), flush=True)
    if record["status"] == "analysis-stopped":
        return 2
    if record["status"] in ("timed-out", "emulation-timeout"):
        return 137 if record["forcedKill"] else 124
    if record["status"] == "interrupted":
        return 128 + record["interruptSignal"]
    return 1  # No native analysis stop is an ordinary successful program exit.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", choices=["legacy", "consistent"])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--seconds", type=int, default=1800,
                        help="wall-clock limit for the entire worker, including setup and output")
    parser.add_argument("--verified-copy", action="store_true",
                        help="summarize verified nonoverlapping section copies, saving their source buffers")
    parser.add_argument("--_worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not 1 <= args.seconds <= 3600 or not args.run_id.replace("-", "").isalnum():
        parser.error("seconds must be 1..3600 and run-id must be alphanumeric/hyphens")
    return run_worker(args) if args._worker else supervise_capture(args)


if __name__ == "__main__":
    raise SystemExit(main())
