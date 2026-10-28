#!/usr/bin/env python3
"""Run the pinned self-file model once; never resume an asynchronous stop.

The old adapters and their evidence hashes remain unchanged. Optional copy-loop
acceleration is hash-bound and recorded separately; API results stay unchanged.
Raw captures stay in the existing private local-game-data output directory.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

import continue_self_file as historical
import verified_copy_loop


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", choices=["legacy", "consistent"])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--seconds", type=int, default=1800)
    parser.add_argument("--verified-copy", action="store_true",
                        help="summarize verified nonoverlapping section copies, saving their source buffers")
    args = parser.parse_args()
    if not 1 <= args.seconds <= 3600:
        parser.error("seconds must be 1..3600")
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


if __name__ == "__main__":
    main()
