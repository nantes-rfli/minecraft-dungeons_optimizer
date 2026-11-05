"""Small PE32+ reader for a hash-pinned CRT. No DLL loading or Windows APIs."""
import hashlib
import struct
from pathlib import Path


class PE:
    def __init__(self, path):
        self.path = Path(path)
        self.raw = r = self.path.read_bytes()
        assert r[:2] == b'MZ'
        p = struct.unpack_from('<I', r, 0x3c)[0]
        assert r[p:p+4] == b'PE\0\0'
        assert struct.unpack_from('<H', r, p+4)[0] == 0x8664
        o = p+24
        assert struct.unpack_from('<H', r, o)[0] == 0x20b
        self.base = struct.unpack_from('<Q', r, o+24)[0]
        size = struct.unpack_from('<I', r, o+56)[0]
        self.im = bytearray(size)
        n = struct.unpack_from('<H', r, p+6)[0]
        osz = struct.unpack_from('<H', r, p+20)[0]
        hs = struct.unpack_from('<I', r, o+60)[0]
        self.im[:hs] = r[:hs]
        self.sections = []
        for a in range(o+osz, o+osz+n*40, 40):
            name = r[a:a+8].rstrip(b'\0').decode()
            vs, va, rs, off = struct.unpack_from('<4I', r, a+8)
            assert va+rs <= size and off+rs <= len(r)
            self.im[va:va+rs] = r[off:off+rs]
            self.sections.append((name, va, vs))
        e, esz = struct.unpack_from('<II', r, o+112)
        nf, nn, af, an, ao = struct.unpack_from('<5I', self.im, e+20)
        self.exports = {}
        for i in range(nn):
            name = self.cstr(self.u32(an+4*i))
            idx = struct.unpack_from('<H', self.im, ao+2*i)[0]
            assert idx < nf
            val = self.u32(af+4*idx)
            self.exports[name] = self.cstr(val) if e <= val < e+esz else val
        self.sha256 = hashlib.sha256(r).hexdigest()

    def u32(self, a):
        return struct.unpack_from('<I', self.im, a)[0]

    def cstr(self, a):
        return bytes(self.im[a:self.im.index(0, a)]).decode()


def import_checksum(name):
    x = 0xffffffff
    for b in name.encode('ascii')+b'\0':
        x ^= b
        for _ in range(8):
            x = (x >> 1) ^ (0x54495041 if x & 1 else 0)
    return x ^ 0xffffffff
