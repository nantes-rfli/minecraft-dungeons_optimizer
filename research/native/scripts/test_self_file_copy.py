"""Fail-closed summary guards; actual native equivalence is checked separately."""
from types import SimpleNamespace
import unittest

from verified_copy_loop import copy_prefix, install, verify_code


class CopySummaryGuardTests(unittest.TestCase):
    def emulator(self, count=16, source=0x1000, target=0x2000):
        regs = {"rsi": source, "rdi": target, "rcx": count}
        writes = []
        emu = SimpleNamespace(reg_read=lambda name: regs[name],
                              reg_write=lambda name, value: regs.__setitem__(name, value),
                              mem_read=lambda address, size: bytes(size),
                              mem_write=lambda address, data: writes.append((address, data)))
        return emu, regs, writes

    def test_unsupported_counts_and_overlaps_have_no_side_effects(self):
        for count, source, target in ((0, 0x1000, 0x2000), (1, 0x1000, 0x2000),
                                      (1 << 32, 0x1000, 0x2000), (16, 0x1000, 0x1001),
                                      (16, 0x1001, 0x1000), (16, 0x1000, 0x1000)):
            emu, regs, writes = self.emulator(count, source, target)
            before = regs.copy()
            with self.subTest(count=count, source=source, target=target):
                self.assertFalse(copy_prefix(emu, {k: k for k in regs}, source, target, count))
                self.assertEqual(regs, before)
                self.assertEqual(writes, [])

    def test_register_mismatch_fails_before_writing(self):
        emu, regs, writes = self.emulator()
        with self.assertRaisesRegex(ValueError, "registers changed"):
            copy_prefix(emu, {k: k for k in regs}, 0x1001, 0x2000, 16)
        self.assertEqual(writes, [])

    def test_modified_code_is_rejected(self):
        emu, _, writes = self.emulator()
        with self.assertRaisesRegex(ValueError, "instruction hash mismatch"):
            verify_code(emu, 0x140000000)
        self.assertEqual(writes, [])

    def test_unbound_copy_is_not_accelerated(self):
        base, source, count = 0x140000000, 0xA0020000, 512
        for failure in ("untracked-allocation", "wrong-protection", "wrong-section-size"):
            emu, regs, writes = self.emulator(count, source, base + 0x1000)
            hooks = []
            emu.hook_add = lambda *args, **kwargs: hooks.append(args[1])
            state = {"u": emu, "base": base, "imageSize": 0x6000000,
                     "UC_X86_REG_RSI": "rsi", "UC_X86_REG_RDI": "rdi", "UC_X86_REG_RCX": "rcx",
                     "sections": [{"index": 0, "rva": 0x1000, "virtualSize": 500}],
                     "virtualAllocations": {source: 4096},
                     "events": [{"name": "VirtualProtect", "args": [hex(base + 0x1000), hex(count), "0x4"]}],
                     "un": SimpleNamespace(UC_HOOK_CODE=1)}
            if failure == "untracked-allocation":
                state["virtualAllocations"] = {}
            elif failure == "wrong-protection":
                state["events"][0]["args"][2] = "0x20"
            else:
                state["sections"][0]["virtualSize"] = 1024
            observation = {}
            install(state, None, observation)
            hooks[0](emu, 0, 0, None)
            self.assertEqual(writes, [])
            self.assertEqual(observation["verifiedCopies"], [])


if __name__ == "__main__":
    unittest.main()
