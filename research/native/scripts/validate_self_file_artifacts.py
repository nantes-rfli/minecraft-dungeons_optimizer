#!/usr/bin/env python3
"""Validate continuation evidence without proprietary inputs or emulation tools."""
import hashlib
import json
import math
from pathlib import Path
import re


def validate():
    native = Path(__file__).resolve().parents[1]
    evidence = json.loads((native / "self-file-continuation.json").read_text())
    external = json.loads((native / "external-native-candidates-20261022.json").read_text())
    inventory = json.loads((native / "native-source-inventory.json").read_text())

    def need(condition, message):
        if not condition:
            raise SystemExit("FAIL: self-file evidence: " + message)

    def sha(value):
        need(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value), "invalid SHA-256")

    need(evidence["schemaVersion"] == external["schemaVersion"] == 1, "unsupported schema")
    need(evidence["status"] == "research-only" and not evidence["runtimePromotion"] and not evidence["applicationImpact"], "local research boundary")
    need(external["status"] == "external-old-source-hypothesis" and not external["runtimePromotion"] and not external["localNativeVerification"], "external hypothesis boundary")
    need(evidence["binarySha256"] == external["localInput"]["sha256"] == inventory["binary"]["sha256"], "exe identity")
    need(evidence["stage1Sha256"] == inventory["recoveryOutputs"]["stage1"]["sha256"], "Stage1 identity")
    need(set(external["resultingLocalMechanicClaims"].values()) == {"unknown"}, "unverified local mechanics promoted")
    profiles = evidence["profiles"]
    need({p["profile"] for p in profiles} == {"self-file-legacy", "self-file-consistent"}, "profile pair")
    scripts = {"baselineScriptSha256": "trace_smbios_boundary.py", "adapterScriptSha256": "continue_self_file.py", "modelScriptSha256": "self_file_model.py"}
    for profile in profiles:
        for field, name in scripts.items():
            sha(profile[field])
            need(profile[field] == hashlib.sha256((native / "scripts" / name).read_bytes()).hexdigest(), name + " differs from executed source")
        for key in ["traceSha256", "dungeonSha256", "mappedImageSha256"]:
            sha(profile[key])
        path = Path(profile["localOutput"])
        need(not path.is_absolute() and ".." not in path.parts and path.parts[:3] == ("phase6.8", "native-stage2", "self-file-experiments"), "local capture path")
        names = [event["name"] for event in profile["fileEvents"]]
        need(names[:4] == ["CreateFileW", "CreateFileMappingW", "MapViewOfFile", "GetFileSize"], "self-file boundary sequence")
        need(profile["fileEvents"][0]["inputSha256"] == evidence["binarySha256"], "opened input identity")
        need(all("accessMask" not in event and "outputHandlePointer" in event for event in profile["registryEvents"]), "RegOpenKeyA signature")
        sections = profile["sectionHashes"]
        need(len(sections) == 16 and len({s["index"] for s in sections}) == 16, "section coverage")
        need(profile["changedSectionIndices"] == [s["index"] for s in sections if s["initial"] != s["final"]], "section change summary")
        need(profile["fileReadSample"]["count"] <= profile["fileReadSample"]["limit"] == 256, "read sample bound")
        need(profile["budget"]["maximumSlices"] >= len(profile["budget"]["slices"]) > 0, "slice budget")
    consistent = next(p for p in profiles if p["profile"] == "self-file-consistent")
    firmware = consistent["firmwareEvents"]
    need(firmware[0]["modeledReturn"] > 0, "corrected firmware size")
    if len(firmware) == 2:
        need(firmware[0]["modeledReturn"] == firmware[1]["writtenBytes"] == firmware[1]["modeledReturn"], "corrected size/fill mismatch")
    need(all(scan["sha256"] for scan in evidence["identifierScan"]["inputs"]), "scan input identities")
    ids = {source["id"] for source in external["sources"]}
    need(len(ids) == len(external["sources"]), "duplicate source ids")
    for source in external["sources"]:
        need(re.fullmatch(r"https://github.com/[^/]+/[^/]+/blob/[0-9a-f]{40}/.+", source["url"]), "source URL must pin commit")
        need(re.fullmatch(r"[0-9a-f]{40}", source["gitBlobSha"]), "invalid git blob identity")
    # Independently simplified algebra checks transcription, not native truth.
    for sample in external["oldSourcePredictionsApproximate"]:
        d = max(1, 10 * sample["internalPower"] - 9)
        exponent = min(57, max(0, 19 * 17 * (d - 1) / (99 * 18)))
        health = 0.75 * 1.25 ** exponent + 0.25
        need(math.isclose(sample["damageMultiplier"], 2 * health - 1, rel_tol=1e-12), "old-source damage arithmetic")
        need(math.isclose(sample["healthMultiplier"], health, rel_tol=1e-12), "old-source health arithmetic")
        need(math.isclose(sample["cooldownMultiplier"], 0.5 + 0.5 / (1 + 0.33 * 2.6 * (d - 1) / 99), rel_tol=1e-12), "old-source cooldown arithmetic")
    print("PASS: self-file continuation and external candidate boundaries")


if __name__ == "__main__":
    validate()
