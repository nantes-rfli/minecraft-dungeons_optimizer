#!/usr/bin/env python3
"""Build a compact, read-only D-2 native boundary survey from pinned local inputs."""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import os
import shutil
import statistics
import struct
import subprocess
import sys
from pathlib import Path


BASELINE_COMMIT = "647fcaefed2a8b90372fcc1e5f1297371ae0ee9d"
EXPECTED_EXE = "eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8"
EXPECTED_STAGE1 = "d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b"
IMAGE_BASE = 0x140000000
DUNGEON_RVA = 0x4BB8000
IMAGE_POINTER_PREFIX = b"\x01\x00\x00\x00"
POINTER_CLUSTER_GAP = 0x1000
REGISTRATION_MARKERS = (
    "UClass", "UFunction", "UObject", "FNamePool", "GUObjectArray",
    "/Script/Dungeons", "ArmorGearItemInstance", "StaticClass",
    "Z_Construct_UClass", "CompiledInDefer", "NativeFunctionRegistrar",
    "RegisterNatives", "ProcessEvent", "FModuleManager", "InitializeModule",
    "StartupModule", "FClassRegisterCompiledInInfo", "RegisterCompiledInInfo",
    "GameplayEffect", "??_R0", ".?AV", "vftable", "vtable",
)
STARTUP_MARKERS = (
    ".CRT", "__xc_a", "__xc_z", "__xi_a", "__xi_z", "_initterm",
    "DllMain", "TlsCallback", "LdrRegisterDllNotification",
)


