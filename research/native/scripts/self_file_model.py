"""Bounded guest-only model of reads from one pinned, in-memory executable.

Unknown calls return None; unsupported arguments raise Unmodeled without claiming
a Windows result. Memory callbacks operate on guest memory only. map_memory must
create a read-only guest mapping; write_memory is the emulator's host-side writer.
This module never opens a host path or maps a host file.
"""

import hashlib
import struct


class Unmodeled(Exception):
    """The call is outside the deliberately narrow counterfactual model."""


def corrected_smbios_fixture():
    """Return deterministic synthetic RawSMBIOSData with Type 1 and Type 127.

    No value describes a real device. The size query and fill must both use
    len(result); the Length field covers the table, excluding the eight-byte
    RawSMBIOSData header. The Type 127 record includes its double-NUL terminator.
    """
    system = bytearray(0x1B)
    system[:4] = bytes([1, 0x1B, 0, 1])
    system[4:8] = bytes([1, 2, 3, 4])
    system[8:24] = bytes(range(16))
    system[24:27] = bytes([2, 5, 6])
    strings = b"CodexTest\0MCDSynthetic\0RevA\0SerialX\0SKU\0Family\0\0"
    table = bytes(system) + strings + bytes([127, 4, 0xFF, 0xFF, 0, 0])
    return bytes([0, 3, 2, 0]) + struct.pack("<I", len(table)) + table


