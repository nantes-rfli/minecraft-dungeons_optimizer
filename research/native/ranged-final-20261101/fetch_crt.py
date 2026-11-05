#!/usr/bin/env python3
"""Fetch only two pinned reference DLLs from the official Microsoft NuGet ZIP.

The package is a reference environment, not evidence of the game's loaded CRT.
No game/DLL binary belongs in the repository. Use a private --output-dir.
"""
import argparse
import hashlib
import json
import struct
import urllib.request
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIMIT = 8 * 1024 * 1024


def fetch(url, byte_range):
    req = urllib.request.Request(url, headers={'Range': 'bytes=' + byte_range})
    with urllib.request.urlopen(req, timeout=30) as response:
        if response.status != 206:
            raise RuntimeError('Server must support bounded HTTP Range responses')
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise RuntimeError('Response exceeds bounded read size')
    return data


def download(records, output):
    url, = {r['url'] for r in records}
    wanted = {r['entry']: r for r in records}
    tail = fetch(url, '-65536')
    p = tail.rfind(b'PK\x05\x06')
    assert p >= 0
    e = struct.unpack_from('<4s4H2IH', tail, p)
    assert e[1:3] == (0, 0) and e[3] == e[4]  # Non-ZIP64 single volume.
    size, offset = e[5:7]
    assert 0 < size <= LIMIT
    directory = fetch(url, f'{offset}-{offset+size-1}')
    assert len(directory) == size
    pos, found = 0, set()
    while pos < len(directory):
        h = struct.unpack_from('<4s6H3I5H2I', directory, pos)
        assert h[0] == b'PK\x01\x02'
        name = directory[pos+46:pos+46+h[10]].decode()
        pos += 46 + h[10] + h[11] + h[12]
        if name not in wanted:
            continue
        assert name not in found and h[4] in (0, 8) and not h[3] & 1
        assert h[9] == wanted[name]['size'] and 0 < h[8] <= LIMIT
        loc = h[-1]
        header = fetch(url, f'{loc}-{loc+29}')
        lh = struct.unpack('<4s5H3I2H', header)
        assert lh[0] == b'PK\x03\x04'
        start = loc + 30 + lh[-2] + lh[-1]
        compressed = fetch(url, f'{start}-{start+h[8]-1}')
        assert len(compressed) == h[8]
        data = zlib.decompress(compressed, -15) if h[4] == 8 else compressed
        assert len(data) == h[9] and zlib.crc32(data) == h[7]
        assert hashlib.sha256(data).hexdigest() == wanted[name]['sha256']
        (output / Path(name).name).write_bytes(data)
        found.add(name)
    assert found == set(wanted)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output-dir', required=True)
    p.add_argument('--check-existing', action='store_true')
    args = p.parse_args()
    output = Path(args.output_dir).resolve()
    assert HERE not in output.parents and output != HERE, 'Use a private directory'
    records = json.loads((HERE / 'crt-download.json').read_text())
    if not args.check_existing:
        output.mkdir(parents=True, exist_ok=True)
        download(records, output)
    for r in records:
        data = (output / Path(r['entry']).name).read_bytes()
        assert len(data) == r['size']
        assert hashlib.sha256(data).hexdigest() == r['sha256']
    print(json.dumps({'filesVerified': len(records), 'gameProviderConfirmed': False}))


if __name__ == '__main__':
    main()