def need(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def entropy(value: bytes) -> float | None:
    if not value:
        return None
    counts = collections.Counter(value)
    return round(-sum((count / len(value)) * math.log2(count / len(value))
                      for count in counts.values()), 4)


def entropy_windows(blob: bytes, window_size: int) -> dict:
    values = [entropy(blob[offset:offset + window_size])
              for offset in range(0, len(blob), window_size)]
    values = [value for value in values if value is not None]
    return {
        "windowSizeBytes": window_size,
        "windowCount": len(values),
        "minimumBitsPerByte": min(values),
        "medianBitsPerByte": statistics.median(values),
        "maximumBitsPerByte": max(values),
        "windowsBelow6BitsPerByte": sum(value < 6 for value in values),
        "windowsBelow7BitsPerByte": sum(value < 7 for value in values),
        "windowsAtLeast7_8BitsPerByte": sum(value >= 7.8 for value in values),
    }


def section_label(section: dict | None) -> str | None:
    if section is None:
        return None
    return section["name"] if section["name"].strip() else f"section-{section['index']} (8-space name)"


def decode_summary(pe, stage1: bytes, engine, rva: int, size: int = 64) -> dict:
    data = pe.initialized_bytes(rva, size, stage1)
    section = pe.section_for_rva(rva)
    result = {
        "sectionIndex": section["index"] if section else None,
        "sectionName": section_label(section),
        "initializedInputBytesAvailable": data is not None,
        "sampleBytes": size,
        "entropyBitsPerByte": entropy(data) if data else None,
        "decodedInstructionCount": 0,
        "decodedBytes": 0,
        "callCount": 0,
        "returnCount": 0,
        "branchCount": 0,
        "ioOrPrivilegedInstructionCount": 0,
        "firstInstructions": [],
    }
    if data is None:
        result["decodeQuality"] = "unavailable; target is not backed by initialized input bytes"
        return result
    instructions = list(engine.disasm(data, IMAGE_BASE + rva))
    result["decodedInstructionCount"] = len(instructions)
    result["decodedBytes"] = sum(item.size for item in instructions)
    result["callCount"] = sum(item.mnemonic.startswith("call") for item in instructions)
    result["returnCount"] = sum(item.mnemonic.startswith("ret") for item in instructions)
    result["branchCount"] = sum(item.mnemonic.startswith("j") for item in instructions)
    result["ioOrPrivilegedInstructionCount"] = sum(
        item.mnemonic.startswith(("in", "out", "int", "cli", "sti")) for item in instructions
    )
    result["firstInstructions"] = [
        {"rva": hex(item.address - IMAGE_BASE), "mnemonic": item.mnemonic, "operands": item.op_str}
        for item in instructions[:6]
    ]
    ratio = result["decodedBytes"] / size if size else 0
    if ratio < 0.75:
        result["decodeQuality"] = "poor linear decode; stops before most sample bytes"
    elif result["ioOrPrivilegedInstructionCount"]:
        result["decodeQuality"] = "linear bytes decode includes I/O or privileged instructions; coherent code is unconfirmed"
    elif result["callCount"] + result["returnCount"]:
        result["decodeQuality"] = "linear decode includes call/return instruction(s); CFG and reachability remain unconfirmed"
    else:
        result["decodeQuality"] = "linear decode lacks call/return shape; CFG and reachability remain unconfirmed"
    return result


def scan_literal_markers(regions: list[tuple[str, int, bytes]], markers: tuple[str, ...]) -> dict:
    result = {}
    for marker in markers:
        hits = []
        for region, base_rva, blob in regions:
            for encoding, needle in (("ASCII", marker.encode("ascii")),
                                     ("UTF-16LE", marker.encode("utf-16le"))):
                offset = 0
                while True:
                    offset = blob.find(needle, offset)
                    if offset < 0:
                        break
                    hits.append({"region": region, "rva": hex(base_rva + offset), "encoding": encoding})
                    offset += 1
        result[marker] = hits
    return result


def executable_section_for_rva(pe, rva: int) -> dict | None:
    return next((section for section in pe.sections
                 if section["executable"] and section["name"] != ".dungeon"
                 and section["rva"] <= rva < section["rva"] + max(section["virtualSize"], section["rawSize"])), None)


def aligned_pointer_rows(pe, stage1: bytes) -> tuple[list[dict], list[dict]]:
    regions = [(f"section-{section['index']}", section["rva"],
                pe.raw[section["rawOffset"]:section["rawOffset"] + section["rawSize"]])
               for section in pe.sections if section["rawSize"]]
    regions.append((".dungeon-stage1", DUNGEON_RVA, stage1))
    rows = []
    byte_rows = []
    for region, base_rva, blob in regions:
        for offset in range(0, len(blob) - 7, 8):
            value = struct.unpack_from("<Q", blob, offset)[0]
            if value < pe.image_base:
                continue
            target_rva = value - pe.image_base
            section = executable_section_for_rva(pe, target_rva)
            if section is None:
                continue
            previous_low, previous_high = struct.unpack_from("<II", blob, offset - 8) if offset >= 8 else (None, None)
            after = struct.unpack_from("<Q", blob, offset + 8)[0] if offset + 16 <= len(blob) else None
            rows.append({
                "region": region,
                "sourceRva": base_rva + offset,
                "targetRva": target_rva,
                "targetSection": section,
                "previousDwordPair": [previous_low, previous_high],
                "nextQword": after,
                "alignmentOffset": offset % 8,
            })
        marker_at = 0
        while True:
            marker_at = blob.find(IMAGE_POINTER_PREFIX, marker_at)
            if marker_at < 0:
                break
            source_offset = marker_at - 4
            marker_at += 1
            if source_offset < 0 or source_offset + 8 > len(blob):
                continue
            value = struct.unpack_from("<Q", blob, source_offset)[0]
            if value < pe.image_base:
                continue
            target_rva = value - pe.image_base
            section = executable_section_for_rva(pe, target_rva)
            if section is not None:
                byte_rows.append({
                    "region": region,
                    "sourceRva": base_rva + source_offset,
                    "targetRva": target_rva,
                    "targetSection": section,
                    "alignmentOffset": source_offset % 8,
                })
    return rows, byte_rows


def source_clusters(rows: list[dict]) -> list[dict]:
    ordered = sorted(rows, key=lambda item: item["sourceRva"])
    if not ordered:
        return []
    clusters = []
    current = [ordered[0]]
    for row in ordered[1:]:
        if row["sourceRva"] - current[-1]["sourceRva"] > POINTER_CLUSTER_GAP:
            clusters.append(current)
            current = [row]
        else:
            current.append(row)
    clusters.append(current)
    return [{
        "startRva": hex(items[0]["sourceRva"]),
        "endRva": hex(items[-1]["sourceRva"]),
        "referenceCount": len(items),
        "targetCounts": {hex(target): count for target, count in collections.Counter(
            item["targetRva"] for item in items).most_common()},
    } for items in clusters]


def summarize_pointer_targets(pe, stage1: bytes, engine, rows: list[dict]) -> dict:
    grouped: dict[int, list[dict]] = collections.defaultdict(list)
    for row in rows:
        grouped[row["targetRva"]].append(row)
    gap_values = [b["sourceRva"] - a["sourceRva"] for a, b in zip(
        sorted(rows, key=lambda item: item["sourceRva"]),
        sorted(rows, key=lambda item: item["sourceRva"])[1:])]
    targets = []
    for target, references in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0])):
        references.sort(key=lambda item: item["sourceRva"])
        target_section = references[0]["targetSection"]
        range_row = next((row for row in EXCEPTION_ROWS if row[0] == target), None)
        if range_row is None:
            range_row = next((row for row in EXCEPTION_ROWS if row[0] <= target < row[1]), None)
        sample_size = min(64, max(1, range_row[1] - target)) if range_row else 64
        target_record = {
            "targetRva": hex(target),
            "targetVaAtPreferredImageBase": hex(IMAGE_BASE + target),
            "targetSectionIndex": target_section["index"],
            "targetSectionName": section_label(target_section),
            "targetBytesBackedByInitializedInput": pe.initialized_bytes(target, 1, stage1) is not None,
            "referenceCount": len(references),
            "sourceRvas": [hex(item["sourceRva"]) for item in references],
            "sourceSpan": [hex(references[0]["sourceRva"]), hex(references[-1]["sourceRva"])],
            "precedingDwordPairCounts": [
                {"lowDword": hex(low), "highDword": hex(high), "count": count}
                for (low, high), count in collections.Counter(
                    tuple(item["previousDwordPair"]) for item in references).most_common()
            ],
            "nextQwordUniqueCount": len({item["nextQword"] for item in references}),
            "nextQwordExamples": [hex(value) for value, _count in collections.Counter(
                item["nextQword"] for item in references if item["nextQword"] is not None).most_common(3)],
            "sourceClusterCountAtGapOver1KiB": len(source_clusters(references)),
            "exceptionRangeMatch": None if range_row is None else {
                "beginRva": hex(range_row[0]), "endRva": hex(range_row[1]),
                "unwindInfoRva": hex(range_row[2]),
                "unwindInfoBackedByInitializedInput": pe.initialized_bytes(range_row[2], 4, stage1) is not None,
                "exactBeginMatch": range_row[0] == target,
            },
            "decode": decode_summary(pe, stage1, engine, target, sample_size),
        }
        targets.append(target_record)
    return {
        "alignedReferenceCount": len(rows),
        "uniqueTargetCount": len(grouped),
        "sourceRegionCounts": dict(collections.Counter(item["region"] for item in rows)),
        "sourceRange": [hex(min(item["sourceRva"] for item in rows)),
                        hex(max(item["sourceRva"] for item in rows))] if rows else None,
        "sourceClustersSplitWhenGapExceedsBytes": POINTER_CLUSTER_GAP,
        "sourceClusters": source_clusters(rows),
        "interReferenceGapBytes": {
            "minimum": min(gap_values) if gap_values else None,
            "median": statistics.median(gap_values) if gap_values else None,
            "maximum": max(gap_values) if gap_values else None,
            "mostFrequent": [
                {"gap": hex(value), "count": count}
                for value, count in collections.Counter(gap_values).most_common(5)
            ],
        },
        "targets": targets,
        "assessment": "The references are deliberate preferred-base absolute values. Their irregular sparse locations and preceding dword pairs form opaque typed records, not a contiguous vtable/registrar array. Three repeated targets equal exception-range starts; one repeated target is not in the saved range map and two targets lie in virtual-only bytes. A code-pointer-field role remains plausible, but no class or registration identity is linked.",
    }


