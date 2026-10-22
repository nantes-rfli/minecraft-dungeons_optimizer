#!/usr/bin/env python3
"""Extend the hash-pinned historical tracer without changing its source/evidence.

Only repository-owned Python is adapted. Each source anchor must match exactly.
The inherited Windows environment is synthetic; this is not a Windows capture.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import sys

from self_file_model import SelfFileModel, Unmodeled, corrected_smbios_fixture

BASELINE_SHA256 = "ec0ccf5e9a8af7457eda3d279b5da01eb704f51862e82e25a357e1207e8d7915"


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("historical tracer anchor mismatch: " + old[:80])
    return source.replace(old, new, 1)


def install_extension(g, settings):
    u, un = g["u"], g["un"]
    model = SelfFileModel(g["data"], g["commandLine"].strip('"'),
                          u.mem_read, u.mem_write,
                          lambda address, size: u.mem_map(address, size, un.UC_PROT_READ),
                          u.mem_unmap)
    original_api = g["api"]
    fixture = corrected_smbios_fixture()
    reads = []
    read_hook = None

    def capture_read(emu, access, address, size, value, _):
        reads.append({"offset": address - model.VIEW_ADDRESS, "size": size,
                      "instructionRva": hex(emu.reg_read(g["UC_X86_REG_RIP"]) - g["base"])})
        if len(reads) == 256:
            emu.hook_del(read_hook)

    arities = {"CreateFileW": 7, "CreateFileMappingW": 6, "MapViewOfFile": 5,
               "UnmapViewOfFile": 1, "GetFileSize": 2, "ReadFile": 5,
               "SetFilePointer": 4, "CloseHandle": 1}

    def api(emu, address, size, user):
        nonlocal read_hook
        lib, name = g["stubmap"].get(address, (None, None))
        regs = [emu.reg_read(g[key]) for key in
                ("UC_X86_REG_RCX", "UC_X86_REG_RDX", "UC_X86_REG_R8", "UC_X86_REG_R9")]
        owns_close = name == "CloseHandle" and regs[0] in (model.FILE_HANDLE, model.MAPPING_HANDLE)
        is_file = name in arities and (name != "CloseHandle" or owns_close)
        is_firmware = name == "GetSystemFirmwareTable" and settings.profile == "consistent"
        if not is_file and not is_firmware:
            original_api(emu, address, size, user)
            if name == "RegOpenKeyA":
                # RegOpenKeyA has three arguments; R9 is not an access mask.
                event = g["events"][-1]
                event.pop("accessMask", None)
                event["outputHandlePointer"] = hex(regs[2])
            return
        sp = emu.reg_read(g["UC_X86_REG_RSP"])
        return_address = struct.unpack("<Q", emu.mem_read(sp, 8))[0]
        event = {"dll": lib, "name": name, "args": [hex(x) for x in regs],
                 "returnAddress": hex(return_address),
                 "returnRva": hex(return_address - g["base"]),
                 "model": "self-file-" + settings.profile}
        g["events"].append(event)
        try:
            if is_firmware:
                if regs[:2] != [0x52534D42, 0]:
                    raise Unmodeled("firmware provider outside corrected fixture")
                if regs[2] == 0 and regs[3] == 0:
                    pass
                elif regs[2] and regs[3] >= len(fixture):
                    emu.mem_write(regs[2], fixture)
                    event["writtenBytes"] = len(fixture)
                else:
                    raise Unmodeled("firmware buffer outside corrected fixture")
                event.update(modeledReturn=len(fixture), fixtureSha256=hashlib.sha256(fixture).hexdigest())
                g["ret"](len(fixture))
                return
            argc = arities[name]
            args = regs[:argc] + [struct.unpack("<Q", emu.mem_read(sp + 0x28 + 8*i, 8))[0]
                                  for i in range(max(0, argc - 4))]
            event["typedArguments"] = [hex(x) for x in args]
            result = model.handle(name, args)
            if result is None:
                raise Unmodeled("file operation not modeled")
            event.update(result["metadata"], modeledReturn=hex(result["returnValue"]))
            if name == "MapViewOfFile":
                read_hook = emu.hook_add(un.UC_HOOK_MEM_READ, capture_read,
                                         begin=model.VIEW_ADDRESS,
                                         end=model.VIEW_ADDRESS + len(model.data) - 1)
            g["ret"](result["returnValue"])
        except Unmodeled as exc:
            g["stop"]("unmodeled self-file boundary: " + str(exc))

    g["api"] = api
    g["selfFileReads"] = reads


def run_slices(g, settings):
    u = g["u"]
    slices = []
    for index in range(settings.slices):
        address = g["base"] + 0x4BB8000 + 0x2C495F if index == 0 else u.reg_read(g["UC_X86_REG_RIP"])
        u.emu_start(address, 0, timeout=60_000_000, count=500_000_000)
        snapshot = {"slice": index + 1, "rip": hex(u.reg_read(g["UC_X86_REG_RIP"])),
                    "events": len(g["events"]), "stopReason": g["reason"]}
        slices.append(snapshot)
        print(json.dumps(snapshot), flush=True)
        if g["reason"] is not None:
            break
    g["sliceObservations"] = slices


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", choices=["legacy", "consistent"])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--slices", type=int, default=6)
    parser.add_argument("--baseline-script", type=Path,
                        default=Path(__file__).with_name("trace_smbios_boundary.py"))
    settings = parser.parse_args()
    if not 1 <= settings.slices <= 12 or not settings.run_id.replace("-", "").isalnum():
        parser.error("slices must be 1..12 and run-id must be alphanumeric/hyphens")
    baseline = settings.baseline_script.resolve()
    source = baseline.read_text()
    if hashlib.sha256(baseline.read_bytes()).hexdigest() != BASELINE_SHA256:
        raise SystemExit("historical tracer hash mismatch")
    local_root = Path(os.environ.get("MCD_LOCAL_GAME_DATA_ROOT", baseline.parents[3] / "local-game-data")).resolve()
    output = local_root / "phase6.8/native-stage2/self-file-experiments" / settings.run_id
    output.mkdir(parents=True, exist_ok=False)
    source = replace_once(source, "mode=sys.argv[1] if len(sys.argv)>1 else 'firmware-success-size'",
                          "mode='firmware-registry-failure'")
    source = replace_once(source, "outdir=w/'firmware-experiments'/mode", "outdir=continuationOutput")
    source = replace_once(source, "for address in checkpointAddresses:\n u.hook_add(un.UC_HOOK_CODE,checkpoint,begin=address,end=address)", "")
    source = replace_once(source, "u.hook_add(un.UC_HOOK_CODE,ebx_transfer_monitor,begin=base+0x4e99150,end=base+0x4e99400)", "")
    source = replace_once(source, "for _name,_begin,_end in focusedBlockRanges:u.hook_add(un.UC_HOOK_BLOCK,focused_block,begin=_begin,end=_end)", "")
    source = replace_once(source, "u.hook_add(un.UC_HOOK_MEM_WRITE,wr,begin=base,end=base+imageSize-1)",
                          "u.hook_add(un.UC_HOOK_MEM_WRITE,wr,begin=base,end=base+0x4bb8000-1)")
    source = replace_once(source, "block_handle=u.hook_add(un.UC_HOOK_BLOCK,block);",
                          "installExtension(globals(), continuationSettings)\nblock_handle=u.hook_add(un.UC_HOOK_BLOCK,block);")
    source = replace_once(source, "try:u.emu_start(base+0x4bb8000+0x2c495f,0,timeout=40000000,count=500000000)",
                          "try:runSlices(globals(), continuationSettings)")
    source = replace_once(source, ";print(json.dumps({k:v for k,v in report.items() if k!='writtenPages'},indent=2))", "")
    namespace = {"__file__": str(baseline), "__name__": "__main__", "continuationOutput": output,
                 "continuationSettings": settings, "installExtension": install_extension,
                 "runSlices": run_slices}
    exec(compile(source, str(baseline) + ":self-file-adapter", "exec"), namespace)
    u = namespace["u"]
    image = bytes(u.mem_read(namespace["base"], namespace["imageSize"]))
    (output / "mapped-image.bin").write_bytes(image)
    report = namespace["report"]
    report.update(profile="self-file-" + settings.profile,
                  baselineScriptSha256=BASELINE_SHA256,
                  adapterScriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  modelScriptSha256=hashlib.sha256(Path(__file__).with_name("self_file_model.py").read_bytes()).hexdigest(),
                  mappedImageSha256=hashlib.sha256(image).hexdigest(),
                  mappedImageBytes=len(image),
                  fileReadSamples=namespace["selfFileReads"],
                  fileReadSampleLimit=256,
                  slices=namespace.get("sliceObservations", []),
                  maximumSlices=settings.slices,
                  instructionsPerSliceLimit=500_000_000,
                  microsecondsPerSliceLimit=60_000_000)
    (output / "api-trace.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"output": str(output), "profile": report["profile"],
                      "stopReason": report["stopReason"], "events": len(report["events"]),
                      "changedSections": [s["index"] for s in report["sectionHashes"] if s["initial"] != s["final"]]}))


if __name__ == "__main__":
    main()
