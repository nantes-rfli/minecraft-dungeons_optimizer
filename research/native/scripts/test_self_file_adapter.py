"""Exercise file-view hook lifetime through the installed API adapter."""
import struct
import types
import unittest

from continue_self_file import install_extension
from test_self_file_model import Memory


class Guest:
    def __init__(self):
        self.memory = Memory()
        self.registers = {"RSP": 0x3000, "RIP": 0x144CF723C}
        self.read_hooks = {}
        self.next_hook = 0

    def mem_read(self, address, size):
        return self.memory.read(address, size)

    def mem_write(self, address, payload):
        self.memory.write(address, payload)

    def mem_map(self, address, size, permission):
        if permission != 1:
            raise AssertionError("file view must be read-only")
        self.memory.map(address, size)

    def mem_unmap(self, address, size):
        self.memory.unmap(address, size)

    def reg_read(self, register):
        return self.registers.get(register, 0)

    def hook_add(self, kind, callback, **bounds):
        self.next_hook += 1
        self.read_hooks[self.next_hook] = (callback, bounds)
        return self.next_hook

    def hook_del(self, handle):
        del self.read_hooks[handle]

    def read_view(self, count):
        # A memory read invokes every active hook whose address range matches.
        for _ in range(count):
            for callback, bounds in list(self.read_hooks.values()):
                address = 0xC1000000
                if bounds["begin"] <= address <= bounds["end"]:
                    callback(self, 0, address, 1, 0, None)


class AdapterHookTests(unittest.TestCase):
    def setUp(self):
        self.guest = Guest()
        self.path = r"C:\ResearchGame\Dungeons\Binaries\Win64\Dungeons-Win64-Shipping.exe"
        self.guest.mem_write(0x1000, (self.path + "\0").encode("utf-16le"))
        self.guest.mem_write(0x3000, struct.pack("<Q", 0x140012345))
        self.stops = []
        self.g = {
            "u": self.guest,
            "un": types.SimpleNamespace(UC_PROT_READ=1, UC_HOOK_MEM_READ=16),
            "data": b"MZ-test-pinned-input",
            "commandLine": '"' + self.path + '"',
            "api": lambda *args: self.fail("unexpected legacy API dispatch"),
            "base": 0x140000000,
            "events": [],
            "ret": lambda value: None,
            "stop": self.stops.append,
            "stubmap": {
                1: ("kernel32.dll", "CreateFileW"),
                2: ("kernel32.dll", "CreateFileMappingW"),
                3: ("kernel32.dll", "MapViewOfFile"),
                4: ("kernel32.dll", "UnmapViewOfFile"),
            },
        }
        for name in ("RCX", "RDX", "R8", "R9", "RSP", "RIP"):
            self.g["UC_X86_REG_" + name] = name
        install_extension(self.g, types.SimpleNamespace(profile="legacy"))
        self.call(1, [0x1000, 0x80000000, 1, 0, 3, 0x20, 0])
        self.call(2, [0x950000, 0, 2, 0, 0, 0])

    def call(self, target, args):
        for register, value in zip(("RCX", "RDX", "R8", "R9"), args[:4] + [0] * 4):
            self.guest.registers[register] = value
        for index, value in enumerate(args[4:]):
            self.guest.mem_write(0x3028 + 8 * index, struct.pack("<Q", value))
        self.g["api"](self.guest, target, 0, None)

    def map_view(self):
        self.call(3, [0x950001, 4, 0, 0, 0])
        self.assertEqual(self.stops, [])

    def unmap_view(self):
        self.call(4, [0xC1000000])
        self.assertEqual(self.stops, [])

    def test_remapping_after_cap_does_not_restart_collection(self):
        self.map_view()
        self.guest.read_view(300)
        self.assertEqual(len(self.g["selfFileReads"]), 256)
        self.assertEqual(self.guest.read_hooks, {})
        self.unmap_view()
        self.map_view()
        self.guest.read_view(300)
        self.assertEqual(len(self.g["selfFileReads"]), 256)
        self.assertEqual(self.guest.read_hooks, {})

    def test_partial_collection_unmaps_without_duplicate_hooks(self):
        self.map_view()
        self.guest.read_view(10)
        self.unmap_view()
        self.assertEqual(self.guest.read_hooks, {})
        self.map_view()
        self.assertEqual(len(self.guest.read_hooks), 1)
        self.guest.read_view(300)
        self.assertEqual(len(self.g["selfFileReads"]), 256)
        self.assertEqual(self.guest.read_hooks, {})

    def test_rejected_mapping_does_not_install_read_hook(self):
        self.call(3, [0x950001, 2, 0, 0, 0])
        self.assertEqual(len(self.stops), 1)
        self.assertIn("unmodeled self-file boundary", self.stops[0])
        self.assertEqual(self.guest.read_hooks, {})
        self.assertEqual(self.g["selfFileReads"], [])


if __name__ == "__main__":
    unittest.main()
