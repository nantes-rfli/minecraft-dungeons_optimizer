import hashlib
import struct
import unittest

from self_file_model import SelfFileModel, Unmodeled, corrected_smbios_fixture


class Memory:
    def __init__(self):
        self.regions = {0x1000: bytearray(b"\xCC" * 0x4000)}
        self.writes = []
        self.maps = []

    def locate(self, address, size):
        for base, data in self.regions.items():
            if base <= address and address + size <= base + len(data):
                return data, address - base
        raise ValueError("outside guest buffer")

    def read(self, address, size):
        data, offset = self.locate(address, size)
        return bytes(data[offset:offset + size])

    def write(self, address, payload):
        data, offset = self.locate(address, len(payload))
        data[offset:offset + len(payload)] = payload
        self.writes.append((address, len(payload)))

    def map(self, address, size):
        if address in self.regions:
            raise ValueError("duplicate map")
        self.regions[address] = bytearray(size)
        self.maps.append((address, size))

    def unmap(self, address, size):
        if len(self.regions[address]) != size:
            raise ValueError("wrong map size")
        del self.regions[address]


class SelfFileTests(unittest.TestCase):
    def setUp(self):
        self.memory = Memory()
        self.data = b"MZ\x00\x01hello-native-exe"
        self.path = r"C:\ResearchGame\Dungeons\Binaries\Win64\Dungeons-Win64-Shipping.exe"
        self.memory.write(0x1000, (self.path + "\0").encode("utf-16le"))
        self.model = SelfFileModel(self.data, self.path, self.memory.read,
                                   self.memory.write, self.memory.map, self.memory.unmap)
        self.open_args = [0x1000, 0x80000000, 1, 0, 3, 0x20, 0]
        self.handle = self.model.FILE_HANDLE

    def open(self):
        self.assertEqual(self.model.handle("CreateFileW", self.open_args)["returnValue"],
                         self.handle)
        self.memory.writes.clear()

    def test_exact_path_and_flags_only(self):
        for index, value in [(1, 0x40000000), (2, 3), (3, 1), (4, 2), (5, 0x40000020), (6, 1)]:
            args = self.open_args.copy()
            args[index] = value
            with self.subTest(index=index), self.assertRaises(Unmodeled):
                self.model.handle("CreateFileW", args)
        self.memory.write(0x1000, b"D\0")
        with self.assertRaises(Unmodeled):
            self.model.handle("CreateFileW", self.open_args)
        self.assertFalse(self.model.file_open)

    def test_read_exact_writes_short_read_and_eof(self):
        self.open()
        result = self.model.handle("ReadFile", [self.handle, 0x2000, 5, 0x3000, 0])
        self.assertEqual(self.memory.read(0x2000, 6), self.data[:5] + b"\xCC")
        self.assertEqual(self.memory.read(0x3000, 4), struct.pack("<I", 5))
        self.assertEqual(self.memory.writes, [(0x3000, 4), (0x2000, 5), (0x3000, 4)])
        self.assertEqual(result["metadata"]["payloadSha256"], hashlib.sha256(self.data[:5]).hexdigest())
        result = self.model.handle("ReadFile", [self.handle, 0x2100, 100, 0x3000, 0])
        self.assertEqual(result["metadata"]["readBytes"], len(self.data) - 5)
        self.memory.writes.clear()
        result = self.model.handle("ReadFile", [self.handle, 0x2200, 100, 0x3000, 0])
        self.assertEqual(result["returnValue"], 1)
        self.assertEqual(result["metadata"]["readBytes"], 0)
        self.assertEqual(self.memory.writes, [(0x3000, 4), (0x3000, 4)])

    def test_rejected_reads_do_not_write(self):
        self.open()
        for args in ([self.handle, 0x2000, 5, 0, 0],
                     [self.handle, 0x2000, 5, 0x3000, 1],
                     [self.handle, 0x2000, 0xFFFFFFFF, 0x3000, 0],
                     [self.handle, 0x2000, 5, 0x2002, 0],
                     [self.handle + 1, 0x2000, 5, 0x3000, 0]):
            with self.subTest(args=args), self.assertRaises(Unmodeled):
                self.model.handle("ReadFile", args)
        self.assertEqual(self.memory.writes, [])
        self.assertEqual(self.model.position, 0)

    def test_signed_seeks_with_and_without_high(self):
        self.open()
        result = self.model.handle("SetFilePointer", [self.handle, 0xFFFFFFFE, 0, 2])
        self.assertEqual(result["returnValue"], len(self.data) - 2)
        self.memory.write(0x3000, struct.pack("<I", 0xFFFFFFFF))
        result = self.model.handle("SetFilePointer", [self.handle, 0xFFFFFFFD, 0x3000, 1])
        self.assertEqual(result["returnValue"], len(self.data) - 5)
        self.assertEqual(self.memory.read(0x3000, 4), b"\0" * 4)
        before = self.model.position
        for args in ([self.handle, 0xFFFFFFFF, 0, 0],
                     [self.handle, 1, 0, 2], [self.handle, 0, 0, 3]):
            with self.assertRaises(Unmodeled):
                self.model.handle("SetFilePointer", args)
        self.assertEqual(self.model.position, before)

    def test_size_close_and_unknown(self):
        self.open()
        self.assertEqual(self.model.handle("GetFileSize", [self.handle, 0x3000])["returnValue"], len(self.data))
        self.assertEqual(self.memory.read(0x3000, 4), b"\0" * 4)
        self.assertIsNone(self.model.handle("WriteFile", []))
        self.model.handle("CloseHandle", [self.handle])
        with self.assertRaises(Unmodeled):
            self.model.handle("ReadFile", [self.handle, 0x2000, 1, 0x3000, 0])

    def test_mapping_is_pinned_and_independent_of_file_handle(self):
        self.open()
        mapping = self.model.handle("CreateFileMappingW", [self.handle, 0, 2, 0, 0, 0])["returnValue"]
        self.model.handle("CloseHandle", [self.handle])
        result = self.model.handle("MapViewOfFile", [mapping, 4, 0, 0, 0])
        view = result["returnValue"]
        self.assertEqual(self.memory.read(view, len(self.data)), self.data)
        self.assertEqual(self.memory.read(view + len(self.data), 1), b"\0")
        self.assertEqual(self.memory.maps, [(view, 4096)])
        self.model.handle("CloseHandle", [mapping])
        self.assertEqual(self.memory.read(view, 2), b"MZ")
        self.model.handle("UnmapViewOfFile", [view])
        self.assertNotIn(view, self.memory.regions)

    def test_mapping_rejects_writable_sizes_offsets_and_duplicate(self):
        self.open()
        for args in ([self.handle, 0, 4, 0, 0, 0], [self.handle, 0, 2, 0, 1, 0]):
            with self.assertRaises(Unmodeled):
                self.model.handle("CreateFileMappingW", args)
        mapping = self.model.handle("CreateFileMappingW", [self.handle, 0, 2, 0, 0, 0])["returnValue"]
        for args in ([mapping, 2, 0, 0, 0], [mapping, 4, 0, 1, 0], [mapping, 4, 0, 0, 2]):
            with self.assertRaises(Unmodeled):
                self.model.handle("MapViewOfFile", args)
        self.assertEqual(self.memory.maps, [])
        self.model.handle("MapViewOfFile", [mapping, 4, 0, 0, 0])
        with self.assertRaises(Unmodeled):
            self.model.handle("MapViewOfFile", [mapping, 4, 0, 0, 0])

    def test_smbios_header_records_and_terminators(self):
        fixture = corrected_smbios_fixture()
        self.assertEqual(fixture, corrected_smbios_fixture())
        self.assertEqual(struct.unpack_from("<I", fixture, 4)[0], len(fixture) - 8)
        table = fixture[8:]
        self.assertEqual(table[:2], bytes([1, 0x1B]))
        self.assertEqual(table[8:24], bytes(range(16)))
        strings_end = table.index(b"\0\0", 0x1B) + 2
        self.assertEqual(table[0x1B:strings_end - 2].split(b"\0"),
                         [b"CodexTest", b"MCDSynthetic", b"RevA", b"SerialX", b"SKU", b"Family"])
        self.assertEqual(table[strings_end:], bytes([127, 4, 0xFF, 0xFF, 0, 0]))


if __name__ == "__main__":
    unittest.main()
