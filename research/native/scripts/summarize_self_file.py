#!/usr/bin/env python3
"""Project private continuation captures to compact, binary-free evidence."""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def summarize(run, local_root):
    trace_path = run / "api-trace.json"
    trace = json.loads(trace_path.read_text())
    image = run / "mapped-image.bin"
    assert digest(image) == trace["mappedImageSha256"]
    assert digest(run / "api-dungeon.bin") == trace["dungeonSha256"]
    events = trace["events"]
    file_names = {"CreateFileW", "CreateFileMappingW", "MapViewOfFile", "GetFileSize",
                  "UnmapViewOfFile", "ReadFile", "SetFilePointer"}
    samples = trace["fileReadSamples"]
    from capstone import Cs, CS_ARCH_X86, CS_MODE_64
    cs = Cs(CS_ARCH_X86, CS_MODE_64)
    image_bytes = image.read_bytes()
    consumers = []
    for rva in sorted({sample["instructionRva"] for sample in samples}):
        offset = int(rva, 16)
        instructions = list(cs.disasm(image_bytes[offset:offset+32], 0x140000000 + offset))[:2]
        consumers.append({"readRva": rva, "instructions": [{"rva": hex(i.address-0x140000000), "text": (i.mnemonic+" "+i.op_str).strip()} for i in instructions], "inputSha256": trace["mappedImageSha256"], "interpretation": "Observed file read and adjacent decoded arithmetic only; no whole-loop/checksum algorithm claim."})
    return {
        "profile": trace["profile"],
        "localOutput": str(run.relative_to(local_root)),
        "traceSha256": digest(trace_path),
        "baselineScriptSha256": trace["baselineScriptSha256"],
        "adapterScriptSha256": trace["adapterScriptSha256"],
        "modelScriptSha256": trace["modelScriptSha256"],
        "stopReason": trace["stopReason"],
        "stopVa": trace["rip"],
        "eventCountIncludingRdtsc": len(events),
        "apiCountIncludingBoundary": sum("name" in event for event in events),
        "lastApi": next(event for event in reversed(events) if "name" in event),
        "fileEvents": [event for event in events if event.get("name") in file_names],
        "firmwareEvents": [event for event in events if event.get("name") == "GetSystemFirmwareTable"],
        "registryEvents": [event for event in events if event.get("name") == "RegOpenKeyA"],
        "sectionHashes": trace["sectionHashes"],
        "changedSectionIndices": [s["index"] for s in trace["sectionHashes"] if s["initial"] != s["final"]],
        "originalImageEntryObserved": isinstance(trace["stopReason"], dict) and "originalRegionEntry" in trace["stopReason"],
        "dungeonSha256": trace["dungeonSha256"],
        "mappedImageSha256": trace["mappedImageSha256"],
        "mappedImageBytes": trace["mappedImageBytes"],
        "readConsumers": consumers,
        "fileReadSample": {
            "count": len(samples), "limit": trace["fileReadSampleLimit"],
            "completeReadHistory": len(samples) < trace["fileReadSampleLimit"],
            "offsetMinimum": min((s["offset"] for s in samples), default=None),
            "offsetExclusiveMaximum": max((s["offset"] + s["size"] for s in samples), default=None),
            "instructionRvas": sorted({s["instructionRva"] for s in samples}),
            "unreadDwordOffsetsWithinSampleSpan": [offset for offset in range(0, max((sample["offset"]+sample["size"] for sample in samples), default=0), 4) if offset not in {sample["offset"] for sample in samples}],
            "firstReads": samples[:12], "lastReads": samples[-12:],
        },
        "budget": {key: trace[key] for key in ["slices", "maximumSlices", "instructionsPerSliceLimit", "microsecondsPerSliceLimit"]},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-root", type=Path, required=True)
    parser.add_argument("--runs", nargs=2, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--external", type=Path, required=True)
    settings = parser.parse_args()
    root = settings.local_root.resolve()
    sys.path.insert(0, str(root / "phase6.8/native-stage2/tools"))
    profiles = [summarize(root / "phase6.8/native-stage2/self-file-experiments" / name, root) for name in settings.runs]
    external = json.loads(settings.external.read_text())
    names = sorted({name for target in external["nativeIdentifierTargets"] for name in target["names"]})
    inputs = [root / "archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe", root / "phase6.8/mechanics/stage1.bin"]
    inputs += [root / item["localOutput"] / "mapped-image.bin" for item in profiles]
    scans = []
    for path in inputs:
        data = path.read_bytes()
        scans.append({"input": str(path.relative_to(root)), "sha256": hashlib.sha256(data).hexdigest(),
                      "sizeBytes": len(data), "matches": [
                          {"name": name, "encoding": encoding, "offset": offset}
                          for name in names for encoding in ["ascii", "utf-16le"]
                          if (offset := data.find(name.encode(encoding))) >= 0]})
    result = {
        "schemaVersion": 1, "date": "2026-10-22", "status": "research-only",
        "runtimePromotion": False, "applicationImpact": False,
        "analysisBaselineCommit": "8fd4bde40f42d1aeee2571d441d8b6214e1c3046",
        "binarySha256": scans[0]["sha256"], "stage1Sha256": scans[1]["sha256"],
        "distributionAuthenticity": "unverified", "profiles": profiles,
        "identifierScan": {"names": names, "encodings": ["ascii", "utf-16le"], "inputs": scans,
                           "scope": "Exact literal search; only first hit per name/encoding. Encoded or runtime-generated names remain possible."},
        "interpretation": {
            "newBoundary": "Self-file CreateFileW, CreateFileMappingW, MapViewOfFile and GetFileSize have explicit pinned-byte models.",
            "nativeGameplayImplementation": "unknown", "powerScaling": "unknown", "cooldown": "unknown",
            "attackTimingApplication": "unknown", "effectStacking": "unknown",
            "oldStaticSurvey": "Historical static-only exhaustion is not a prohibition on new conditional execution experiments.",
        },
        "limitations": [
            "All Windows APIs and environment values remain synthetic. No real Windows process or adjacent DLL was loaded.",
            "legacy inherits malformed SMBIOS size/fill behavior; consistent uses an internally length-consistent synthetic fixture.",
            "All three registry keys are modeled missing, including Hardware\\description\\System; this is not a real-machine observation.",
            "Initial original-image pages remain RWX and initial stack layout is inherited from the historical tracer.",
            "RegOpenKeyA has three arguments. Older accessMask fields were stale R9 values; new traces use outputHandlePointer.",
            "Historical focused EBX/dispatch hooks are disabled, and write-page telemetry now covers only the original-image range.",
            "Each slice has instruction and wall-clock ceilings. Budget stops are not crashes, hangs or whole-binary negative proofs.",
            "The mapped image is a partial synthetic emulator snapshot, not a verified post-unpack image.",
            "File-read samples are capped; their span is not the total file-read span.",
            "External class names and old-source equations do not establish a current-build RVA or mechanic."
        ]}
    settings.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"profiles": [(p["profile"], p["stopReason"], p["changedSectionIndices"]) for p in profiles],
                      "literalMatches": sum(len(scan["matches"]) for scan in scans)}))


if __name__ == "__main__":
    main()
