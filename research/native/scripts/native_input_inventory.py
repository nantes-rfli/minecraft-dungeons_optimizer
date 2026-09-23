#!/usr/bin/env python3
"""Audit a local Dungeons Shipping PE and its recovered .dungeon snapshot.

This script reads private local inputs, but writes only structural metadata.
It does not execute the PE and never copies game bytes to the output.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import math
import struct
import uuid
from pathlib import Path

EXPECTED_EXE_SHA256 = "eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8"
EXPECTED_STAGE1_SHA256 = "d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b"
EXPECTED_STAGE1_SIZE = 15_360_000
EXPECTED_DUNGEON_RVA = 0x04BB8000
EXPECTED_IMAGE_BASE = 0x140000000
DIRECTORIES = {
    0: "export", 1: "import", 2: "resource", 3: "exception",
    4: "security", 5: "baseRelocation", 6: "debug", 7: "architecture",
    8: "globalPointer", 9: "tls", 10: "loadConfig", 11: "boundImport",
    12: "iat", 13: "delayImport", 14: "clr", 15: "reserved",
}
KEYWORDS = [
    "Dungeons-Win64-Shipping.pdb", "FNamePool", "GUObjectArray", "UObject",
    "UClass", "UFunction", "/Script/Dungeons", "GameplayEffect",
    "GetSystemFirmwareTable", "??_R0", ".?AV",
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    length = len(data)
    return round(-sum((n / length) * math.log2(n / length) for n in counts if n), 6)


def c_string(data: bytes, offset: int, limit: int = 4096) -> str:
    end = data.find(b"\0", offset, min(len(data), offset + limit))
    if end < 0:
        end = min(len(data), offset + limit)
    return data[offset:end].decode("ascii", "replace")


def scan(data: bytes) -> dict:
    results = {}
    for keyword in KEYWORDS:
        raw = keyword.encode("ascii")
        wide = keyword.encode("utf-16le")
        hits = []
        for encoding, needle in (("ascii", raw), ("utf16le", wide)):
            start = 0
            while len(hits) < 8:
                pos = data.find(needle, start)
                if pos < 0:
                    break
                hits.append({"encoding": encoding, "offset": hex(pos)})
                start = pos + 1
        results[keyword] = {"found": bool(hits), "hits": hits}
    return results


class PE:
    def __init__(self, data: bytes):
        self.data = data
        if data[:2] != b"MZ":
            raise ValueError("input has no MZ signature")
        self.pe_offset = struct.unpack_from("<I", data, 0x3C)[0]
        if data[self.pe_offset:self.pe_offset + 4] != b"PE\0\0":
            raise ValueError("input has no PE signature")
        self.coff = self.pe_offset + 4
        self.machine, self.section_count, self.timestamp, self.sym_ptr, self.sym_count, self.optional_size, self.characteristics = struct.unpack_from("<HHIIIHH", data, self.coff)
        self.optional = self.coff + 20
        self.magic = struct.unpack_from("<H", data, self.optional)[0]
        if self.magic != 0x20B:
            raise ValueError(f"expected PE32+, got optional-header magic {self.magic:#x}")
        self.image_base = struct.unpack_from("<Q", data, self.optional + 24)[0]
        self.entry_rva = struct.unpack_from("<I", data, self.optional + 16)[0]
        self.section_alignment, self.file_alignment = struct.unpack_from("<II", data, self.optional + 32)
        self.size_image, self.size_headers = struct.unpack_from("<II", data, self.optional + 56)
        self.directory_count = struct.unpack_from("<I", data, self.optional + 108)[0]
        self.directory_offset = self.optional + 112
        self.sections = []
        section_table = self.optional + self.optional_size
        for index in range(self.section_count):
            at = section_table + 40 * index
            raw_name = data[at:at + 8].rstrip(b"\0")
            virtual_size, rva, raw_size, raw_offset = struct.unpack_from("<IIII", data, at + 8)
            flags = struct.unpack_from("<I", data, at + 36)[0]
            raw = data[raw_offset:raw_offset + raw_size] if raw_size else b""
            self.sections.append({
                "index": index,
                "name": raw_name.decode("ascii", "replace"),
                "rva": rva,
                "virtualSize": virtual_size,
                "rawOffset": raw_offset,
                "rawBytes": raw_size,
                "characteristics": f"0x{flags:08x}",
                "readable": bool(flags & 0x40000000),
                "writable": bool(flags & 0x80000000),
                "executable": bool(flags & 0x20000000),
                "rawEntropyBitsPerByte": entropy(raw),
                "sha256RawBytes": sha256(raw) if raw else None,
            })

    def directory(self, index: int) -> tuple[int, int]:
        if index >= self.directory_count:
            return 0, 0
        return struct.unpack_from("<II", self.data, self.directory_offset + 8 * index)

    def rva_to_offset(self, rva: int, size: int = 1) -> int:
        if rva < self.size_headers and rva + size <= len(self.data):
            return rva
        for section in self.sections:
            start = section["rva"]
            if start <= rva and rva + size <= start + section["rawBytes"]:
                return section["rawOffset"] + rva - start
        raise ValueError(f"RVA {rva:#x} has no raw bytes for {size} byte(s)")

    def imports(self, index: int, delay: bool = False) -> dict:
        directory_rva, directory_size = self.directory(index)
        if not directory_rva:
            return {"rva": 0, "size": 0, "dlls": [], "nameImportCount": 0, "ordinalImportCount": 0}
        try:
            offset = self.rva_to_offset(directory_rva, 1)
        except ValueError:
            return {"rva": hex(directory_rva), "size": directory_size, "dlls": [], "nameImportCount": 0, "ordinalImportCount": 0, "parseStatus": "directory RVA lies in virtual section bytes without a raw-file mapping"}
        dlls = []
        name_count = ordinal_count = 0
        descriptor_size = 32 if delay else 20
        end = min(len(self.data), offset + directory_size + descriptor_size)
        while offset + descriptor_size <= end:
            if delay:
                fields = struct.unpack_from("<IIIIIIII", self.data, offset)
                attributes, name_ptr, _, _, iat_ptr, int_ptr, _, _ = fields
                if not any(fields):
                    break
                def as_rva(value: int) -> int:
                    return value if attributes & 1 else value - self.image_base
                name_rva = as_rva(name_ptr)
                thunk_rva = as_rva(int_ptr or iat_ptr)
            else:
                original, timestamp, forwarder, name_rva, first_thunk = struct.unpack_from("<IIIII", self.data, offset)
                if not any((original, timestamp, forwarder, name_rva, first_thunk)):
                    break
                thunk_rva = original or first_thunk
            name = c_string(self.data, self.rva_to_offset(name_rva))
            funcs = []
            thunk_off = self.rva_to_offset(thunk_rva)
            for item in range(65536):
                value = struct.unpack_from("<Q", self.data, thunk_off + item * 8)[0]
                if value == 0:
                    break
                if value & 0x8000000000000000:
                    ordinal = value & 0xFFFF
                    funcs.append({"ordinal": ordinal})
                    ordinal_count += 1
                else:
                    import_name_off = self.rva_to_offset(value, 3)
                    hint = struct.unpack_from("<H", self.data, import_name_off)[0]
                    function = c_string(self.data, import_name_off + 2)
                    funcs.append({"name": function, "hint": hint})
                    name_count += 1
            dlls.append({"name": name, "functions": funcs})
            offset += descriptor_size
        return {"rva": hex(directory_rva), "size": directory_size, "dlls": dlls, "nameImportCount": name_count, "ordinalImportCount": ordinal_count}

    def exports(self) -> dict:
        rva, size = self.directory(0)
        if not rva:
            return {"rva": 0, "size": 0, "ordinalBase": 0, "functionCount": 0, "nameCount": 0, "names": []}
        off = self.rva_to_offset(rva, 40)
        fields = struct.unpack_from("<IIHHIIIIIII", self.data, off)
        ordinal_base, function_count, name_count, funcs_rva, names_rva, ords_rva = fields[5:11]
        names = []
        names_off = self.rva_to_offset(names_rva, 4) if name_count else 0
        ords_off = self.rva_to_offset(ords_rva, 2) if name_count else 0
        for i in range(name_count):
            name_rva = struct.unpack_from("<I", self.data, names_off + 4 * i)[0]
            ordinal_index = struct.unpack_from("<H", self.data, ords_off + 2 * i)[0]
            names.append({"name": c_string(self.data, self.rva_to_offset(name_rva)), "ordinal": ordinal_base + ordinal_index})
        return {"rva": hex(rva), "size": size, "ordinalBase": ordinal_base, "functionCount": function_count, "nameCount": name_count, "names": names}

    def tls(self) -> dict:
        rva, size = self.directory(9)
        if not rva:
            return {"rva": 0, "size": 0, "callbackVa": 0, "callbacks": []}
        off = self.rva_to_offset(rva, 40)
        start_va, end_va, index_va, callback_va, zero_fill, flags = struct.unpack_from("<QQQQII", self.data, off)
        callbacks = []
        if callback_va:
            callback_rva = callback_va - self.image_base
            callbacks_off = self.rva_to_offset(callback_rva, 8)
            for i in range(4096):
                value = struct.unpack_from("<Q", self.data, callbacks_off + 8 * i)[0]
                if not value:
                    break
                callbacks.append(hex(value))
        return {"rva": hex(rva), "size": size, "startRawDataVa": hex(start_va), "endRawDataVa": hex(end_va), "indexVa": hex(index_va), "callbackVa": hex(callback_va), "callbacks": callbacks, "zeroFill": zero_fill, "characteristics": hex(flags)}

    def debug(self) -> list:
        rva, size = self.directory(6)
        if not rva:
            return []
        off = self.rva_to_offset(rva, 28)
        records = []
        for at in range(off, min(off + size, len(self.data)), 28):
            if at + 28 > len(self.data):
                break
            characteristics, timestamp, major, minor, kind, data_size, data_rva, data_raw = struct.unpack_from("<IIHHIIII", self.data, at)
            if not any((characteristics, timestamp, major, minor, kind, data_size, data_rva, data_raw)):
                continue
            rec = {"type": kind, "timestamp": hex(timestamp), "size": data_size, "rva": hex(data_rva), "rawOffset": hex(data_raw)}
            if kind == 2 and data_raw + data_size <= len(self.data):
                blob = self.data[data_raw:data_raw + data_size]
                if blob.startswith(b"RSDS") and len(blob) >= 24:
                    rec["codeView"] = {"format": "RSDS", "guid": str(uuid.UUID(bytes_le=blob[4:20])), "age": struct.unpack_from("<I", blob, 20)[0], "pdbPath": c_string(blob, 24)}
            records.append(rec)
        return records

    def resources(self) -> dict:
        root_rva, root_size = self.directory(2)
        if not root_rva:
            return {"rva": 0, "size": 0, "typeIds": [], "versionResources": []}
        root_off = self.rva_to_offset(root_rva, 16)
        leaves = []
        types = set()
        def walk(rel_off: int, path: list, depth: int = 0) -> None:
            if depth > 8:
                return
            directory_off = root_off + rel_off
            if directory_off + 16 > len(self.data):
                return
            named, ids = struct.unpack_from("<HH", self.data, directory_off + 12)
            count = named + ids
            if count > 4096 or directory_off + 16 + 8 * count > len(self.data):
                return
            for i in range(count):
                name_field, target_field = struct.unpack_from("<II", self.data, directory_off + 16 + 8 * i)
                if name_field & 0x80000000:
                    name_off = root_off + (name_field & 0x7FFFFFFF)
                    length = struct.unpack_from("<H", self.data, name_off)[0]
                    value = self.data[name_off + 2:name_off + 2 + length * 2].decode("utf-16le", "replace")
                else:
                    value = name_field & 0xFFFF
                child_path = path + [value]
                if depth == 0 and isinstance(value, int):
                    types.add(value)
                target_rel = target_field & 0x7FFFFFFF
                if target_field & 0x80000000:
                    walk(target_rel, child_path, depth + 1)
                else:
                    data_off = root_off + target_rel
                    if data_off + 16 > len(self.data):
                        continue
                    data_rva, data_size, codepage, _ = struct.unpack_from("<IIII", self.data, data_off)
                    leaves.append((child_path, data_rva, data_size, codepage))
        walk(0, [])
        versions = []
        for path, data_rva, data_size, codepage in leaves:
            if not path or path[0] != 16:
                continue
            version = {"path": path, "rva": hex(data_rva), "size": data_size, "codepage": codepage}
            try:
                data_off = self.rva_to_offset(data_rva, min(data_size, 1))
                blob = self.data[data_off:data_off + data_size]
                key = "VS_VERSION_INFO\0".encode("utf-16le")
                key_at = blob.find(key)
                if key_at >= 0:
                    fixed_at = (key_at + len(key) + 3) & ~3
                    sig, struct_version, fms, fls, pms, pls = struct.unpack_from("<6I", blob, fixed_at)
                    if sig == 0xFEEF04BD:
                        version["fileVersion"] = ".".join(map(str, (fms >> 16, fms & 0xFFFF, fls >> 16, fls & 0xFFFF)))
                        version["productVersion"] = ".".join(map(str, (pms >> 16, pms & 0xFFFF, pls >> 16, pls & 0xFFFF)))
            except (ValueError, struct.error):
                pass
            versions.append(version)
        return {"rva": hex(root_rva), "size": root_size, "typeIds": sorted(types), "versionResources": versions}


def parse_exception_table(pe: PE, stage1: bytes, api_return_rvas: list[int]) -> dict:
    rva, size = pe.directory(3)
    dungeon = next((s for s in pe.sections if s["name"] == ".dungeon"), None)
    result = {"rva": hex(rva), "size": size, "source": "unavailable", "entryCount": None, "validRangeCount": None, "matchedObservedApiReturnRvas": []}
    if not rva or not dungeon or not stage1 or rva < dungeon["rva"]:
        return result
    offset = rva - dungeon["rva"]
    if offset + size > len(stage1):
        return result
    table = stage1[offset:offset + size]
    entries = valid = 0
    matches = {value: [] for value in api_return_rvas}
    for pos in range(0, len(table) - 11, 12):
        begin, end, unwind = struct.unpack_from("<III", table, pos)
        if not (begin or end or unwind):
            continue
        entries += 1
        if begin < end:
            valid += 1
            for value in api_return_rvas:
                if begin <= value < end:
                    matches[value].append({"beginRva": hex(begin), "endRva": hex(end), "unwindRva": hex(unwind)})
    result.update({
        "source": "stage1 .dungeon bytes",
        "stage1Offset": hex(offset),
        "entryCount": entries,
        "validRangeCount": valid,
        "matchedObservedApiReturnRvas": [{"rva": hex(k), "entries": v} for k, v in matches.items()],
    })
    return result


def build_inventory(exe_path: Path, stage1_path: Path) -> dict:
    exe = exe_path.read_bytes()
    stage1 = stage1_path.read_bytes()
    pe = PE(exe)
    directories = []
    for index, name in DIRECTORIES.items():
        rva, size = pe.directory(index)
        if rva or size:
            directories.append({"index": index, "name": name, "rva": hex(rva), "size": size})
    imports = pe.imports(1)
    delay_imports = pe.imports(13, delay=True)
    exports = pe.exports()
    tls = pe.tls()
    debug = pe.debug()
    resources = pe.resources()
    input_sha = sha256(exe)
    stage1_sha = sha256(stage1)
    api_return_rvas = [0x050D0FE9, 0x050D1349]
    codeview = [r.get("codeView") for r in debug if r.get("codeView")]
    exe_parent = exe_path.parent
    sidecars = []
    for path in sorted(exe_parent.iterdir(), key=lambda p: p.name.lower()):
        if path.is_file() and path.suffix.lower() == ".dll":
            blob = path.read_bytes()
            sidecars.append({"file": path.name, "sizeBytes": len(blob), "sha256": sha256(blob), "classification": "adjacent DLL; provenance/authenticity not independently verified"})
    symbol_files = []
    extracted_root = exe_path.parents[4] if len(exe_path.parents) > 4 else exe_parent
    for suffix in (".pdb", ".map", ".sym"):
        symbol_files.extend(str(p.relative_to(extracted_root)) for p in extracted_root.rglob("*") if p.is_file() and p.suffix.lower() == suffix)
    strings = {"rawExe": scan(exe), "stage1Output": scan(stage1), "limits": "bounded literal ASCII/UTF-16 marker search; absence is not proof that encoded, hashed, or runtime-generated names are absent"}
    first_function_rva = 0x14CD
    sample = None
    try:
        sample_off = pe.rva_to_offset(first_function_rva, 8)
        sample = {"rva": hex(first_function_rva), "rawOffset": hex(sample_off), "firstBytes": exe[sample_off:sample_off + 8].hex(), "note": "Capstone 5.0.6 decoded one instruction at the recorded .pdata start before stopping; this is a sample, not a complete function analysis."}
    except ValueError:
        pass
    return {
        "schemaVersion": 1,
        "date": "2026-09-23",
        "status": "research-only",
        "runtimePromotion": False,
        "method": "read-only PE32+ parsing and SHA-256; no game process launched and no PE code executed",
        "binary": {
            "file": "local-game-data/archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe",
            "sha256": input_sha,
            "sizeBytes": len(exe),
            "distributionAuthenticity": "unverified",
            "pe": {
                "machine": "AMD64",
                "timestampUtc": datetime.datetime.fromtimestamp(pe.timestamp, datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
                "imageBase": hex(pe.image_base),
                "entryPointRva": hex(pe.entry_rva),
                "sizeOfImage": hex(pe.size_image),
                "sizeOfHeaders": hex(pe.size_headers),
                "sectionAlignment": hex(pe.section_alignment),
                "fileAlignment": hex(pe.file_alignment),
                "characteristics": hex(pe.characteristics),
                "optionalHeaderMagic": hex(pe.magic),
            },
        },
        "localAdjacentDlls": sidecars,
        "sections": pe.sections,
        "dataDirectories": directories,
        "imports": imports,
        "delayImports": delay_imports,
        "exports": exports,
        "tls": tls,
        "exceptionUnwind": parse_exception_table(pe, stage1, api_return_rvas),
        "debug": {
            "records": debug,
            "pdbReferences": codeview,
            "localPdbMapOrSymFiles": symbol_files,
        },
        "resources": resources,
        "embeddedIdentifierScan": strings,
        "recoveryOutputs": {
            "stage1": {
                "file": "local-game-data/phase6.8/mechanics/stage1.bin",
                "sha256": stage1_sha,
                "sizeBytes": len(stage1),
                "rva": hex(EXPECTED_DUNGEON_RVA),
                "independentDecoderAgreement": True,
            },
        },
        "toolVersions": {"objdump": "Apple LLVM 17.0.0", "capstone": "5.0.6", "unicorn": "2.1.4"},
        "limitations": [
            "The binary came from a local archive; its distribution authenticity is not established by hash equality to the prior local record.",
            "The first eight PE section names are empty; entropy and PE flags are structural observations, not packer identification.",
            "The marker scan cannot rule out obfuscated or runtime-created reflection metadata.",
            "A PDB path and GUID in CodeView metadata do not provide symbols when the matching PDB file is absent.",
        ],
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    local_data = repo_root / "local-game-data"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exe", type=Path, default=local_data / "archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe")
    parser.add_argument("--stage1", type=Path, default=local_data / "phase6.8/mechanics/stage1.bin")
    parser.add_argument("--output", type=Path, default=repo_root / "research/native/native-source-inventory.json")
    parser.add_argument("--allow-different-hash", action="store_true", help="skip the pinned input-hash checks for exploratory use")
    args = parser.parse_args()
    inventory = build_inventory(args.exe.resolve(), args.stage1.resolve())
    exe_sha = inventory["binary"]["sha256"]
    stage_sha = inventory["recoveryOutputs"]["stage1"]["sha256"]
    if not args.allow_different_hash and exe_sha != EXPECTED_EXE_SHA256:
        raise SystemExit(f"unexpected executable SHA-256: {exe_sha}")
    if not args.allow_different_hash and stage_sha != EXPECTED_STAGE1_SHA256:
        raise SystemExit(f"unexpected Stage 1 SHA-256: {stage_sha}")
    if inventory["recoveryOutputs"]["stage1"]["sizeBytes"] != EXPECTED_STAGE1_SIZE:
        raise SystemExit("Stage 1 byte count differs from the checked-in baseline")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": "passed", "exeSha256": exe_sha, "stage1Sha256": stage_sha, "sections": len(inventory["sections"]), "staticImportDlls": len(inventory["imports"]["dlls"]), "delayImportDlls": len(inventory["delayImports"]["dlls"]), "tlsCallbacks": len(inventory["tls"]["callbacks"]), "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
