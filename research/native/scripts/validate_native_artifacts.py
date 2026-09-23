#!/usr/bin/env python3
"""Validate the Native Analysis research artifacts without private game files."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[3]
NATIVE = ROOT / "research" / "native"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
FORBIDDEN_SUFFIXES = {
    ".exe", ".dll", ".bin", ".dmp", ".mem", ".uasset", ".uexp",
    ".pak", ".pdb", ".map", ".sym", ".pyc",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def read_json(name: str) -> dict:
    path = NATIVE / name
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"FAIL: cannot read {path.relative_to(ROOT)}: {exc}") from exc
    require(isinstance(value, dict), f"{name} must contain a JSON object")
    require(value.get("schemaVersion") == 1, f"{name} has an unsupported schemaVersion")
    return value


def sha(value: object, where: str) -> str:
    require(isinstance(value, str) and SHA256_RE.fullmatch(value) is not None, f"{where} must be a lowercase SHA-256")
    return value


def resolve_native_ref(value: str, where: str) -> Path:
    path = (NATIVE / value).resolve()
    require(path.is_relative_to(ROOT), f"{where} escapes the repository")
    require(path.exists(), f"{where} does not resolve: {value}")
    return path


def resolve_repo_ref(value: str, where: str) -> Path:
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), f"{where} escapes the repository")
    require(path.exists(), f"{where} does not resolve: {value}")
    return path


def main() -> None:
    inventory = read_json("native-source-inventory.json")
    prior_art = read_json("external-prior-art.json")
    architecture = read_json("native-architecture.json")
    candidates = read_json("function-candidates.json")
    firmware = read_json("firmware-boundary-observations.json")
    startup = read_json("startup-block-map.json")

    exe_hash = sha(inventory["binary"]["sha256"], "inventory.binary.sha256")
    stage_hash = sha(inventory["recoveryOutputs"]["stage1"]["sha256"], "inventory.recoveryOutputs.stage1.sha256")
    require(inventory["binary"]["distributionAuthenticity"] == "unverified", "local archive authenticity must remain explicitly unverified")
    require(inventory["status"] == "research-only" and inventory["runtimePromotion"] is False, "inventory must stay research-only")

    require(architecture["binary"]["sha256"] == exe_hash, "architecture executable hash differs from inventory")
    require(architecture["milestones"]["D1"]["stage1Sha256"] == stage_hash, "architecture Stage 1 hash differs from inventory")
    require(architecture["milestones"]["D2"]["originalImageRegionEntryObserved"] is False, "D-2 must preserve the unobserved original-image entry")
    require(architecture["milestones"]["D3"]["gameplayFunctionIdentified"] is False, "D-3 must remain unstarted without a gameplay function")
    dungeon = next((section for section in inventory["sections"] if section["name"] == ".dungeon"), None)
    require(dungeon is not None and hex(dungeon["rva"]) == architecture["milestones"]["D1"]["sectionRva"], "Stage 1 .dungeon RVA cross-reference is invalid")

    for ref_name, ref in architecture["baselineReferences"].items():
        require(resolve_native_ref(ref, f"architecture.baselineReferences.{ref_name}").is_file(), f"baseline ref is not a file: {ref_name}")

    require(firmware["binary"]["sha256"] == exe_hash, "firmware executable hash differs from inventory")
    require(firmware["stage1"]["sha256"] == stage_hash, "firmware Stage 1 hash differs from inventory")
    script = resolve_native_ref(firmware["reproducibility"]["script"], "firmware.reproducibility.script")
    expected_script_hash = sha(firmware["reproducibility"]["scriptSha256"], "firmware.reproducibility.scriptSha256")
    actual_script_hash = hashlib.sha256(script.read_bytes()).hexdigest()
    require(actual_script_hash == expected_script_hash, "firmware tracer source hash differs from recorded hash")
    profiles = {item["profile"] for item in firmware["sizeCounterfactuals"]}
    require(profiles == {"firmware-zero-size", "firmware-alt-size", "firmware-success-size"}, "SMBIOS size profile set is incomplete")
    for item in firmware["sizeCounterfactuals"]:
        sha(item["dungeonSha256AtStop"], f"firmware profile {item['profile']} dungeonSha256AtStop")
    sha(firmware["syntheticTableProbe"]["dungeonSha256AtStop"], "firmware.syntheticTableProbe.dungeonSha256AtStop")
    require(firmware["syntheticTableProbe"]["syntheticPayload"]["isRealMachineData"] is False, "synthetic firmware data must not be labeled as real")
    require(firmware["syntheticTableProbe"]["readObservation"]["uniqueByteOffsets"] == 240, "synthetic read span changed")

    require(startup["binarySha256"] == exe_hash, "static control-flow executable hash differs from inventory")
    require(startup["stage1Sha256"] == stage_hash, "static control-flow Stage 1 hash differs from inventory")
    require(startup["analysisBaselineCommit"] == architecture["analysisBaselineCommit"]
            == "37d7d29ac2ffa799f476703eb5cf1d41285b1756",
            "static analysis baseline differs from the requested main commit")
    require(startup["status"] == "research-only" and startup["runtimePromotion"] is False and startup["applicationImpact"] is False,
            "static control-flow analysis must stay research-only")
    analysis_script = resolve_native_ref(startup["analysisScript"]["path"], "startup.analysisScript.path")
    analysis_script_hash = sha(startup["analysisScript"]["sha256"], "startup.analysisScript.sha256")
    require(hashlib.sha256(analysis_script.read_bytes()).hexdigest() == analysis_script_hash,
            "static control-flow source hash differs from recorded hash")
    return_positions = startup["negativeEvidence"]["conditionalTraceApiReturnPositions"]
    require(return_positions["observationCount"] == 74 and return_positions["uniqueRvaCount"] == 58
            and return_positions["listedRangeMatches"] == 0 and return_positions["returnRvaIsFunctionEntry"] is False,
            "conditional API return range-miss evidence changed or lost its function-entry warning")
    exception_rows = startup["negativeEvidence"]["exceptionDirectory"]
    require(exception_rows["entryCount"] == 236168 and exception_rows["nonzeroEntries"] == 236168
            and exception_rows["entriesWithBeginLessThanEnd"] == 236168,
            "exception-directory evidence differs from the pinned D-2 input")
    size_branch = startup["smbios"]["sizeBranch"]
    branch_instructions = [(item["mnemonic"], item["operands"]) for item in size_branch["instructionEvidence"]]
    require(branch_instructions == [("and", "ebx, 1"), ("je", "0x144e9938c")],
            "identified SMBIOS size branch instruction sequence changed")
    require(size_branch["counterfactualCaptures"]["zeroSize"]["observedSuccessor"] == "0x4e9935b"
            and size_branch["counterfactualCaptures"]["positiveSize"]["observedSuccessor"] == "0x4e9938c",
            "paired branch captures no longer show their recorded synthetic successors")
    require(startup["stableGameCodeSearch"]["candidateFound"] is False
            and startup["stableGameCodeSearch"]["registrationMechanismFound"] is False
            and startup["stableGameCodeSearch"]["functionCandidateAccepted"] == 0,
            "bounded scan must not promote a stable native candidate")

    candidate_ids = set()
    allowed_statuses = set(candidates["candidatePolicy"]["statuses"])
    for candidate in candidates["candidates"]:
        candidate_id = candidate["candidateId"]
        require(candidate_id not in candidate_ids, f"duplicate function candidate id: {candidate_id}")
        candidate_ids.add(candidate_id)
        require(candidate["status"] in allowed_statuses, f"invalid candidate status: {candidate['status']}")
        require(candidate["location"]["rva"] is None and candidate["location"]["va"] is None, "unknown code locations must stay null, not zero")
        raw_asset = resolve_repo_ref(candidate["evidence"][0]["source"], f"candidate {candidate_id} Raw source")
        require(raw_asset.is_file(), f"candidate Raw asset source is not a file: {raw_asset}")
        require(candidate["identity"]["function"] is None, "no native function identity has been established")
    require(candidates["mechanicClaims"] and all(value in {"unknown", "unsupported"} for value in candidates["mechanicClaims"].values()), "unverified mechanics must remain unknown/unsupported")
    require(candidates["runtimePromotion"] is False and candidates["applicationImpact"] is False, "candidate records must not affect runtime or application semantics")

    project_ids = set()
    for project in prior_art["projects"]:
        require(project["id"] not in project_ids, f"duplicate prior-art project id: {project['id']}")
        project_ids.add(project["id"])
        require(project["sources"], f"prior-art project has no source URLs: {project['id']}")
        for url in project["sources"]:
            parsed = urlparse(url)
            require(parsed.scheme == "https" and bool(parsed.netloc), f"invalid prior-art source URL: {url}")
    require(prior_art["codeReuse"] == [], "external source code was not authorized for reuse")

    forbidden = [path.relative_to(ROOT) for path in NATIVE.rglob("*") if path.is_file() and path.suffix.lower() in FORBIDDEN_SUFFIXES]
    require(not forbidden, f"binary or raw dump files found under research/native: {forbidden}")
    docs = ROOT / "docs" / "game-data-native-analysis.md"
    require(docs.is_file(), "Native Analysis documentation is missing")
    require("game-data-native-analysis.md" in (ROOT / "docs" / "README.md").read_text(), "docs index is missing the Native Analysis link")

    print(json.dumps({
        "status": "passed",
        "executableSha256": exe_hash,
        "stage1Sha256": stage_hash,
        "traceScriptSha256": actual_script_hash,
        "staticAnalysisScriptSha256": analysis_script_hash,
        "priorArtProjects": len(project_ids),
        "functionCandidates": len(candidate_ids),
        "forbiddenFiles": 0,
        "privateGameInputsRequired": False,
    }, indent=2))


if __name__ == "__main__":
    main()
