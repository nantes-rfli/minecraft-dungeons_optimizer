#!/usr/bin/env python3
"""Differential check against pinned local native code; writes metadata only.

Run explicitly with the private data root. This is not a gameplay validation or
a CI dependency. Full source, destination and stack buffers are compared along
with all general registers and arithmetic flags at the native loop exit.
"""
import argparse
import hashlib
import json
from pathlib import Path
import random
import sys

from verified_copy_loop import BLOCKS, HOOK_RVA, EXIT_RVA, verify_code, copy_prefix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.local_root.resolve()
    stage = (root / "phase6.8/mechanics/stage1.bin").read_bytes()
    digest = hashlib.sha256(stage).hexdigest()
    if digest != "d68e1bdf0e4ac23427d9978198a9b459183ad75b34666ca1ea298689e99d925b":
        raise SystemExit("unexpected Stage1 SHA-256")
    sys.path.insert(0, str(root / "phase6.8/native-stage2/tools"))
    import unicorn as un
    import unicorn.x86_const as x

    base, source, destination, stack = 0x140000000, 0x30000000, 0x40000000, 0x70000000
    names = ("rax", "rbx", "rcx", "rdx", "rsi", "rdi", "rbp", "rsp", "r8", "r9",
             "r10", "r11", "r12", "r13", "r14", "r15", "eflags", "rip")
    registers = {name: getattr(x, "UC_X86_REG_" + name.upper()) for name in names}

    def trial(count, seed, fast, high=0, overlap=False):
        rng = random.Random(seed)
        emu = un.Uc(un.UC_ARCH_X86, un.UC_MODE_64)
        pages = {(base + rva) & ~4095 for rva, size in BLOCKS} | {(base + EXIT_RVA) & ~4095}
        for page in sorted(pages):
            emu.mem_map(page, 4096)
        for rva, size in BLOCKS:
            emu.mem_write(base + rva, stage[rva - 0x4BB8000:rva - 0x4BB8000 + size])
        for address in (source, destination, stack):
            emu.mem_map(address, 0x10000)
            emu.mem_write(address, rng.randbytes(0x10000))
        for name, reg in registers.items():
            if name not in ("eflags", "rip"):
                emu.reg_write(reg, rng.getrandbits(64))
        target = source + 1 if overlap else destination
        initial = {"rsi": source, "rdi": target, "rcx": count + high,
                   "rsp": stack + 0x8000, "eflags": rng.choice([0x202, 0x203, 0x246, 0x2D7])}
        for name, value in initial.items():
            emu.reg_write(registers[name], value)
        acceleration = []
        if fast:
            def summarize(engine, address, size, user):
                if acceleration:
                    return
                verify_code(engine, base)
                acceleration.append(copy_prefix(engine, registers, source, target,
                                                engine.reg_read(registers["rcx"])))
            emu.hook_add(un.UC_HOOK_CODE, summarize, begin=base + HOOK_RVA, end=base + HOOK_RVA)
        emu.emu_start(base + 0x4F72ACC, base + EXIT_RVA, timeout=0, count=max(100, (count + 1) * 50))
        if emu.reg_read(registers["rip"]) != base + EXIT_RVA:
            raise AssertionError("original loop did not reach its exit")
        snapshot = ([emu.reg_read(reg) for reg in registers.values()],
                    *(bytes(emu.mem_read(address, 0x10000)) for address in (source, destination, stack)))
        return snapshot, acceleration

    results = []
    for count in (0, 1, 2, 3, 17, 256, 4096):
        for seed in range(3):
            slow, _ = trial(count, seed, False)
            fast, accelerated = trial(count, seed, True)
            if slow != fast:
                raise AssertionError((count, seed, "native/summary mismatch"))
            results.append({"bytes": count, "seed": seed, "accelerated": accelerated == [True], "equal": True})
    for count in (2, 17):
        for high, overlap in ((1 << 32, False), (0, True)):
            slow, _ = trial(count, 5, False, high, overlap)
            fast, accelerated = trial(count, 5, True, high, overlap)
            if slow != fast or accelerated != [False]:
                raise AssertionError("unsupported copy was summarized or changed")
            results.append({"bytes": count, "highCountBits": high, "overlap": overlap, "declined": True, "equal": True})
    helper = Path(__file__).with_name("verified_copy_loop.py")
    report = {"schemaVersion": 1, "status": "native-copy-differential-check", "runtimePromotion": False,
              "stage1Sha256": digest, "summaryScriptSha256": hashlib.sha256(helper.read_bytes()).hexdigest(),
              "testScriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "unicornVersion": un.__version__, "cases": results, "registers": list(names),
              "memoryCompared": ["source64KiB", "destination64KiB", "stack64KiB"]}
    with args.output.open("x") as stream:
        stream.write(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": len(results), "output": str(args.output)}))


if __name__ == "__main__":
    main()
