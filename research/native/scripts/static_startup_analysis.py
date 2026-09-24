#!/usr/bin/env python3
"""Rebuild the bounded D-2 startup block map from private local inputs.

The executable, Stage 1 bytes, and saved conditional traces are read-only inputs.
Only the compact JSON evidence map is written to the repository.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import struct
import sys
from pathlib import Path


EXPECTED_EXE = "eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8"
EXPECTED_STAGE1 = "d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b"
BASELINE_COMMIT = "37d7d29ac2ffa799f476703eb5cf1d41285b1756"
IMAGE_BASE = 0x140000000
DUNGEON_RVA = 0x4BB8000
TRACE_PROFILES = (
    "firmware-data-generic",
    "firmware-zero-size",
    "firmware-success-size",
    "firmware-alt-size",
    "firmware-registry-failure",
    "firmware-registry-success",
    "firmware-registry-first-failure",
)
KEY_APIS = {
    "GetSystemFirmwareTable",
    "RegOpenKeyA",
    "RegQueryValueExA",
    "CreateFileW",
    "GetProcessHeap",
    "RtlAllocateHeap",
}
REGISTRATION_MARKERS = (
    "UClass",
    "UFunction",
    "UObject",
    "FNamePool",
    "GUObjectArray",
    "/Script/Dungeons",
    "ArmorGearItemInstance",
    "StaticClass",
    "Z_Construct_UClass",
    "CompiledInDefer",
    "NativeFunctionRegistrar",
    "RegisterNatives",
    "ProcessEvent",
    "GameplayEffect",
    "??_R0",
    ".?AV",
    "vftable",
    "vtable",
)
COMMON_PROLOGUES = (
    ("push-rbp-mov-rbp-rsp", bytes.fromhex("554889e5")),
    ("sub-rsp-imm8", bytes.fromhex("4883ec")),
    ("sub-rsp-imm32", bytes.fromhex("4881ec")),
    ("save-rbx-to-stack", bytes.fromhex("48895c24")),
    ("endbr64", bytes.fromhex("f30f1efa")),
)


def need(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class PEImage:
    def __init__(self, raw: bytes):
        need(raw[:2] == b"MZ", "executable has no MZ header")
        self.raw = raw
        self.pe_offset = struct.unpack_from("<I", raw, 0x3C)[0]
        need(raw[self.pe_offset:self.pe_offset + 4] == b"PE\0\0", "executable has no PE signature")
        coff = self.pe_offset + 4
        self.section_count = struct.unpack_from("<H", raw, coff + 2)[0]
        optional_size = struct.unpack_from("<H", raw, coff + 16)[0]
        self.optional = coff + 20
        need(struct.unpack_from("<H", raw, self.optional)[0] == 0x20B, "expected AMD64 PE32+")
        self.image_base = struct.unpack_from("<Q", raw, self.optional + 24)[0]
        self.image_size = struct.unpack_from("<I", raw, self.optional + 56)[0]
        self.directory_count = struct.unpack_from("<I", raw, self.optional + 108)[0]
        self.directory_offset = self.optional + 112
        self.sections = []
        table = self.optional + optional_size
        for index in range(self.section_count):
            offset = table + 40 * index
            name = raw[offset:offset + 8].rstrip(b"\0").decode("ascii", "replace")
            virtual_size, rva, raw_size, raw_offset = struct.unpack_from("<IIII", raw, offset + 8)
            flags = struct.unpack_from("<I", raw, offset + 36)[0]
            self.sections.append({
                "index": index,
                "name": name,
                "rva": rva,
                "virtualSize": virtual_size,
                "rawSize": raw_size,
                "rawOffset": raw_offset,
                "executable": bool(flags & 0x20000000),
            })

    def directory(self, index: int) -> tuple[int, int]:
        if index >= self.directory_count:
            return 0, 0
        return struct.unpack_from("<II", self.raw, self.directory_offset + index * 8)

    def initialized_bytes(self, rva: int, size: int, stage1: bytes) -> bytes | None:
        if DUNGEON_RVA <= rva and rva + size <= DUNGEON_RVA + len(stage1):
            return stage1[rva - DUNGEON_RVA:rva - DUNGEON_RVA + size]
        for section in self.sections:
            start = section["rva"]
            if start <= rva and rva + size <= start + section["rawSize"]:
                offset = section["rawOffset"] + rva - start
                return self.raw[offset:offset + size]
        return None

    def bytes_at(self, rva: int, size: int, stage1: bytes) -> bytes:
        result = self.initialized_bytes(rva, size, stage1)
        need(result is not None and len(result) == size, f"RVA {rva:#x} is not backed by input bytes")
        return result

    def section_for_rva(self, rva: int) -> dict | None:
        return next((section for section in self.sections
                     if section["rva"] <= rva < section["rva"] + max(section["virtualSize"], section["rawSize"])), None)


def import_capstone(local_root: Path):
    package_root = local_root / "phase6.8" / "native-stage2" / "tools"
    sys.path.insert(0, str(package_root))
    try:
        from capstone import Cs, CS_ARCH_X86, CS_MODE_64
    except ImportError as exc:
        raise SystemExit(f"FAIL: local Capstone package unavailable below {package_root}: {exc}") from exc
    engine = Cs(CS_ARCH_X86, CS_MODE_64)
    engine.detail = True
    return engine


def insn_record(insn: object, image_base: int) -> dict:
    return {
        "rva": hex(insn.address - image_base),
        "bytes": insn.bytes.hex(),
        "mnemonic": insn.mnemonic,
        "operands": insn.op_str,
    }


def decode_basic_block(pe: PEImage, stage1: bytes, engine: object, start_rva: int,
                       max_bytes: int = 0x6000) -> dict:
    start = start_rva - DUNGEON_RVA
    need(start >= 0 and start < len(stage1), f"basic-block RVA {start_rva:#x} is outside Stage 1")
    address = IMAGE_BASE + start_rva
    blob = stage1[start:min(len(stage1), start + max_bytes)]
    records = []
    terminator = None
    for insn in engine.disasm(blob, address):
        records.append(insn_record(insn, IMAGE_BASE))
        if insn.group(1):  # Capstone CS_GRP_JUMP
            terminator = insn
            break
        if insn.mnemonic in {"ret", "retf", "iret", "iretd", "iretq"}:
            terminator = insn
            break
    need(bool(records), f"Capstone could not decode basic block at {start_rva:#x}")
    end_rva = int(records[-1]["rva"], 16) + len(bytes.fromhex(records[-1]["bytes"]))
    successors = []
    if terminator is not None:
        if terminator.mnemonic.startswith("j") and terminator.operands:
            operand = terminator.operands[0]
            if operand.type == 2:
                target = operand.imm - IMAGE_BASE
                successors.append({"condition": terminator.mnemonic, "targetRva": hex(target), "kind": "direct"})
                if terminator.mnemonic not in {"jmp", "ljmp"}:
                    successors.append({"condition": "fallthrough", "targetRva": hex(end_rva), "kind": "direct"})
            else:
                successors.append({"condition": terminator.mnemonic, "targetRva": None, "kind": "indirect", "operand": terminator.op_str})
        elif terminator.mnemonic in {"ret", "retf", "iret", "iretd", "iretq"}:
            successors.append({"condition": terminator.mnemonic, "targetRva": None, "kind": "return"})
    return {
        "address": hex(start_rva),
        "range": [hex(start_rva), hex(end_rva)],
        "instructions": records,
        "terminator": records[-1],
        "successors": successors,
    }


def first_direct_api_tail(pe: PEImage, stage1: bytes, engine: object, rva: int) -> dict:
    block = decode_basic_block(pe, stage1, engine, rva)
    terminator = block["terminator"]
    direct = next((edge for edge in block["successors"] if edge["kind"] == "direct"), None)
    return {
        "returnRva": hex(rva),
        "blockRange": block["range"],
        "terminator": terminator,
        "directSuccessorRva": direct["targetRva"] if direct else None,
        "indirectSuccessor": next((edge for edge in block["successors"] if edge["kind"] == "indirect"), None),
        "conditionalEdgesBeforeTerminator": [item for item in block["instructions"][:-1]
                                              if item["mnemonic"].startswith("j")],
    }


def adjacent_call_sites(stage1: bytes, engine: object, rva: int) -> list[dict]:
    found = []
    for length in range(1, 16):
        start_rva = rva - length
        offset = start_rva - DUNGEON_RVA
        if offset < 0:
            continue
        for insn in engine.disasm(stage1[offset:offset + length], IMAGE_BASE + start_rva):
            if insn.address + insn.size == IMAGE_BASE + rva and insn.mnemonic.startswith("call"):
                found.append({
                    "rva": hex(insn.address - IMAGE_BASE),
                    "bytes": insn.bytes.hex(),
                    "mnemonic": insn.mnemonic,
                    "operands": insn.op_str,
                })
    return found


def load_trace(trace_root: Path, profile: str) -> dict:
    path = trace_root / profile / "api-trace.json"
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"FAIL: missing or invalid local trace {path}: {exc}") from exc
    need(value.get("profile") == profile, f"trace profile mismatch at {path}")
    return value


def checkpoint_for(trace: dict, rva: str, event_count: int) -> dict | None:
    return next((value for value in trace.get("registerCheckpoints", [])
                 if value.get("rva") == rva and value.get("eventCount") == event_count), None)


def snapshot_summary(value: dict | None) -> dict | None:
    if value is None:
        return None
    registers = value.get("registers", {})
    return {
        "rva": value.get("rva"),
        "eventCount": value.get("eventCount"),
        "rax": registers.get("rax"),
        "rbx": registers.get("rbx"),
        "eflags": registers.get("eflags"),
        "zeroFlag": bool(int(registers.get("eflags", "0"), 16) & 0x40),
        "indirectPointer": value.get("indirectPointer"),
        "indirectTarget": value.get("indirectTarget"),
    }


def scan_prologue_hits(pe: PEImage, stage1: bytes) -> dict:
    exception_rva, exception_size = pe.directory(3)
    table_offset = exception_rva - DUNGEON_RVA
    counts = collections.defaultdict(lambda: collections.Counter())
    entries_by_section = collections.Counter()
    for index in range(exception_size // 12):
        begin, end, _unwind = struct.unpack_from("<III", stage1, table_offset + index * 12)
        section = pe.section_for_rva(begin)
        if section is None or end <= begin:
            continue
        entries_by_section[section["index"]] += 1
        sample = pe.initialized_bytes(begin, 8, stage1) or b""
        for name, signature in COMMON_PROLOGUES:
            if sample.startswith(signature):
                counts[section["index"]][name] += 1
    return {
        "entryCountsBySectionIndex": {str(key): value for key, value in sorted(entries_by_section.items())},
        "commonPrologueSignatureHitsBySectionIndex": {
            str(key): {name: count for name, count in values.items()}
            for key, values in sorted(counts.items())
        },
        "patternsChecked": [name for name, _signature in COMMON_PROLOGUES],
        "interpretation": "A zero hit count is a bounded heuristic result and does not establish that no function exists.",
    }


def registration_marker_hits(regions: list[tuple[str, int, bytes]]) -> dict:
    result = {}
    for marker in REGISTRATION_MARKERS:
        needle = marker.encode("ascii")
        wide = marker.encode("utf-16le")
        hits = []
        for name, base_rva, blob in regions:
            for encoding, value in (("ascii", needle), ("utf16le", wide)):
                offset = blob.find(value)
                if offset >= 0:
                    hits.append({"region": name, "encoding": encoding, "rva": hex(base_rva + offset)})
        result[marker] = hits
    return result


def pointer_array_runs(pe: PEImage, stage1: bytes) -> list[dict]:
    executable = [(section["rva"], section["rva"] + max(section["virtualSize"], section["rawSize"]))
                  for section in pe.sections if section["executable"]]
    regions = []
    for section in pe.sections:
        if section["rawSize"]:
            start = section["rawOffset"]
            regions.append((section["name"] or f"section-{section['index']}", section["rva"],
                            pe.raw[start:start + section["rawSize"]]))
    regions.append((".dungeon-stage1", DUNGEON_RVA, stage1))
    runs = []
    for name, base_rva, blob in regions:
        index = 0
        while index + 8 <= len(blob):
            value = struct.unpack_from("<Q", blob, index)[0]
            in_executable = any(pe.image_base + start <= value < pe.image_base + end for start, end in executable)
            if not in_executable:
                index += 8
                continue
            start = index
            values = []
            while index + 8 <= len(blob):
                value = struct.unpack_from("<Q", blob, index)[0]
                if not any(pe.image_base + a <= value < pe.image_base + b for a, b in executable):
                    break
                values.append(value)
                index += 8
            if len(values) >= 3:
                runs.append({"region": name, "rva": hex(base_rva + start), "pointerCount": len(values)})
    return runs


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-data", type=Path, default=Path(os.environ.get("MCD_LOCAL_GAME_DATA_ROOT", repo_root / "local-game-data")))
    parser.add_argument("--exe", type=Path)
    parser.add_argument("--stage1", type=Path)
    parser.add_argument("--trace-root", type=Path)
    parser.add_argument("--output", type=Path, default=repo_root / "research/native/startup-block-map.json")
    args = parser.parse_args()
    local_root = args.local_data.expanduser().resolve()
    exe_path = args.exe or local_root / "archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe"
    stage_path = args.stage1 or local_root / "phase6.8/mechanics/stage1.bin"
    trace_root = args.trace_root or local_root / "phase6.8/native-stage2/firmware-experiments"
    exe_bytes = exe_path.read_bytes()
    stage1 = stage_path.read_bytes()
    exe_hash = sha256(exe_bytes)
    stage_hash = sha256(stage1)
    need(exe_hash == EXPECTED_EXE, "unexpected executable SHA-256")
    need(stage_hash == EXPECTED_STAGE1, "unexpected Stage 1 SHA-256")
    need(len(stage1) == 15_360_000, "unexpected Stage 1 byte length")
    pe = PEImage(exe_bytes)
    need(pe.image_base == IMAGE_BASE, "unexpected PE image base")
    engine = import_capstone(local_root)

    traces = {profile: load_trace(trace_root, profile) for profile in TRACE_PROFILES}
    generic = traces["firmware-data-generic"]
    positions = [int(event["returnRva"], 16) for event in generic.get("events", []) if event.get("returnRva")]
    need(len(positions) == 74, f"expected 74 saved API return observations, found {len(positions)}")
    unique_positions = sorted(set(positions))

    exception_rva, exception_size = pe.directory(3)
    need(exception_rva >= DUNGEON_RVA and exception_rva + exception_size <= DUNGEON_RVA + len(stage1), "exception table is not in Stage 1 bytes")
    exception_offset = exception_rva - DUNGEON_RVA
    rows = [struct.unpack_from("<III", stage1, exception_offset + index * 12)
            for index in range(exception_size // 12)]
    nonzero_rows = [row for row in rows if any(row)]
    valid_ranges = [row for row in rows if row[0] < row[1]]
    require_count = len(positions)
    matching_positions = [position for position in positions
                          if any(begin <= position < end for begin, end, _unwind in valid_ranges)]
    need(len(rows) == 236_168 and len(nonzero_rows) == 236_168 and len(valid_ranges) == 236_168,
         "exception-directory counts differ from the saved D-2 observation")
    need(not matching_positions, "an API return observation unexpectedly matched a listed range")

    unwind_backed = sum(pe.initialized_bytes(unwind, 4, stage1) is not None for _begin, _end, unwind in rows)
    unwind_unbacked = len(rows) - unwind_backed

    def profile_return(profile: str, api_name: str, return_rva: str) -> dict:
        return next((event for event in traces[profile].get("events", [])
                     if event.get("name") == api_name and event.get("returnRva") == return_rva), {})

    key_returns = {}
    for profile, trace in traces.items():
        for event in trace.get("events", []):
            if event.get("name") not in KEY_APIS or not event.get("returnRva"):
                continue
            rva = int(event["returnRva"], 16)
            key = (event["name"], rva)
            info = key_returns.setdefault(key, {
                "api": event["name"],
                "returnRva": hex(rva),
                "requestedPath": event.get("requestedPath"),
                "traceProfiles": [],
                "observedArguments": event.get("args", []),
            })
            if profile not in info["traceProfiles"]:
                info["traceProfiles"].append(profile)
            if event.get("requestedPath"):
                info["requestedPath"] = event["requestedPath"]

    api_edges = []
    for info in key_returns.values():
        rva = int(info["returnRva"], 16)
        edge = first_direct_api_tail(pe, stage1, engine, rva)
        adjacent = adjacent_call_sites(stage1, engine, rva)
        info["staticContinuation"] = edge
        info["adjacentCallInstructionsEndingAtReturnRva"] = adjacent
        api_edges.append({
            "api": info["api"],
            "returnRva": info["returnRva"],
            "requestedPath": info.get("requestedPath"),
            "directSuccessorRva": edge["directSuccessorRva"],
            "adjacentCallInstructionFound": bool(adjacent),
            "traceProfiles": info["traceProfiles"],
        })

    transfer_counts = collections.Counter(edge["directSuccessorRva"] for edge in api_edges if edge["directSuccessorRva"])
    rsm_first = decode_basic_block(pe, stage1, engine, 0x50D0FE9)
    rsm_second = decode_basic_block(pe, stage1, engine, 0x50D1349)
    correlated_ebx_bit_branch = decode_basic_block(pe, stage1, engine, 0x4E9934F)
    dispatcher_entry = decode_basic_block(pe, stage1, engine, 0x4EBD3C1)

    zero_trace = traces["firmware-zero-size"]
    positive_trace = traces["firmware-success-size"]
    zero_first = profile_return("firmware-zero-size", "GetSystemFirmwareTable", "0x50d0fe9")
    positive_first = profile_return("firmware-success-size", "GetSystemFirmwareTable", "0x50d0fe9")
    need(zero_first and positive_first, "missing paired first RSMB API observations")
    zero_event_count = sum(1 for event in zero_trace.get("events", [])
                           if event is zero_first)
    positive_event_count = sum(1 for event in positive_trace.get("events", [])
                               if event is positive_first)
    # Captures are taken just after the API event is appended; select that exact count.
    zero_count = next((index + 1 for index, event in enumerate(zero_trace["events"]) if event.get("name") == "GetSystemFirmwareTable" and event.get("returnRva") == "0x50d0fe9"), None)
    positive_count = next((index + 1 for index, event in enumerate(positive_trace["events"]) if event.get("name") == "GetSystemFirmwareTable" and event.get("returnRva") == "0x50d0fe9"), None)
    need(zero_count is not None and positive_count is not None, "could not align RSMB events to register checkpoints")
    zero_branch = snapshot_summary(checkpoint_for(zero_trace, "0x4e9934f", zero_count))
    zero_je = snapshot_summary(checkpoint_for(zero_trace, "0x4e99355", zero_count))
    zero_fallthrough = snapshot_summary(checkpoint_for(zero_trace, "0x4e9935b", zero_count))
    positive_branch = snapshot_summary(checkpoint_for(positive_trace, "0x4e9934f", positive_count))
    positive_je = snapshot_summary(checkpoint_for(positive_trace, "0x4e99355", positive_count))
    positive_taken = snapshot_summary(checkpoint_for(positive_trace, "0x4e9938c", positive_count))
    need(all((zero_branch, zero_je, zero_fallthrough, positive_branch, positive_je, positive_taken)),
         "focused register checkpoints at the recovered branch are incomplete")

    def allocation_flow(profile: str) -> dict:
        trace = traces[profile]
        events = trace.get("events", [])
        first_index = next(index for index, event in enumerate(events)
                           if event.get("name") == "GetSystemFirmwareTable" and event.get("returnRva") == "0x50d0fe9")
        second_index = next((index for index, event in enumerate(events)
                            if index > first_index and event.get("name") == "GetSystemFirmwareTable" and event.get("returnRva") == "0x50d1349"), None)
        if second_index is None:
            return {"profile": profile, "secondCallObserved": False}
        intervening = events[first_index + 1:second_index]
        allocation = next((event for event in intervening
                           if event.get("name") in {"HeapAlloc", "RtlAllocateHeap"}), None)
        second = events[second_index]
        return {
            "profile": profile,
            "modeledFirstReturn": events[first_index].get("modeledReturn"),
            "allocationApi": allocation.get("name") if allocation else None,
            "allocationBytes": allocation.get("allocationBytes") if allocation else None,
            "allocationPointer": allocation.get("modeledReturn") if allocation else None,
            "secondCallObserved": True,
            "secondCallArguments": second.get("args"),
            "secondCallReturnRva": second.get("returnRva"),
            "secondCallStopAt": second.get("stopAt"),
        }

    allocation_flows = [allocation_flow(profile) for profile in ("firmware-alt-size", "firmware-success-size")]
    need(all(flow["allocationBytes"] == (0x400 if flow["profile"] == "firmware-alt-size" else 0x1000)
             and flow["secondCallObserved"] for flow in allocation_flows), "positive-size allocation flow differs from saved traces")

    dispatch_capture = checkpoint_for(positive_trace, "0x4ebdde7", positive_count)
    need(dispatch_capture is not None and dispatch_capture.get("indirectTarget"), "missing computed-dispatch register capture")
    dispatch_slot_rva = int(dispatch_capture["indirectPointer"], 16) - IMAGE_BASE
    dispatch_target_va = int(dispatch_capture["indirectTarget"], 16)
    static_slot = pe.bytes_at(dispatch_slot_rva, 8, stage1)
    dynamic_snapshot_path = trace_root / "firmware-success-size" / "api-dungeon.bin"
    dynamic_snapshot = dynamic_snapshot_path.read_bytes()
    dynamic_slot = dynamic_snapshot[dispatch_slot_rva - DUNGEON_RVA:dispatch_slot_rva - DUNGEON_RVA + 8]
    slot_page_va = (IMAGE_BASE + dispatch_slot_rva) & ~0xFFF
    written_pages = positive_trace.get("writtenPages", {})
    static_slot_value = struct.unpack("<Q", static_slot)[0]
    indirect_target_rva = dispatch_target_va - IMAGE_BASE
    target_entry = decode_basic_block(pe, stage1, engine, indirect_target_rva)

    def mapped_unwind_rows() -> int:
        return sum(pe.initialized_bytes(unwind, 4, stage1) is not None for _begin, _end, unwind in rows)

    prologue_scan = scan_prologue_hits(pe, stage1)
    sections_with_bytes = []
    for section in pe.sections:
        if section["rawSize"]:
            start = section["rawOffset"]
            sections_with_bytes.append((section["name"] or f"section-{section['index']}", section["rva"],
                                        exe_bytes[start:start + section["rawSize"]]))
    sections_with_bytes.append((".dungeon-stage1", DUNGEON_RVA, stage1))
    marker_hits = registration_marker_hits(sections_with_bytes)
    pointer_runs = pointer_array_runs(pe, stage1)
    marker_hit_count = sum(bool(value) for value in marker_hits.values())

    registry_failure_calls = [
        {"api": event.get("name"), "requestedPath": event.get("requestedPath"),
         "returnRva": event.get("returnRva"), "arguments": event.get("args"),
         "modeledStatus": event.get("modeledStatus"), "stopAt": event.get("stopAt")}
        for event in traces["firmware-registry-failure"].get("events", [])
        if event.get("name") in {"RegOpenKeyA", "RegQueryValueExA", "CreateFileW"}
    ]
    registry_success_calls = [
        {"api": event.get("name"), "requestedPath": event.get("requestedPath"),
         "returnRva": event.get("returnRva"), "arguments": event.get("args"),
         "modeledStatus": event.get("modeledStatus"), "stopAt": event.get("stopAt")}
        for event in traces["firmware-registry-success"].get("events", [])
        if event.get("name") in {"RegOpenKeyA", "RegQueryValueExA", "CreateFileW"}
    ]

    api_return_rows = []
    for info in sorted(key_returns.values(), key=lambda value: (value["api"], value["returnRva"])):
        api_return_rows.append(info)

    result = {
        "schemaVersion": 1,
        "date": "2026-09-24",
        "status": "research-only",
        "runtimePromotion": False,
        "applicationImpact": False,
        "analysisBaselineCommit": BASELINE_COMMIT,
        "analysisScript": {
            "path": "scripts/static_startup_analysis.py",
            "sha256": sha256(Path(__file__).read_bytes()),
        },
        "binarySha256": exe_hash,
        "stage1Sha256": stage_hash,
        "imageBase": hex(IMAGE_BASE),
        "staticTools": {
            "used": ["Capstone 5.0.6", "read-only PE32+ parser"],
            "focusedDynamicConfirmation": ["Unicorn 2.1.4; existing synthetic profiles; unknown APIs still stop"],
            "availableButNotUsed": ["Apple LLVM objdump"],
            "notFoundOnPath": ["Ghidra", "radare2", "rizin", "llvm-objdump"],
        },
        "negativeEvidence": {
            "exceptionDirectory": {
                "rva": hex(exception_rva),
                "sizeBytes": exception_size,
                "entryCount": len(rows),
                "nonzeroEntries": len(nonzero_rows),
                "entriesWithBeginLessThanEnd": len(valid_ranges),
                "unwindInfoRvasBackedByInitializedInputBytes": mapped_unwind_rows(),
                "unwindInfoRvasNotBackedByInitializedInputBytes": unwind_unbacked,
                "warning": "A range miss or unbacked unwind-info RVA does not establish that an address is not a function.",
            },
            "conditionalTraceApiReturnPositions": {
                "profile": "firmware-data-generic",
                "observationCount": require_count,
                "uniqueRvaCount": len(unique_positions),
                "listedRangeMatches": len(matching_positions),
                "returnRvaIsFunctionEntry": False,
            },
        },
        "smbios": {
            "firstCall": {
                "provider": "RSMB",
                "tableId": 0,
                "arguments": ["0x52534d42", "0x0", "0x0", "0x0"],
                "returnRva": "0x50d0fe9",
                "continuationBlock": rsm_first,
                "importantRegisters": ["RAX holds modeled API return through continuation instructions", "RSP is repeatedly adjusted and restored"],
                "importantMemory": ["temporary values are moved through [RSP]"],
                "adjacentCallInstructionsEndingAtReturnRva": adjacent_call_sites(stage1, engine, 0x50D0FE9),
            },
            "secondCall": {
                "provider": "RSMB",
                "tableId": 0,
                "returnRva": "0x50d1349",
                "continuationBlock": rsm_second,
                "adjacentCallInstructionsEndingAtReturnRva": adjacent_call_sites(stage1, engine, 0x50D1349),
            },
            "dispatcherCandidate": {
                "binarySha256": exe_hash,
                "address": "0x4ebd3c1",
                "range": ["0x4ebd3c1", "0x4ebdde9"],
                "rangeInterpretation": "bounded inspected span; not a claimed function extent",
                "kind": "dispatcher",
                "boundaryEvidence": [
                    "Direct tail-jump target of the first and second RSMB continuations and the listed RegOpenKeyA/RegQueryValueExA continuations.",
                    "Contains call-next at 0x4ebd3c1, a lock cmpxchg spin loop at 0x4ebd715, and indirect jmp qword ptr [RAX] at 0x4ebdde7.",
                ],
                "predecessors": [edge["returnRva"] for edge in api_edges if edge["directSuccessorRva"] == "0x4ebd3c1"],
                "successors": [
                    {"address": "0x4ebd71a", "condition": "je", "target": "0x4ebd727"},
                    {"address": "0x4ebd722", "condition": "unconditional", "target": "0x4ebd713"},
                    {"address": "0x4ebdde7", "condition": "indirect jmp [RAX]", "target": "runtime table value"},
                ],
                "calls": [{"address": "0x4ebd3c1", "target": "0x4ebd3c6", "interpretation": "call to the next instruction; not treated as a function call"}],
                "importantRegisters": ["RAX is used as the indirect-jump pointer at 0x4ebdde7", "RBX/RBP participate in lock cmpxchg at [RBX+RBP]"],
                "importantMemory": ["indirect dispatch reads a qword through RAX", "the key observed dispatch slot is in .dungeon at RVA 0x4ed272d"],
                "confidence": "high for direct edges and decoded instructions; medium for dispatcher interpretation",
                "limitations": ["No conventional function boundary was established.", "The saved model does not establish Windows behavior or a protector product.", "The dispatcher's subsequent state/dataflow is not fully recovered."],
            },
            "correlatedEbxBitBranch": {
                "binarySha256": exe_hash,
                "address": "0x4e9934f",
                "range": correlated_ebx_bit_branch["range"],
                "kind": "basic-block",
                "boundaryEvidence": "and ebx, 1 sets flags; the following je ends this block.",
                "predecessors": ["dispatcher route from 0x4ebd3c1 observed in paired conditional traces; exact state-transfer chain remains unresolved"],
                "successors": correlated_ebx_bit_branch["successors"],
                "calls": [],
                "importantRegisters": ["EBX bit 0 is the tested input", "ZF controls the JE at 0x4e99355"],
                "importantMemory": [],
                "confidence": "high for the compare/branch and its successors; medium for trace correlation to modeled size",
                "limitations": ["Static dataflow from RAX at 0x50d0fe9 through dispatcher state to EBX bit 0 is unresolved."],
                "counterfactualCaptures": {
                    "zeroSize": {"modeledApiReturn": zero_first.get("modeledReturn"), "beforeAnd": zero_branch, "atJe": zero_je, "observedSuccessor": zero_fallthrough["rva"]},
                    "positiveSize": {"modeledApiReturn": positive_first.get("modeledReturn"), "beforeAnd": positive_branch, "atJe": positive_je, "observedSuccessor": positive_taken["rva"]},
                },
                "instructionEvidence": correlated_ebx_bit_branch["instructions"],
            },
            "positiveSizeAllocationFlows": allocation_flows,
            "computedDispatchObservation": {
                "indirectJumpRva": "0x4ebdde7",
                "operand": "qword ptr [RAX]",
                "pointerSlotRva": hex(dispatch_slot_rva),
                "stage1PointerSlotQword": hex(static_slot_value),
                "postTracePointerSlotQword": hex(struct.unpack("<Q", dynamic_slot)[0]),
                "postTraceTargetVa": hex(dispatch_target_va),
                "postTraceTargetRva": hex(indirect_target_rva),
                "targetFirstBasicBlock": target_entry,
                "writtenPageCountAtSlotPage": written_pages.get(hex(slot_page_va)),
                "interpretation": "Conditional emulation materialized an absolute dispatch pointer in a .dungeon data slot. This is evidence for runtime-written dispatch data, not by itself evidence that executable instructions were rewritten.",
            },
        },
        "registryAndFileProbes": {
            "apiReturnEdges": [edge for edge in api_edges if edge["api"] in {"RegOpenKeyA", "RegQueryValueExA", "CreateFileW"}],
            "allKeysMissingCounterfactual": registry_failure_calls,
            "firstKeySuccessCounterfactual": registry_success_calls,
            "executionUnitAssessment": "RegOpenKeyA and RegQueryValueExA return continuations share the 0x4ebd3c1 dispatcher candidate; CreateFileW reaches 0x4eb0c51. Profiles show sequential probes under synthetic API responses, but do not prove one function or a real-machine environment decision.",
            "pathInterpretation": "Registry strings are recorded as API arguments only; no purpose is inferred from them.",
        },
        "executionRecoveryMethods": {
            "recursiveDescent": "Seeded at observed API continuations and followed direct transfers to the bounded dispatcher/branch blocks; stopped at computed dispatch where targets depend on runtime state.",
            "basicBlockGraph": "Recovered the two RSMB return blocks, shared dispatcher tail targets, lock-loop edges, the EBX bit-test branch, and API-return helper edges.",
            "directBranchTargets": "Direct JMPs from observed continuations and conditional successors were decoded with Capstone.",
            "callTargetDiscovery": "No adjacent call instruction ends at the observed API return RVAs in the preceding 15 bytes; call/wrapper identity remains unresolved. Call-next and indirect dispatch patterns were recorded separately.",
            "stackConsistency": "Repeated RSP arithmetic, stack swaps, and [RSP] moves appear in the continuations; no stable prologue/epilogue or function frame was established.",
            "prologueEpilogueHeuristics": "Common x64 prologue signatures had zero hits at listed exception-range starts in sections 0 and 13; this is a bounded heuristic, not a function-absence result.",
            "returnSiteClustering": "74 observations (58 distinct RVAs) from one saved trace profile; all miss listed exception ranges, while multiple API groups tail-jump to shared targets.",
            "indirectDispatch": "jmp qword ptr [RAX] at 0x4ebdde7 reads a .dungeon data slot whose value is materialized as an absolute address in the focused trace.",
            "runtimeWrittenCode": "No instruction-byte change was found at the sampled continuation, branch, dispatcher, or indirect-target instructions; one dispatch-data qword changed during the conditional emulation.",
            "confidencePolicy": "No single heuristic assigns function identity; dispatcher/helper labels are candidates only.",
        },
        "stableGameCodeSearch": {
            "candidateFound": False,
            "registrationMechanismFound": False,
            "functionCandidateAccepted": 0,
            "boundedChecks": {
                "listedExceptionRangeStarts": prologue_scan,
                "registrationMarkerHits": marker_hits,
                "vtableLikeExecutablePointerRunsLengthAtLeast3": pointer_runs,
                "searchedInputs": ["original initialized PE raw sections", "Stage 1 .dungeon bytes"],
            },
            "conclusion": "No stable UE4/Dungeons function or native registration candidate met the evidence threshold. This bounded negative result does not prove the executable contains no such code.",
        },
        "limitations": [
            "The archive distribution authenticity is unverified; hashes pin local identity only.",
            "The static bytes come from the saved 15,360,000-byte Stage 1 output, not a full reconstructed executable.",
            "All branch register comparisons are Unicorn counterfactuals with synthetic API results, not Windows observations.",
            "The API callsites may be wrapper/tail-call dispatched; an API return RVA is not treated as a function entry.",
            "Unwind-range misses and unreadable unwind-info RVAs do not imply that code is not a function.",
            "No UE4 registration, gameplay native function, D-3 mechanic, or runtime promotion was established.",
        ],
    }
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({
        "status": "written",
        "output": str(output),
        "binarySha256": exe_hash,
        "apiReturnObservations": len(positions),
        "uniqueApiReturnRvas": len(unique_positions),
        "exceptionEntries": len(rows),
        "rangeMatches": len(matching_positions),
        "unwindInfoBacked": unwind_backed,
        "stableGameCodeCandidateFound": result["stableGameCodeSearch"]["candidateFound"],
    }, indent=2))


if __name__ == "__main__":
    main()
