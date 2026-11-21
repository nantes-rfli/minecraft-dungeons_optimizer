#!/usr/bin/env python3
"""Independent bounded branch replay; synthetic state, not a game observation.

Written by the integrating reviewer from directly inspected image instructions,
without importing the Chains analyst's implementation or its expected output.
No engine/API result is fabricated. Stop before any call or unknown instruction.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

IMAGE_SHA256 = '04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3'
BASE = 0x140000000
SPANS = [
    ('selected-neighbor guard and primary append', 0xa66bc0, 0xa66c60,
     'fbe76493195017add4c9cc0f1ef0a4017a9936b64c0adc8dc22dcafaccc5135b'),
    ('query excludes primary and checks predicate/distance', 0x820fc0, 0x821090,
     '2bba11ab7eddfa22f4544340ba98f905f7a9577bcb042b53077acc6504e369d9'),
]


def review(local_root):
    sys.path.insert(0, str(local_root / 'phase6.8/native-stage2/tools'))
    import capstone
    import unicorn
    from unicorn import x86_const as x
    assert capstone.__version__ == '5.0.6'
    assert unicorn.__version__ == '2.1.4'
    image = (local_root / 'phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a/mapped-image.bin').read_bytes()
    assert hashlib.sha256(image).hexdigest() == IMAGE_SHA256
    cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    records = []
    for role, start, end, digest in SPANS:
        assert hashlib.sha256(image[start:end]).hexdigest() == digest
        records.append({'role': role, 'startRva': hex(start), 'endRvaExclusive': hex(end), 'sha256': digest})
    expected_ins = {
        0xa66bf6: ('movsxd', 'rdi, dword ptr [rbp - 0x51]'),
        0xa66bfa: ('test', 'edi, edi'),
        0xa66bfc: ('je', '0xa66ca5'),
        0xa66c02: ('lea', 'eax, [rdi + 1]'),
        0xa66c05: ('mov', 'dword ptr [rbp - 0x51], eax'),
        0xa66c20: ('mov', 'rdx, qword ptr [rbp - 0x61]'),
        0xa66c24: ('call', '0x1254ba0'),
        0x821000: ('cmp', 'rbx, rsi'),
        0x821003: ('je', '0x821058'),
        0x82102c: ('call', '0xc26c40'),
        0x821031: ('comiss', 'xmm0, xmm6'),
        0x821034: ('ja', '0x821058'),
    }
    for rva, expected in expected_ins.items():
        instruction = next(cs.disasm(image[rva:rva+15], rva))
        assert (instruction.mnemonic, instruction.op_str) == expected, hex(rva)

    def machine(start, stops, registers, stack_values=()):
        u = unicorn.Uc(unicorn.UC_ARCH_X86, unicorn.UC_MODE_64)
        page = start & ~0xfff
        u.mem_map(BASE+page, 0x2000)
        u.mem_write(BASE+page, image[page:page+0x2000])
        u.mem_map(0x70000000, 0x2000)
        for reg, value in registers.items():
            u.reg_write(reg, value)
        for address, value in stack_values:
            u.mem_write(address, struct.pack('<i', value))
        visited = []
        def step(uc, address, size, _):
            rva = address-BASE
            visited.append(hex(rva))
            if rva in stops:
                uc.emu_stop()
            else:
                instruction = next(cs.disasm(bytes(uc.mem_read(address, size)), rva))
                assert instruction.mnemonic not in ('call', 'ret'), 'Unexpected call/return'
        u.hook_add(unicorn.UC_HOOK_CODE, step)
        u.emu_start(BASE+start, 0, timeout=100000, count=32)
        stop = u.reg_read(x.UC_X86_REG_RIP)-BASE
        assert stop in stops, 'Bound exceeded; no timeout/resume'
        return u, stop, visited

    results = []
    rbp = 0x70001000
    for count in (0, 1, 2, 3, 12, 100, 1024):
        u, stop, path = machine(0xa66bf6, {0xa66ca5, 0xa66c18},
                               {x.UC_X86_REG_RBP: rbp},
                               [(rbp-0x51, count), (rbp-0x4d, count+1)])
        after = struct.unpack('<i', u.mem_read(rbp-0x51, 4))[0]
        assert stop == (0xa66ca5 if count == 0 else 0xa66c18)
        assert after == (0 if count == 0 else count+1)
        results.append({'kind': 'selected-neighbor-count', 'inputCount': count,
                        'outputCount': after, 'stopRva': hex(stop), 'visited': path})
    for primary, candidate in [(0x60001000, 0x60001000), (0x60001000, 0x60002000),
                               (0x60002000, 0x60001000), (0x60002000, 0x60002000)]:
        _, stop, path = machine(0x821000, {0x821058, 0x821005},
                               {x.UC_X86_REG_RSI: primary, x.UC_X86_REG_RBX: candidate})
        assert stop == (0x821058 if primary == candidate else 0x821005)
        results.append({'kind': 'primary-exclusion', 'samePointer': primary == candidate,
                        'stopRva': hex(stop), 'visited': path})
    return {'kind': 'independent-conditional-instruction-review', 'imageSha256': IMAGE_SHA256,
            'nativeSpans': records, 'instructionAssertions': len(expected_ins),
            'cases': len(results), 'mismatches': 0, 'results': results,
            'limits': ['Synthetic stack and object-pointer inputs; no game process.',
                       'No query, target filter, allocation or application callback executed.',
                       'Nonempty cases stop before the primary append helper.',
                       'Independent reviewer implementation; same image and emulator are not an independent game oracle.',
                       'No R3 holdout, Evidence Adoption or Runtime Promotion is established.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-root', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    text = json.dumps(review(args.local_root), indent=2) + '\n'
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end='')