class SelfFileModel:
    FILE_HANDLE = 0x950000
    MAPPING_HANDLE = 0x950001
    VIEW_ADDRESS = 0xC1000000
    MAX_READ = 128 * 1024 * 1024

    def __init__(self, data, exact_path, read_memory, write_memory,
                 map_memory=None, unmap_memory=None):
        self.data = bytes(data)
        if not self.data or len(self.data) > self.MAX_READ:
            raise ValueError("pinned input must be nonempty and at most 128 MiB")
        self.exact_path = exact_path
        self.path_bytes = (exact_path + "\0").encode("utf-16le")
        self.read_memory = read_memory
        self.write_memory = write_memory
        self.map_memory = map_memory
        self.unmap_memory = unmap_memory
        self.file_open = False
        self.mapping_open = False
        self.view_size = None
        self.position = 0
        self.read_count = 0
        self.bytes_read = 0
        self.sha256 = hashlib.sha256(self.data).hexdigest()

    @staticmethod
    def _dword(value):
        return value & 0xFFFFFFFF

    @staticmethod
    def _signed(value, bits):
        value &= (1 << bits) - 1
        return value - (1 << bits) if value & (1 << (bits - 1)) else value

    @staticmethod
    def _require(condition, reason):
        if not condition:
            raise Unmodeled(reason)

    def _read(self, address, size):
        self._require(address > 0 and size >= 0, "invalid guest read range")
        try:
            result = bytes(self.read_memory(address, size))
        except Exception as exc:
            raise Unmodeled("unreadable guest buffer") from exc
        self._require(len(result) == size, "short guest memory read")
        return result

    def _write(self, address, payload):
        self._require(address > 0, "null guest output pointer")
        try:
            self.write_memory(address, payload)
        except Exception as exc:
            raise Unmodeled("unwritable guest output buffer") from exc

    def _file(self, handle):
        self._require(handle == self.FILE_HANDLE and self.file_open,
                      "unknown or closed self-file handle")

    def _result(self, value, **metadata):
        return {"returnValue": value, "metadata": metadata}

    def handle(self, name, args):
        """args includes stack arguments already decoded by the caller."""
        arities = {"CreateFileW": 7, "GetFileSize": 2, "ReadFile": 5,
                   "SetFilePointer": 4, "CloseHandle": 1,
                   "CreateFileMappingW": 6, "MapViewOfFile": 5,
                   "UnmapViewOfFile": 1}
        if name not in arities:
            return None
        self._require(len(args) == arities[name], "wrong argument count for " + name)

        if name == "CreateFileW":
            path, access, share, security, disposition, attributes, template = args
            self._require(not self.file_open, "second simultaneous self-file open")
            self._require((self._dword(access), self._dword(share), security,
                           self._dword(disposition), self._dword(attributes), template)
                          == (0x80000000, 1, 0, 3, 0x20, 0),
                          "unmodeled self-file open flags")
            self._require(self._read(path, len(self.path_bytes)) == self.path_bytes,
                          "path is not the exact synthetic self executable")
            self.file_open = True
            self.position = 0
            return self._result(self.FILE_HANDLE, inputBytes=len(self.data),
                                inputSha256=self.sha256)

        if name == "CloseHandle":
            handle = args[0]
            if handle == self.MAPPING_HANDLE:
                self._require(self.mapping_open, "mapping handle already closed")
                self.mapping_open = False
            else:
                self._file(handle)
                self.file_open = False
            return self._result(1)

        if name == "CreateFileMappingW":
            handle, security, protection, high, low, mapping_name = args
            self._file(handle)
            self._require((security, self._dword(protection), self._dword(high),
                           self._dword(low), mapping_name) == (0, 2, 0, 0, 0),
                          "unmodeled self-file mapping flags or size")
            self._require(not self.mapping_open and self.view_size is None,
                          "second self-file mapping")
            self.mapping_open = True
            return self._result(self.MAPPING_HANDLE, mappedFileBytes=len(self.data),
                                inputSha256=self.sha256)

        if name == "MapViewOfFile":
            handle, access, high, low, requested = args
            self._require(handle == self.MAPPING_HANDLE and self.mapping_open,
                          "unknown or closed mapping handle")
            self._require((self._dword(access), self._dword(high), self._dword(low),
                           requested) == (4, 0, 0, 0),
                          "only complete read-only self-file view is modeled")
            self._require(self.view_size is None, "second mapped view")
            self._require(self.map_memory is not None and self.unmap_memory is not None,
                          "guest mapping callbacks unavailable")
            size = (len(self.data) + 4095) & ~4095
            try:
                self.map_memory(self.VIEW_ADDRESS, size)
            except Exception as exc:
                raise Unmodeled("cannot allocate guest read-only view") from exc
            self.view_size = size
            self._write(self.VIEW_ADDRESS, self.data)
            return self._result(self.VIEW_ADDRESS, fileOffset=0,
                                mappedFileBytes=len(self.data), mappedPageBytes=size,
                                inputSha256=self.sha256)

        if name == "UnmapViewOfFile":
            self._require(args[0] == self.VIEW_ADDRESS and self.view_size is not None,
                          "unknown or inactive view")
            try:
                self.unmap_memory(self.VIEW_ADDRESS, self.view_size)
            except Exception as exc:
                raise Unmodeled("cannot unmap guest view") from exc
            self.view_size = None
            return self._result(1)

        self._file(args[0])
        if name == "GetFileSize":
            if args[1]:
                self._write(args[1], struct.pack("<I", len(self.data) >> 32))
            return self._result(len(self.data) & 0xFFFFFFFF, fileBytes=len(self.data))

        if name == "ReadFile":
            _, buffer, count, count_pointer, overlapped = args
            count = self._dword(count)
            self._require(overlapped == 0 and count_pointer != 0,
                          "only synchronous reads with byte-count output are modeled")
            self._require(buffer > 0 and count <= self.MAX_READ,
                          "read exceeds modeled buffer/count bounds")
            before = self.position
            payload = self.data[before:before + count]
            # The count output and data must not alias in this bounded model.
            self._require(not (buffer < count_pointer + 4
                               and count_pointer < buffer + len(payload)),
                          "overlapping data and byte-count outputs")
            self._write(count_pointer, struct.pack("<I", 0))
            if payload:
                self._write(buffer, payload)
            self._write(count_pointer, struct.pack("<I", len(payload)))
            self.position += len(payload)
            self.read_count += 1
            self.bytes_read += len(payload)
            return self._result(1, fileOffset=before, requestedBytes=count,
                                readBytes=len(payload), nextFileOffset=self.position,
                                payloadSha256=hashlib.sha256(payload).hexdigest())

        if name == "SetFilePointer":
            _, low, high_pointer, method = args
            method = self._dword(method)
            self._require(method in (0, 1, 2), "unknown seek origin")
            if high_pointer:
                high = struct.unpack("<I", self._read(high_pointer, 4))[0]
                delta = self._signed((high << 32) | self._dword(low), 64)
            else:
                delta = self._signed(low, 32)
            before = self.position
            origin = (0, before, len(self.data))[method]
            target = origin + delta
            # Windows permits past-EOF seeks; they are intentionally unmodeled.
            self._require(0 <= target <= len(self.data), "seek outside pinned file")
            if high_pointer:
                self._write(high_pointer, struct.pack("<I", target >> 32))
            self.position = target
            return self._result(target & 0xFFFFFFFF, previousFileOffset=before,
                                nextFileOffset=target)

        raise AssertionError("known API did not reach a handler")