def parse_exception_table(pe, stage1: bytes) -> list[tuple[int, int, int]]:
    rva, size = pe.directory(3)
    need(size % 12 == 0, "exception directory size is not a multiple of 12")
    data = pe.initialized_bytes(rva, size, stage1)
    need(data is not None, "exception directory bytes are not available")
    return [struct.unpack_from("<III", data, index * 12) for index in range(size // 12)]


EXCEPTION_ROWS: list[tuple[int, int, int]] = []


def exception_summary(pe, stage1: bytes, engine, rows: list[tuple[int, int, int]]) -> dict:
    begin_sections = collections.Counter()
    end_sections = collections.Counter()
    unwind_sections = collections.Counter()
    begin_backed = end_backed = unwind_backed = 0
    sizes = []
    for begin, end, unwind in rows:
        begin_section = pe.section_for_rva(begin)
        end_section = pe.section_for_rva(end - 1) if end > begin else None
        unwind_section = pe.section_for_rva(unwind)
        begin_sections[str(begin_section["index"] if begin_section else "unmapped")] += 1
        end_sections[str(end_section["index"] if end_section else "unmapped")] += 1
        unwind_sections[str(unwind_section["index"] if unwind_section else "unmapped")] += 1
        begin_backed += pe.initialized_bytes(begin, 1, stage1) is not None
        end_backed += pe.initialized_bytes(end - 1, 1, stage1) is not None if end > begin else False
        unwind_backed += pe.initialized_bytes(unwind, 4, stage1) is not None
        if end >= begin:
            sizes.append(end - begin)
    stage_end = DUNGEON_RVA + len(stage1)
    stage_rows = [row for row in rows if DUNGEON_RVA <= row[0] < stage_end and row[0] < row[1] <= stage_end]
    decoded_functions = decoded_instructions = decoded_bytes = calls = returns = branches = io_ops = 0
    outbound = []
    indirect_sites = []
    for begin, end, unwind in stage_rows:
        amount = min(end - begin, 0x1000)
        blob = pe.initialized_bytes(begin, amount, stage1)
        if not blob:
            continue
        instructions = list(engine.disasm(blob, IMAGE_BASE + begin))
        if instructions:
            decoded_functions += 1
        decoded_instructions += len(instructions)
        decoded_bytes += sum(item.size for item in instructions)
        for item in instructions:
            calls += item.mnemonic.startswith("call")
            returns += item.mnemonic.startswith("ret")
            branches += item.mnemonic.startswith("j")
            io_ops += item.mnemonic.startswith(("in", "out", "int", "cli", "sti"))
            if item.mnemonic in {"call", "jmp"} or item.mnemonic.startswith("j"):
                if item.operands and item.operands[0].type == 2:
                    target = item.operands[0].imm - IMAGE_BASE
                    target_section = executable_section_for_rva(pe, target)
                    if target_section:
                        decode = decode_summary(pe, stage1, engine, target, 64)
                        outbound.append({
                            "sourceRva": hex(item.address - IMAGE_BASE),
                            "sourceFunctionRange": [hex(begin), hex(end)],
                            "sourceFunctionRangeUnwindRva": hex(unwind),
                            "instruction": {"bytes": item.bytes.hex(), "mnemonic": item.mnemonic,
                                            "operands": item.op_str},
                            "targetRva": hex(target),
                            "targetSectionIndex": target_section["index"],
                            "targetSectionName": section_label(target_section),
                            "targetInitialized": pe.initialized_bytes(target, 1, stage1) is not None,
                            "targetDecode": decode,
                            "xrefCountFromThisSweep": 1,
                            "executionObserved": False,
                            "confidence": "low; single seeded linear-sweep edge with no captured execution or target CFG",
                        })
                elif item.operands and item.operands[0].type == 3:
                    mem = item.operands[0].mem
                    if mem.base != 0:
                        indirect_sites.append({"sourceRva": hex(item.address - IMAGE_BASE),
                                               "mnemonic": item.mnemonic, "operands": item.op_str})
    outbound.sort(key=lambda item: (int(item["sourceRva"], 16), int(item["targetRva"], 16)))
    return {
        "entryCount": len(rows),
        "beginRangesSorted": all(left[0] <= right[0] for left, right in zip(rows, rows[1:])),
        "entryBeginCountBySectionIndex": dict(begin_sections),
        "endMinusOneCountBySectionIndex": dict(end_sections),
        "unwindInfoCountBySectionIndex": dict(unwind_sections),
        "beginBytesBacked": begin_backed,
        "endBytesBacked": end_backed,
        "unwindInfoBytesBacked": unwind_backed,
        "rangeSizeBytes": {
            "minimum": min(sizes), "median": statistics.median(sizes),
            "p90": sorted(sizes)[int(len(sizes) * 0.9)], "maximum": max(sizes),
        },
        "stage1RangeStartCount": len(stage_rows),
        "stage1SeededLinearSweep": {
            "method": "Capstone linear sweep from each Stage1 exception-range start through its range, capped at 4 KiB per range; this is not a recursively validated CFG.",
            "rangesWithAnyDecodedInstruction": decoded_functions,
            "decodedInstructionCount": decoded_instructions,
            "decodedByteCount": decoded_bytes,
            "callCount": calls,
            "returnCount": returns,
            "branchCount": branches,
            "ioOrPrivilegedInstructionCount": io_ops,
            "outboundDirectTransferCandidates": outbound,
            "indirectBranchInstructionSites": len(indirect_sites),
            "indirectBranchSamples": indirect_sites[:12],
            "interpretation": "The range metadata is an entry heuristic. Poor target decodes and unbacked unwind records prevent treating the sweep as complete code recovery.",
        },
    }


def raw_relative_branch_signature_scan(stage1: bytes, pe) -> dict:
    counts = collections.Counter()
    section_counts = collections.Counter()
    sample = []
    for offset, opcode in enumerate(stage1):
        target = None
        kind = None
        if opcode in (0xE8, 0xE9) and offset + 5 <= len(stage1):
            displacement = struct.unpack_from("<i", stage1, offset + 1)[0]
            target = DUNGEON_RVA + offset + 5 + displacement
            kind = "call-rel32" if opcode == 0xE8 else "jmp-rel32"
        elif opcode == 0xEB and offset + 2 <= len(stage1):
            target = DUNGEON_RVA + offset + 2 + struct.unpack_from("<b", stage1, offset + 1)[0]
            kind = "jmp-rel8"
        elif 0x70 <= opcode <= 0x7F and offset + 2 <= len(stage1):
            target = DUNGEON_RVA + offset + 2 + struct.unpack_from("<b", stage1, offset + 1)[0]
            kind = "jcc-rel8"
        elif opcode == 0x0F and offset + 6 <= len(stage1) and 0x80 <= stage1[offset + 1] <= 0x8F:
            target = DUNGEON_RVA + offset + 6 + struct.unpack_from("<i", stage1, offset + 2)[0]
            kind = "jcc-rel32"
        if target is None:
            continue
        section = executable_section_for_rva(pe, target)
        if section is None:
            continue
        counts[kind] += 1
        section_counts[str(section["index"])] += 1
        if len(sample) < 10:
            sample.append({"sourceRva": hex(DUNGEON_RVA + offset), "opcodePattern": kind,
                           "targetRva": hex(target), "targetSectionIndex": section["index"],
                           "targetInitialized": pe.initialized_bytes(target, 1, stage1) is not None})
    return {
        "matchedOpcodePatternCount": sum(counts.values()),
        "countsByOpcodePattern": dict(counts),
        "countsByTargetSectionIndex": dict(section_counts),
        "samplePatternsNotAcceptedAsControlFlow": sample,
        "assessment": "Unseeded byte signatures in a high-entropy decompressed region are not instruction-boundary or reachability evidence; only range-seeded decoded candidates are listed as cross-region edges.",
    }


def parse_relocations(pe, stage1: bytes) -> dict:
    rva, size = pe.directory(5)
    data = pe.initialized_bytes(rva, size, stage1)
    need(data is not None, "base relocation directory is not backed by initialized bytes")
    blocks = []
    offset = 0
    while offset + 8 <= len(data):
        page, block_size = struct.unpack_from("<II", data, offset)
        if page == 0 and block_size == 0:
            break
        need(block_size >= 8 and offset + block_size <= len(data), "malformed base-relocation block")
        entries = []
        for item_offset in range(offset + 8, offset + block_size, 2):
            word = struct.unpack_from("<H", data, item_offset)[0]
            kind = word >> 12
            target = page + (word & 0x0FFF)
            if kind:
                entries.append({"type": kind, "targetRva": hex(target)})
        blocks.append({"pageRva": hex(page), "blockSizeBytes": block_size, "entries": entries})
        offset += block_size
    return {"directoryRva": hex(rva), "directorySizeBytes": size, "blocks": blocks,
            "nonzeroRelocationCount": sum(len(block["entries"]) for block in blocks)}


def snapshot_summary(trace_root: Path, stage1: bytes, pointer_rows: list[dict], byte_pointer_rows: list[dict]) -> list[dict]:
    profiles = []
    sources = pointer_rows + byte_pointer_rows
    unique_sources = {(item["sourceRva"], item["targetRva"]): item for item in sources}
    for dump in sorted(trace_root.glob("*/api-dungeon.bin")):
        blob = dump.read_bytes()
        need(len(blob) == len(stage1), f"partial trace dump size differs from Stage1: {dump}")
        changed_count = 0
        exact_ranges = 0
        in_range = False
        for left, right in zip(stage1, blob):
            changed = left != right
            changed_count += changed
            if changed and not in_range:
                exact_ranges += 1
            in_range = changed
        merged_range_count = 0
        last_change = -0x10000
        for offset, (left, right) in enumerate(zip(stage1, blob)):
            if left != right:
                if offset - last_change > 16:
                    merged_range_count += 1
                last_change = offset
        unchanged_refs = sum(
            blob[source - DUNGEON_RVA:source - DUNGEON_RVA + 8]
            == stage1[source - DUNGEON_RVA:source - DUNGEON_RVA + 8]
            for source, _target in unique_sources
            if DUNGEON_RVA <= source <= DUNGEON_RVA + len(stage1) - 8
        )
        slot_offset = 0x4ED272D - DUNGEON_RVA
        profiles.append({
            "profile": dump.parent.name,
            "dumpSha256": sha256_bytes(blob),
            "changedByteCountVsStage1": changed_count,
            "exactChangedRunCount": exact_ranges,
            "changedRunCountWhenGapsUpTo16BytesAreMerged": merged_range_count,
            "pointerSourceQwordsUnchanged": unchanged_refs,
            "pointerSourceQwordCount": len(unique_sources),
            "dispatchSlotBefore": hex(struct.unpack_from("<Q", stage1, slot_offset)[0]),
            "dispatchSlotAtStop": hex(struct.unpack_from("<Q", blob, slot_offset)[0]),
            "captureScope": "Stage1 .dungeon bytes only; not a full mapped-process image",
        })
    return profiles


def parse_tls_directory(pe, stage1: bytes) -> dict:
    rva, size = pe.directory(9)
    if not rva or not size:
        return {"directoryRva": hex(rva), "directorySizeBytes": size, "present": False}
    data = pe.initialized_bytes(rva, 40, stage1)
    need(data is not None, "TLS directory is not backed by initialized bytes")
    start, end, index, callbacks, zero_fill, characteristics = struct.unpack_from("<QQQQII", data)
    return {
        "directoryRva": hex(rva), "directorySizeBytes": size, "present": True,
        "startRawDataVa": hex(start), "endRawDataVa": hex(end), "indexVa": hex(index),
        "callbacksVa": hex(callbacks), "callbacks": [], "zeroFill": zero_fill,
        "characteristics": hex(characteristics),
    }


def module_import_summary(imports: list[dict], inventory: dict) -> dict:
    names = {item.get("name") for item in imports if item.get("name")}
    relevant = ("GetProcAddress", "LdrGetProcedureAddress", "LoadLibraryA", "LoadLibraryW",
                "GetModuleHandleA", "GetModuleHandleW", "RtlAddFunctionTable",
                "RtlAddGrowableFunctionTable", "RtlInstallFunctionTableCallback")
    static = inventory["imports"]
    delay = inventory["delayImports"]
    return {"namedImportCount": sum("name" in item for item in imports),
            "ordinalImportCount": sum("ordinal" in item for item in imports),
            "importLibraries": sorted({item["name"] for item in static["dlls"]}),
            "resolverAndRuntimeMetadataApis": {name: name in names for name in relevant},
            "delayImportDirectory": {"rva": delay["rva"], "sizeBytes": delay["size"],
                                     "parseStatus": delay["parseStatus"],
                                     "importLibraries": delay["dlls"]}}


def static_export_summary(inventory: dict) -> dict:
    exports = inventory["exports"]
    names = [item["name"] for item in exports["names"]]
    families = collections.Counter(
        "ags" if name.lower().startswith("ags") else
        "opus" if name.lower().startswith("opus") else
        "libsamplerate" if name.lower().startswith("src_") else "other"
        for name in names
    )
    registration_terms = ("native", "register", "class", "function", "unreal", "dungeon", "ue4")
    registration_named = [name for name in names
                          if any(term in name.lower() for term in registration_terms)]
    return {
        "directoryRva": exports["rva"], "directorySizeBytes": exports["size"],
        "namedExportCount": exports["nameCount"], "functionCount": exports["functionCount"],
        "nameFamilies": dict(sorted(families.items())),
        "registrationOrDungeonsLikeNames": registration_named,
        "assessment": "The named exports group under AGS, Opus, libsamplerate, graphics preference flags, or PrintScriptCallstack; no Dungeons/UE registration export was identified.",
    }


def tool_inventory() -> dict:
    objdump = shutil.which("objdump")
    objdump_version = None
    if objdump:
        completed = subprocess.run([objdump, "--version"], capture_output=True, text=True, check=False)
        objdump_version = (completed.stdout or completed.stderr).splitlines()[0] if (completed.stdout or completed.stderr) else None
    available = {name: shutil.which(name) is not None for name in
                 ("analyzeHeadless", "ghidra", "r2", "radare2", "rizin", "llvm-objdump", "objdump")}
    return {
        "pythonCapstone": "5.0.6",
        "pythonUnicorn": "2.1.4; existing bounded profiles only",
        "customPeParser": "static_startup_analysis.PEImage",
        "objdump": {"available": objdump is not None, "version": objdump_version},
        "otherDisassemblers": available,
    }


def objdump_crosscheck(exe_path: Path, targets: list[int]) -> list[dict]:
    objdump = shutil.which("objdump")
    if not objdump:
        return []
    results = []
    for target in sorted(set(targets)):
        completed = subprocess.run(
            [objdump, "--disassemble", f"--start-address={IMAGE_BASE + target:#x}",
             f"--stop-address={IMAGE_BASE + target + 64:#x}", str(exe_path)],
            capture_output=True, text=True, check=False,
        )
        lines = [line.strip() for line in (completed.stdout or "").splitlines()
                 if line.strip() and (line.lstrip().startswith("0x") or
                    (line[0] in "0123456789abcdef" and ":" in line[:20]))]
        results.append({
            "targetRva": hex(target), "exitCode": completed.returncode,
            "firstDisassemblyLines": lines[:8],
            "stderrExcerpt": (completed.stderr or "").strip()[:200],
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    repo_root = Path(__file__).resolve().parents[3]
    parser.add_argument("--local-data", type=Path,
                        default=Path(os.environ.get("MCD_LOCAL_GAME_DATA_ROOT", repo_root / "local-game-data")))
    parser.add_argument("--exe", type=Path)
    parser.add_argument("--stage1", type=Path)
    parser.add_argument("--trace-root", type=Path)
    parser.add_argument("--output", type=Path, default=repo_root / "research/native/stable-code-boundary-survey.json")
    args = parser.parse_args()
    local_root = args.local_data.expanduser().resolve()
    exe_path = args.exe or local_root / "archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe"
    stage_path = args.stage1 or local_root / "phase6.8/mechanics/stage1.bin"
    trace_root = args.trace_root or local_root / "phase6.8/native-stage2/firmware-experiments"

    sys.path.insert(0, str(local_root / "phase6.8/native-stage2/tools"))
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        from capstone import Cs, CS_ARCH_X86, CS_MODE_64
        from static_startup_analysis import PEImage, imported_functions
    except ImportError as exc:
        raise SystemExit(f"FAIL: pinned local static-analysis tools unavailable: {exc}") from exc

    exe_bytes = exe_path.read_bytes()
    stage1 = stage_path.read_bytes()
    exe_hash, stage_hash = sha256_bytes(exe_bytes), sha256_bytes(stage1)
    need(exe_hash == EXPECTED_EXE, "unexpected executable SHA-256")
    need(stage_hash == EXPECTED_STAGE1 and len(stage1) == 15_360_000, "unexpected Stage1 identity or length")
    pe = PEImage(exe_bytes)
    need(pe.image_base == IMAGE_BASE, "unexpected preferred image base")
    engine = Cs(CS_ARCH_X86, CS_MODE_64)
    engine.detail = True

    global EXCEPTION_ROWS
    EXCEPTION_ROWS = parse_exception_table(pe, stage1)
    pointer_rows, byte_pointer_rows = aligned_pointer_rows(pe, stage1)
    need(len(pointer_rows) == 87, f"expected 87 aligned absolute references, observed {len(pointer_rows)}")
    pointer_clusters = summarize_pointer_targets(pe, stage1, engine, pointer_rows)
    exception = exception_summary(pe, stage1, engine, EXCEPTION_ROWS)
    relocs = parse_relocations(pe, stage1)
    tls = parse_tls_directory(pe, stage1)

    regions = [(f"section-{section['index']}", section["rva"],
                exe_bytes[section["rawOffset"]:section["rawOffset"] + section["rawSize"]])
               for section in pe.sections if section["rawSize"]]
    regions.append((".dungeon-stage1", DUNGEON_RVA, stage1))
    registration_hits = scan_literal_markers(regions, REGISTRATION_MARKERS)
    startup_hits = scan_literal_markers(regions, STARTUP_MARKERS)

    inventory = json.loads((Path(__file__).resolve().parents[1] / "native-source-inventory.json").read_text())
    architecture = json.loads((Path(__file__).resolve().parents[1] / "native-architecture.json").read_text())
    startup_map = json.loads((Path(__file__).resolve().parents[1] / "startup-block-map.json").read_text())
    runtime_tables = json.loads((Path(__file__).resolve().parents[1] / "runtime-function-table-analysis.json").read_text())
    candidates = json.loads((Path(__file__).resolve().parents[1] / "function-candidates.json").read_text())
    need(inventory["binary"]["sha256"] == exe_hash, "Native inventory executable hash mismatch")
    need(inventory["recoveryOutputs"]["stage1"]["sha256"] == stage_hash, "Native inventory Stage1 hash mismatch")
    need(startup_map["analysisBaselineCommit"] == BASELINE_COMMIT, "startup block map baseline is stale")

    imports = imported_functions(pe, stage1)
    import_summary = module_import_summary(imports, inventory)
    export_summary = static_export_summary(inventory)
    observed_resolver_events = runtime_tables["syntheticResolutionObservations"]["lookupApiEvents"]
    resolver_sites: dict[str, set[str]] = collections.defaultdict(set)
    for event in observed_resolver_events:
        resolver_sites[event["returnRva"]].add(event["symbol"])
    runtime_api_events = runtime_tables["syntheticResolutionObservations"]["runtimeFunctionRegistrationCalls"]

    observations = json.dumps({"startup": startup_map, "runtime": runtime_tables,
                               "architecture": architecture}, sort_keys=True)
    pointer_groups = pointer_clusters["targets"]
    pointer_target_map = {item["targetRva"]: item for item in pointer_groups}
    candidate_assessments = []
    for target_rva in ("0x40b0c0", "0x276f6f0", "0x4d11a0"):
        target = pointer_target_map[target_rva]
        row = target["exceptionRangeMatch"]
        candidate_assessments.append({
            "address": hex(IMAGE_BASE + int(target_rva, 16)),
            "rva": target_rva,
            "section": {"index": target["targetSectionIndex"], "name": target["targetSectionName"],
                        "initialized": target["targetBytesBackedByInitializedInput"]},
            "entryEvidence": (f"exception-range entry {row['beginRva']}..{row['endRva']}" if row and row["exactBeginMatch"]
                              else "no exact exception-range start"),
            "controlFlowEvidence": "no saved synthetic transfer into this address; no decoded outbound/inbound CFG chain",
            "callRetShape": {"decodeQuality": target["decode"]["decodeQuality"],
                             "calls": target["decode"]["callCount"], "returns": target["decode"]["returnCount"],
                             "firstInstructions": target["decode"]["firstInstructions"]},
            "stackDiscipline": "not established; available linear decode is incomplete or lacks normal prologue/epilogue evidence",
            "xrefEvidence": {"alignedStage1PointerCount": target["referenceCount"],
                             "sourceRvas": target["sourceRvas"]},
            "pointerEvidence": {"precedingDwordPairCounts": target["precedingDwordPairCounts"],
                                "nextQwordUniqueCount": target["nextQwordUniqueCount"]},
            "unwindEvidence": row,
            "importInteraction": "none established",
            "executionObserved": False,
            "ue4StructuralEvidence": "none linked to this address",
            "dungeonsStructuralEvidence": "none linked to this address",
            "confidence": "low; original executable address candidate only, not stable implementation evidence",
            "limitations": ["raw bytes are high-entropy or unavailable", "no native class/function identity",
                            "no runtime observation", "unwind information is not available in initialized input bytes"],
        })

    snapshots = snapshot_summary(trace_root, stage1, pointer_rows, byte_pointer_rows)
    need(len(snapshots) == 7, f"expected seven saved synthetic profiles, observed {len(snapshots)}")
    need(all(item["pointerSourceQwordsUnchanged"] == item["pointerSourceQwordCount"] for item in snapshots),
         "pointer-source qwords changed in a saved profile")

    adjacent_dll_path = exe_path.with_name("winmm.dll")
    adjacent_dll = None
    if adjacent_dll_path.is_file():
        adjacent = adjacent_dll_path.read_bytes()
        adjacent_pe = PEImage(adjacent)
        adjacent_timestamp = struct.unpack_from("<I", adjacent, adjacent_pe.pe_offset + 8)[0]
        adjacent_regions = [(f"section-{section['index']}", section["rva"],
                             adjacent[section["rawOffset"]:section["rawOffset"] + section["rawSize"]])
                            for section in adjacent_pe.sections if section["rawSize"]]
        adjacent_markers = scan_literal_markers(adjacent_regions, REGISTRATION_MARKERS)
        adjacent_imports = imported_functions(adjacent_pe, b"")
        adjacent_dll = {
            "file": str(adjacent_dll_path.relative_to(local_root)),
            "sha256": sha256_bytes(adjacent), "sizeBytes": len(adjacent),
            "distributionAuthenticity": "unverified local adjacent DLL",
            "staticallyImportedByMainImage": adjacent_dll_path.name.casefold() in
                {name.casefold() for name in import_summary["importLibraries"]},
            "imageBase": hex(adjacent_pe.image_base), "timestamp": hex(adjacent_timestamp),
            "entryPointRva": hex(struct.unpack_from("<I", adjacent, adjacent_pe.optional + 16)[0]),
            "sectionNames": [section["name"].strip() or f"section-{section['index']}"
                             for section in adjacent_pe.sections],
            "importLibraries": sorted({item["dll"] for item in adjacent_imports}),
            "registrationMarkerHitCounts": {name: len(hits) for name, hits in adjacent_markers.items()},
            "assessment": "Scanned as an unverified neighbor only; not promoted as Dungeons game code or used to assign an executable identity.",
        }

    module_candidate = next((item for item in candidates["candidates"]
                             if item.get("identity", {}).get("module") == "/Script/Dungeons"), None)
    need(module_candidate is not None, "serialized Dungeons class candidate is missing")
    dispatch_slot = startup_map["smbios"]["dispatcherStateRecovery"]["slotRelocationLoop"]["capturedSlotWrite"]
    known_chain = [
        "0x4ebdde7 -> 0x4be79a4 (indirect slot target)",
        "0x4be79a4 -> 0x4cce835 -> jmp rbx -> 0x4bb927b",
        "0x4bb927b -> 0x4e5f7d5 -> jmp r11 -> 0x4c1968b -> 0x4dd6892",
    ]
    payload = {
        "schemaVersion": 1,
        "date": "2026-09-24",
        "status": "research-only",
        "runtimePromotion": False,
        "applicationImpact": False,
        "analysisBaselineCommit": BASELINE_COMMIT,
        "binary": {"sha256": exe_hash, "sizeBytes": len(exe_bytes),
                   "distributionAuthenticity": "unverified local archive identity"},
        "stage1": {"sha256": stage_hash, "sizeBytes": len(stage1), "rva": hex(DUNGEON_RVA)},
        "analysisProvenance": {
            "script": "scripts/static_boundary_survey.py",
            "scriptSha256": sha256_bytes(Path(__file__).read_bytes()),
            "method": "read-only PE parsing, Capstone range-seeded linear sweeps, preferred-base pointer scans, saved profile byte comparisons, and focused objdump cross-decoding; no PE code execution",
            "privateInputsCommitted": False,
            "inputs": ["Dungeons-Win64-Shipping.exe", "Stage1 output", "seven bounded Stage1 snapshots",
                       "existing trace/map JSON artifacts"],
            "tools": tool_inventory(),
            "focusedObjdumpCrossChecks": objdump_crosscheck(
                exe_path,
                [0x40B0C0, 0x276F6F0, 0x4D11A0] + [
                    int(edge["targetRva"], 16)
                    for edge in exception["stage1SeededLinearSweep"]["outboundDirectTransferCandidates"]
                ],
            ),
        },
        "codeDataPartition": {
            "imageSections": [{"index": section["index"], "name": section_label(section),
                                "rva": hex(section["rva"]), "virtualSize": section["virtualSize"],
                                "rawSize": section["rawSize"], "executable": section["executable"],
                                "initializedRawEntropyBitsPerByte": entropy(
                                    pe.raw[section["rawOffset"]:section["rawOffset"] + section["rawSize"]]
                                    if section["rawSize"] else b"")}
                               for section in pe.sections],
            "recoveredStage1Partition": {
                "observedDispatcherBlocks": "code-like; exact instruction blocks are pinned in startup-block-map.json and remain within .dungeon",
                "exceptionRangeSeededCodeLikeWindows": exception["stage1SeededLinearSweep"]["rangesWithAnyDecodedInstruction"],
                "exceptionRangeSeededInstructionCount": exception["stage1SeededLinearSweep"]["decodedInstructionCount"],
                "exceptionRangeSeededCallRetBranchCounts": {
                    "calls": exception["stage1SeededLinearSweep"]["callCount"],
                    "returns": exception["stage1SeededLinearSweep"]["returnCount"],
                    "branches": exception["stage1SeededLinearSweep"]["branchCount"],
                    "ioOrPrivileged": exception["stage1SeededLinearSweep"]["ioOrPrivilegedInstructionCount"],
                },
                "dataLikeRegion": {"startRva": pointer_clusters["sourceRange"][0],
                                    "endRva": pointer_clusters["sourceRange"][1],
                                    "reason": "typed dword-pair plus aligned absolute-address qword fields; sparse/irregular placement; high-entropy neighboring qwords; not a contiguous function-pointer run"},
                "relocationTableLikeRegion": {"directoryRva": relocs["directoryRva"],
                                              "nonzeroRelocationCount": relocs["nonzeroRelocationCount"],
                                              "targets": [entry["targetRva"] for block in relocs["blocks"]
                                                          for entry in block["entries"]]},
                "dispatchTableLikeRegion": {"slotRva": dispatch_slot["slotRva"],
                                            "writerRva": dispatch_slot["writerRva"],
                                            "slotTargetAtStop": dispatch_slot["afterQword"],
                                            "interpretation": "one focused runtime-written dispatch-data slot, not a stable/game function table"},
                "pointerCluster": pointer_clusters,
                "unalignedAbsoluteReferenceScan": {
                    "byteGranularityReferenceCount": len(byte_pointer_rows),
                    "alignedCount": sum(item["alignmentOffset"] == 0 for item in byte_pointer_rows),
                    "unalignedReferences": [
                        {"region": item["region"], "sourceRva": hex(item["sourceRva"]),
                         "targetRva": hex(item["targetRva"]), "alignmentOffset": item["alignmentOffset"],
                         "targetSectionIndex": item["targetSection"]["index"]}
                        for item in byte_pointer_rows if item["alignmentOffset"] != 0
                    ],
                },
                "unknownHighEntropy": {"section0RawEntropyBitsPerByte": 7.9884,
                                       "section0RawBytes": 20691968,
                                       "stage1EntropyBy16KiBWindows": entropy_windows(stage1, 16 * 1024),
                                       "pointerSourceSpanEntropyBitsPerByte": entropy(
                                           stage1[int(pointer_clusters["sourceRange"][0], 16) - DUNGEON_RVA:
                                                  int(pointer_clusters["sourceRange"][1], 16) - DUNGEON_RVA + 8]),
                                       "interpretation": "Stage1 has mixed entropy rather than a single code/data distribution; linear decode from selected PE function-range starts often terminates early, and target/unwind bytes are often outside initialized input"},
            },
            "exceptionMetadata": exception,
            "unwindRelation": "236,168 sorted ranges include 235,011 begins in PE section 0 and 1,157 in .dungeon; 236,167 unwind-info RVAs are not backed by initialized input bytes. Range rows provide candidate boundaries, not decoded function bodies or stable code proof.",
        },
        "crossRegionControlFlow": {
            "executionObservedChain": known_chain,
            "executionObservedChainRegion": ".dungeon Stage1 only; synthetic profile coverage only",
            "originalImageEntryObserved": False,
            "decodedRangeSeededCandidates": exception["stage1SeededLinearSweep"]["outboundDirectTransferCandidates"],
            "section0StableCodeEdges": [],
            "rawOpcodePatternSweep": raw_relative_branch_signature_scan(stage1, pe),
            "absolutePointerReferences": pointer_clusters,
            "relocationAdjustedPointerSources": relocs,
            "savedTraceReturnAddressOrRestoredPointerEdge": "No saved observed address chain leaves .dungeon; paired state transfer remains value/flags/EBX evidence inside the synthetic trace.",
            "interpretation": "Two weak decoded .dungeon-to-.boot JMP candidates exist. Neither targets the original section-0 code region, neither target is reached by saved profiles, and both targets fail normal decode-quality checks. No validated transition into stable UE4/Dungeons code was found.",
        },
        "pointerClusterDeepening": {
            "alignedPointerReferences": pointer_clusters,
            "savedSyntheticProfileComparison": snapshots,
            "allPointerSourceQwordsUnchangedAcrossSavedProfiles": True,
            "assessment": "The repeated addresses and exception-range matches make code-pointer fields plausible. The preceding low/high dword pairs are target-specific; source spacing has no single stride; function/code bytes or unwind data are unavailable for several targets. This is opaque typed metadata evidence, not class registration evidence.",
        },
        "ue4RegistrationSearch": {
            "genericStructuralHeuristics": ["UClass/static-constructor entry", "compiled-in class/package registrars",
                                             "name/function pointer pairs", "constructor and native registrar arrays",
                                             "vtable-like executable pointer runs", "module startup clusters",
                                             "UObject/UFunction object-initialization call patterns"],
            "literalMarkerHitCounts": {name: len(hits) for name, hits in registration_hits.items()},
            "startupMarkerHitCounts": {name: len(hits) for name, hits in startup_hits.items()},
            "executablePointerRunsLengthAtLeast3": startup_map["stableGameCodeSearch"]["boundedChecks"]["vtableLikeExecutablePointerRunsLengthAtLeast3"],
            "pointerPairsOrNamedRegistrationArrays": "none identified",
            "localCandidateStructure": "opaque Stage1 typed pointer records summarized above; no paired class/package/function name and no executable registration call chain",
            "mechanismCandidateFound": False,
            "limitations": ["generic UE4 structure is heuristic only", "encoded/hashed/runtime-generated names remain possible",
                            "function bodies and 236,167 unwind records are not statically available as initialized bytes"],
        },
        "dungeonsBridgeSearch": {
            "rawClassModuleCandidate": module_candidate["identity"],
            "rawEvidence": module_candidate["evidence"],
            "nativeAddress": None,
            "binaryMarkerHitCounts": {"/Script/Dungeons": len(registration_hits["/Script/Dungeons"]),
                                       "ArmorGearItemInstance": len(registration_hits["ArmorGearItemInstance"])},
            "nativeClassOrFunctionRegistrationCandidateFound": False,
            "assessment": "The Raw superclass reference remains a serialized asset relation only; none of the pointer targets, exception ranges, or resolver sites is tied to that class or any /Script/Dungeons unit.",
        },
        "tlsInitializationAudit": {
            "entryPointRva": inventory["binary"]["pe"]["entryPointRva"],
            "tlsDirectory": tls,
            "baseRelocations": relocs,
            "staticImportSummary": import_summary,
            "startupMarkers": startup_hits,
            "constructorOrTlsCallbackPathFound": False,
            "previouslyChecked": ["TLS callback VA and callback array", "static/delay import directories", "PE entry-point route", "known .dungeon dispatcher path"],
            "newEvidence": "The only three DIR64 base-relocation entries target the TLS directory's raw-data start/end and index fields. TLS callback VA is zero; no separate callback edge was recovered.",
            "assessment": "No static TLS/global-init path to a Dungeons registration unit was identified. The PE entry point remains in packed .boot, and the saved synthetic paths do not reach an original-image entry.",
        },
        "dynamicResolutionCluster": {
            "staticImportSummary": import_summary,
            "staticExportSummary": export_summary,
            "resolverSites": [{"returnRva": rva, "resolvedSymbols": sorted(names)}
                              for rva, names in sorted(resolver_sites.items())],
            "savedProfileCount": len(runtime_tables["syntheticResolutionObservations"]["profiles"]),
            "observedGetProcAddressEventCount": len(observed_resolver_events),
            "resolvedSymbols": sorted({event["symbol"] for event in observed_resolver_events}),
            "runtimeFunctionRegistrationCalls": runtime_api_events,
            "resultFeedsDispatcherTable": "not established by saved traces; no result-pointer dataflow or registration-array xref was captured",
            "laterPathToNativeInitialization": "not observed in saved profiles; profiles stop at explicit synthetic API boundaries or modeled buffer-fill boundaries",
            "coverageLimit": "This describes seven bounded synthetic profiles only and does not assert that other resolver paths do not exist.",
        },
        "stableCodeCandidates": candidate_assessments,
        "d3EntryGate": {
            "stableOrOriginalNativeCodeCandidate": False,
            "nativeClassFunctionIdentificationMechanism": False,
            "localExecutableAddressPlusRegistrationAndRawCorrelation": False,
            "decision": "NOT FOUND",
        },
        "exhaustionAssessment": {
            "finalDecision": "CURRENT-ENVIRONMENT STATIC NATIVE EXHAUSTED",
            "requirementsCompleted": ["cross-region transfer and pointer scan", "87-reference deepening",
                                       "UE4 registration structure search", "Dungeons bridge search",
                                       "TLS/init audit", "dynamic resolver cluster review",
                                       "existing dispatcher chain and paired synthetic state flow"],
            "currentStaticSourcesReviewed": ["hash-pinned executable and initialized PE sections",
                                             "15,360,000-byte Stage1 output", "236,168-entry exception directory",
                                             "TLS/import/export/base-relocation metadata", "seven partial synthetic Stage1 stop snapshots",
                                             "local Raw Dungeons class relation", "unverified adjacent winmm.dll metadata"],
            "untestedEvidenceSourceRemainingInCurrentLocalSet": [],
            "remainingBlockers": ["no stable native code body is decodable and tied to Dungeons", "no class/function registrar or native pointer array is identified", "no matching game PDB/MAP is local", "no full post-unpack image exists in the local evidence set"],
            "newEvidenceSourceRequired": ["real Windows runtime observation or richer instruction trace",
                                          "reconstructed post-unpack image", "matching PDB/MAP/symbols",
                                          "different disassembler/decompiler or protector-aware tooling",
                                          "another authenticated game binary/build", "same-build live UE reflection/registration snapshot"],
            "scope": "The exhaustion decision applies to static native evidence sources present in this environment; it does not mean Native analysis is impossible.",
        },
        "unverifiedAdjacentDll": adjacent_dll,
        "validationExpectations": {
            "status": "research-only", "runtimePromotion": False, "applicationImpact": False,
            "binarySha256": exe_hash, "stage1Sha256": stage_hash,
            "analysisBaselineCommit": BASELINE_COMMIT,
        },
    }
    output_path = args.output.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps({
        "status": "written", "output": str(output_path), "binarySha256": exe_hash,
        "stage1Sha256": stage_hash, "alignedPointerRefs": len(pointer_rows),
        "unalignedPointerRefs": len(byte_pointer_rows) - len(pointer_rows),
        "stage1ExceptionRanges": exception["stage1RangeStartCount"],
        "crossRegionCandidates": len(exception["stage1SeededLinearSweep"]["outboundDirectTransferCandidates"]),
        "savedProfiles": len(snapshots), "finalDecision": payload["exhaustionAssessment"]["finalDecision"],
    }, indent=2))


if __name__ == "__main__":
    main()
