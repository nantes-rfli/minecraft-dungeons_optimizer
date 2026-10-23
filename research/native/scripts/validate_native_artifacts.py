#!/usr/bin/env python3
"""Validate the Native Analysis research artifacts without private game files."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
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
    runtime_tables = read_json("runtime-function-table-analysis.json")
    boundary = read_json("stable-code-boundary-survey.json")

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
    branch_flow = firmware["stateTransferToEbxBranch"]
    require(branch_flow["syntheticOnly"] is True and branch_flow["gameSemanticsEstablished"] is False,
            "RSMB-to-EBX evidence must remain explicitly synthetic and semantically unpromoted")
    require({item["profile"] for item in branch_flow["profilePair"]}
            == {"firmware-zero-size", "firmware-success-size"},
            "firmware-to-EBX profile pair is incomplete")

    require(startup["binarySha256"] == exe_hash, "static control-flow executable hash differs from inventory")
    require(startup["stage1Sha256"] == stage_hash, "static control-flow Stage 1 hash differs from inventory")
    require(startup["analysisBaselineCommit"] == architecture["analysisBaselineCommit"]
            == "647fcaefed2a8b90372fcc1e5f1297371ae0ee9d",
            "static analysis baseline differs from the requested main commit")
    require(architecture["milestones"]["D2"]["status"] == "static-boundary-survey-complete"
            and architecture["milestones"]["D2"]["staticBoundaryDecision"]
            == "CURRENT-ENVIRONMENT STATIC NATIVE EXHAUSTED",
            "Native architecture does not record the final D-2 static boundary decision")
    require(startup["status"] == "research-only" and startup["runtimePromotion"] is False and startup["applicationImpact"] is False,
            "static control-flow analysis must stay research-only")
    analysis_script = resolve_native_ref(startup["analysisScript"]["path"], "startup.analysisScript.path")
    analysis_script_hash = sha(startup["analysisScript"]["sha256"], "startup.analysisScript.sha256")
    require(hashlib.sha256(analysis_script.read_bytes()).hexdigest() == analysis_script_hash,
            "static control-flow source hash differs from recorded hash")
    require(boundary["analysisBaselineCommit"] == startup["analysisBaselineCommit"]
            and boundary["binary"]["sha256"] == exe_hash
            and boundary["stage1"]["sha256"] == stage_hash,
            "stable-code boundary survey hashes or baseline differ from the Native inventory")
    require(boundary["status"] == "research-only" and boundary["runtimePromotion"] is False
            and boundary["applicationImpact"] is False
            and boundary["analysisProvenance"]["privateInputsCommitted"] is False,
            "stable-code boundary survey must remain research-only")
    boundary_script = resolve_native_ref(boundary["analysisProvenance"]["script"], "boundary.analysisProvenance.script")
    boundary_script_hash = sha(boundary["analysisProvenance"]["scriptSha256"],
                               "boundary.analysisProvenance.scriptSha256")
    require(hashlib.sha256(boundary_script.read_bytes()).hexdigest() == boundary_script_hash,
            "stable-code boundary survey source hash differs from recorded hash")
    pointer_summary = boundary["codeDataPartition"]["recoveredStage1Partition"]["pointerCluster"]
    pointer_targets = {item["targetRva"]: item for item in pointer_summary["targets"]}
    require(pointer_summary["alignedReferenceCount"] == 87 and pointer_summary["uniqueTargetCount"] == 4
            and {key: item["referenceCount"] for key, item in pointer_targets.items()} == {
                "0x40b0c0": 37, "0x2f46e1f": 25, "0x276f6f0": 24, "0x4d11a0": 1,
            }, "deepened Stage1 absolute-pointer evidence changed")
    require(boundary["codeDataPartition"]["recoveredStage1Partition"]["unalignedAbsoluteReferenceScan"]["byteGranularityReferenceCount"] == 89
            and len(boundary["codeDataPartition"]["recoveredStage1Partition"]["unalignedAbsoluteReferenceScan"]["unalignedReferences"]) == 2,
            "byte-granularity Stage1 pointer scan changed")
    exception = boundary["codeDataPartition"]["exceptionMetadata"]
    require(exception["entryCount"] == 236168 and exception["beginRangesSorted"] is True
            and exception["unwindInfoBytesBacked"] == 1 and exception["stage1RangeStartCount"] == 1157,
            "exception-range relation evidence changed")
    cross_edges = boundary["crossRegionControlFlow"]["decodedRangeSeededCandidates"]
    require(len(cross_edges) == 2
            and {edge["targetRva"] for edge in cross_edges} == {"0x5e297ca", "0x5b8b385"}
            and all(edge["targetSectionIndex"] == 14 and edge["executionObserved"] is False for edge in cross_edges)
            and boundary["crossRegionControlFlow"]["section0StableCodeEdges"] == [],
            "cross-region candidate edge scope changed or was promoted")
    snapshots = boundary["pointerClusterDeepening"]["savedSyntheticProfileComparison"]
    require({item["profile"] for item in snapshots} == {
                "firmware-data-generic", "firmware-zero-size", "firmware-success-size",
                "firmware-alt-size", "firmware-registry-failure", "firmware-registry-success",
                "firmware-registry-first-failure",
            } and all(item["pointerSourceQwordsUnchanged"] == item["pointerSourceQwordCount"] for item in snapshots),
            "saved profile pointer-cluster comparison is incomplete or inconsistent")
    require(boundary["tlsInitializationAudit"]["tlsDirectory"]["callbacksVa"] == "0x0"
            and boundary["tlsInitializationAudit"]["baseRelocations"]["nonzeroRelocationCount"] == 3
            and boundary["ue4RegistrationSearch"]["mechanismCandidateFound"] is False
            and boundary["dungeonsBridgeSearch"]["nativeAddress"] is None
            and boundary["dungeonsBridgeSearch"]["nativeClassOrFunctionRegistrationCandidateFound"] is False,
            "TLS or native registration candidate state changed")
    resolution = boundary["dynamicResolutionCluster"]
    import_summary = resolution["staticImportSummary"]
    export_summary = resolution["staticExportSummary"]
    require(import_summary["namedImportCount"] == 36 and import_summary["ordinalImportCount"] == 5
            and "WINMM.dll" in import_summary["importLibraries"]
            and import_summary["resolverAndRuntimeMetadataApis"]["GetProcAddress"] is False
            and import_summary["resolverAndRuntimeMetadataApis"]["GetModuleHandleA"] is True
            and import_summary["delayImportDirectory"]["parseStatus"]
            == "directory RVA lies in virtual section bytes without a raw-file mapping",
            "static/delay import resolver summary changed")
    require(export_summary["namedExportCount"] == 90 and export_summary["functionCount"] == 90
            and export_summary["nameFamilies"] == {"ags": 25, "libsamplerate": 19, "opus": 43, "other": 3}
            and export_summary["registrationOrDungeonsLikeNames"] == []
            and resolution["observedGetProcAddressEventCount"] == 21
            and resolution["resolvedSymbols"] == ["GetLastError", "IsUserAnAdmin", "SetLastError"]
            and {item["returnRva"] for item in resolution["resolverSites"]}
            == {"0x503a8b3", "0x504cdd5", "0x50cbe03"}
            and resolution["resultFeedsDispatcherTable"]
            == "not established by saved traces; no result-pointer dataflow or registration-array xref was captured",
            "static export or saved resolver-cluster evidence changed")
    adjacent_dll = boundary["unverifiedAdjacentDll"]
    require(adjacent_dll["staticallyImportedByMainImage"] is True
            and adjacent_dll["distributionAuthenticity"] == "unverified local adjacent DLL"
            and "not promoted as Dungeons game code" in adjacent_dll["assessment"],
            "adjacent WINMM relationship was promoted beyond its evidence")
    require(boundary["d3EntryGate"]["decision"] == "NOT FOUND"
            and boundary["d3EntryGate"]["stableOrOriginalNativeCodeCandidate"] is False
            and boundary["d3EntryGate"]["nativeClassFunctionIdentificationMechanism"] is False
            and boundary["exhaustionAssessment"]["finalDecision"]
            == "CURRENT-ENVIRONMENT STATIC NATIVE EXHAUSTED"
            and boundary["exhaustionAssessment"]["untestedEvidenceSourceRemainingInCurrentLocalSet"] == [],
            "D-3 gate or static exhaustion assessment is inconsistent")
    require(runtime_tables["analysisBaselineCommit"] == startup["analysisBaselineCommit"],
            "runtime-function-table assessment baseline differs from the startup map")
    require(runtime_tables["binarySha256"] == exe_hash and runtime_tables["stage1Sha256"] == stage_hash,
            "runtime-function-table input hashes differ from the Native inventory")
    require(runtime_tables["status"] == "research-only" and runtime_tables["runtimePromotion"] is False
            and runtime_tables["applicationImpact"] is False,
            "runtime-function-table assessment must stay research-only")
    runtime_script = resolve_native_ref(runtime_tables["analysisScript"]["path"], "runtimeTables.analysisScript.path")
    runtime_script_hash = sha(runtime_tables["analysisScript"]["sha256"], "runtimeTables.analysisScript.sha256")
    require(runtime_script == analysis_script and hashlib.sha256(runtime_script.read_bytes()).hexdigest() == runtime_script_hash
            == analysis_script_hash,
            "runtime-function-table provenance does not match the static analyzer source")
    runtime_api_names = {
        "RtlAddFunctionTable", "RtlDeleteFunctionTable", "RtlInstallFunctionTableCallback",
        "RtlAddGrowableFunctionTable", "RtlGrowFunctionTable", "RtlDeleteGrowableFunctionTable",
    }
    runtime_assessments = {item["api"]: item for item in runtime_tables["apiAssessment"]}
    require(set(runtime_assessments) >= runtime_api_names, "runtime-function-table API set is incomplete")
    require(all(runtime_assessments[name]["imported"] is False
                and runtime_assessments[name]["literalOccurrences"] == []
                and runtime_assessments[name]["observedInSavedSyntheticProfiles"] is False
                for name in runtime_api_names),
            "runtime registration APIs unexpectedly appear in the bounded import/literal/trace checks")
    require(runtime_tables["scope"]["staticImportDirectory"]["targetApiImports"] == []
            and runtime_tables["syntheticResolutionObservations"]["runtimeFunctionRegistrationCalls"] == [],
            "runtime registration API evidence changed")
    require(runtime_tables["assessment"]["registrationObserved"] is False
            and runtime_tables["assessment"]["runtimeMetadataGenerationResolved"] is False
            and runtime_tables["assessment"]["runtimeTableBase"] is None
            and runtime_tables["assessment"]["runtimeTableEntryCount"] is None
            and runtime_tables["assessment"]["targetCodeRegion"] is None,
            "unresolved runtime metadata fields must remain explicitly unknown")
    return_positions = startup["negativeEvidence"]["conditionalTraceApiReturnPositions"]
    require(return_positions["observationCount"] == 74 and return_positions["uniqueRvaCount"] == 58
            and return_positions["listedRangeMatches"] == 0 and return_positions["returnRvaIsFunctionEntry"] is False,
            "conditional API return range-miss evidence changed or lost its function-entry warning")
    exception_rows = startup["negativeEvidence"]["exceptionDirectory"]
    require(exception_rows["entryCount"] == 236168 and exception_rows["nonzeroEntries"] == 236168
            and exception_rows["entriesWithBeginLessThanEnd"] == 236168,
            "exception-directory evidence differs from the pinned D-2 input")
    correlated_ebx_bit_branch = startup["smbios"]["correlatedEbxBitBranch"]
    branch_instructions = [(item["mnemonic"], item["operands"]) for item in correlated_ebx_bit_branch["instructionEvidence"]]
    require(branch_instructions == [("and", "ebx, 1"), ("je", "0x144e9938c")],
            "identified correlated EBX bit-test branch instruction sequence changed")
    require(correlated_ebx_bit_branch["counterfactualCaptures"]["zeroSize"]["observedSuccessor"] == "0x4e9935b"
            and correlated_ebx_bit_branch["counterfactualCaptures"]["positiveSize"]["observedSuccessor"] == "0x4e9938c",
            "paired branch captures no longer show their recorded synthetic successors")
    dispatcher_state = startup["smbios"]["dispatcherStateRecovery"]
    writer = dispatcher_state["slotRelocationLoop"]["capturedSlotWrite"]
    require(writer["writerRva"] == "0x4eaf54d" and writer["instruction"] == "add qword ptr [r14], rcx"
            and writer["slotRva"] == "0x4ed272d" and writer["sourceValue"] == "0x140000000"
            and writer["beforeQword"] == "0x4be79a4" and writer["afterQword"] == "0x144be79a4"
            and writer["slotIndexFromLoopBase"] == "0x4aa",
            "focused dispatch-slot writer evidence changed")
    paired_flows = {item["profile"]: item for item in dispatcher_state["apiReturnStateTransfer"]["pairedSyntheticProfiles"]}
    require(set(paired_flows) == {"firmware-zero-size", "firmware-success-size"},
            "paired modeled RSMB return profiles are incomplete")
    zero_flow = paired_flows["firmware-zero-size"]["checkpoints"]
    positive_flow = paired_flows["firmware-success-size"]["checkpoints"]
    for profile, expected_value in (("firmware-zero-size", 0), ("firmware-success-size", 0x1000)):
        profile_flow = paired_flows[profile]
        checkpoints = profile_flow["checkpoints"]
        modeled_return = profile_flow["modeledApiReturn"]
        dispatcher_rax = int(checkpoints["0x4ebd3c1"]["registers"]["rax"], 16)
        saved_stack_value = int(checkpoints["0x4ebd5f9"]["savedApiReturnAtRspPlus0x78"], 16)
        stack_pop_value = int(checkpoints["0x4dd6b04"]["stackValueBeforePop"], 16)
        r11_state_write_value = int(checkpoints["0x4dd6b06"]["registers"]["r11"], 16)
        state_qword_after_write = int.from_bytes(
            bytes.fromhex(checkpoints["0x4dd6b09"]["destinationAfterWrite"]), "little")
        compared_dword = int(checkpoints["0x4c77f97"]["comparedMemoryDword"], 16)
        chain_values = (modeled_return, dispatcher_rax, saved_stack_value, stack_pop_value,
                        r11_state_write_value, state_qword_after_write, compared_dword)
        require(all(value == expected_value for value in chain_values),
                f"modeled RSMB return-to-compare value chain changed in {profile}: {chain_values}")

        state_addresses = (
            checkpoints["0x4dd6b06"]["destinationBeforeWriteAddress"],
            checkpoints["0x4dd6b09"]["destinationAfterWriteAddress"],
            checkpoints["0x4c77f97"]["comparedMemoryAddress"],
        )
        require(all(int(address, 16) == 0x144BE849B for address in state_addresses)
                and len(set(state_addresses)) == 1,
                f"state-cell write/read address continuity changed in {profile}: {state_addresses}")
    require(zero_flow["0x4dd6b09"]["destinationAfterWrite"] == "0000000000000000"
            and positive_flow["0x4dd6b09"]["destinationAfterWrite"] == "0010000000000000"
            and zero_flow["0x4c77f97"]["comparedMemoryDword"] == "0x0"
            and positive_flow["0x4c77f97"]["comparedMemoryDword"] == "0x1000",
            "paired RSMB return-to-memory comparison evidence changed")
    transfer = dispatcher_state["apiReturnStateTransfer"]
    require(transfer["causalConnectionToEbx"] is True
            and transfer["causalConnectionScope"].startswith("paired conditional Unicorn traces"),
            "paired synthetic compare-flags-to-EBX dataflow must be recorded with its scope")
    flags_flows = {item["profile"]: item for item in transfer["flagsToEbxTransfer"]}
    require(set(flags_flows) == {"firmware-zero-size", "firmware-success-size"},
            "paired compare-flags-to-EBX profiles are incomplete")
    zero_flags = flags_flows["firmware-zero-size"]
    positive_flags = flags_flows["firmware-success-size"]
    require(zero_flags["savedCompareFlags"] == "0x293" and zero_flags["carryFlagBit"] == 1
            and zero_flags["ebxBeforeAnd"] == "0x293"
            and zero_flags["observedBranchSuccessor"] == "0x4e9935b",
            "zero-size synthetic flags-to-EBX branch evidence changed")
    require(positive_flags["savedCompareFlags"] == "0x212" and positive_flags["carryFlagBit"] == 0
            and positive_flags["ebxBeforeAnd"] == "0x212"
            and positive_flags["observedBranchSuccessor"] == "0x4e9938c",
            "positive-size synthetic flags-to-EBX branch evidence changed")
    for profile_flow in flags_flows.values():
        path = profile_flow["dynamicPath"]
        require(path[0]["rva"] == "0x4e99160" and path[0]["instruction"] == "mov ebx, dword ptr [rbx]"
                and path[1]["rva"] == "0x4e99162"
                and path[-1]["rva"] == "0x4e9934f" and path[-1]["instruction"] == "and ebx, 1"
                and profile_flow["ebxUnchangedFromReloadToBitTest"] is True
                and all(item["ebxBefore"] == profile_flow["ebxBeforeAnd"] for item in path[1:]),
                f"dynamic EBX preservation path is inconsistent for {profile_flow['profile']}")
        require(profile_flow["stateCellWrite"]["address"] == profile_flow["stateCellReload"]["address"]
                and int(profile_flow["stateCellWrite"]["value"], 16)
                == int.from_bytes(bytes.fromhex(profile_flow["stateCellReload"]["dwordBytes"]), "little")
                == int(profile_flow["ebxBeforeAnd"], 16),
                f"flags state-cell transfer is inconsistent for {profile_flow['profile']}")
    recorded_flows = {item["profile"]: item for item in branch_flow["profilePair"]}
    for profile, flow in flags_flows.items():
        recorded = recorded_flows[profile]
        require(recorded["savedCompareFlags"] == flow["savedCompareFlags"]
                and recorded["ebxBeforeAnd"] == flow["ebxBeforeAnd"]
                and recorded["carryFlagBit"] == flow["carryFlagBit"]
                and recorded["observedBranchSuccessor"] == flow["observedBranchSuccessor"],
                f"firmware observation does not match startup trace evidence for {profile}")
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

    subprocess.run([sys.executable, "-B", str(NATIVE / "scripts/validate_self_file_artifacts.py")], check=True)
    subprocess.run([sys.executable, "-B", "-m", "unittest", "discover", "-s", str(NATIVE / "scripts"), "-p", "test_self_file*.py"], check=True)

    print(json.dumps({
        "status": "passed",
        "executableSha256": exe_hash,
        "stage1Sha256": stage_hash,
        "traceScriptSha256": actual_script_hash,
        "staticAnalysisScriptSha256": analysis_script_hash,
        "staticBoundarySurveyScriptSha256": boundary_script_hash,
        "d2StaticDecision": boundary["exhaustionAssessment"]["finalDecision"],
        "runtimeFunctionTableAssessment": "bounded-no-registration-observed",
        "priorArtProjects": len(project_ids),
        "functionCandidates": len(candidate_ids),
        "forbiddenFiles": 0,
        "privateGameInputsRequired": False,
    }, indent=2))


if __name__ == "__main__":
    main()
