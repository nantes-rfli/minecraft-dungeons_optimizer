"""A hash-bound summary of one native byte-copy loop; not gameplay semantics.

Only a nonoverlapping copy from a tracked allocation into an original PE section
is eligible. Keep the final native iteration to produce AL, flags and stack
scratch bytes exactly. No API return or branch predicate is replaced.
"""
import hashlib

HOOK_RVA = 0x4F7D4A9
EXIT_RVA = 0x4EF4A8A
BLOCKS = (
    (0x4BC41E3, 5), (0x4F72ACC, 7), (0x4F74E4D, 5), (0x4F74EFF, 7),
    (0x4F74F53, 5), (0x4F7B995, 5), (0x4F7BA89, 5), (0x4F7BB11, 49),
    (0x4F7BBA0, 5), (0x4F7D4A9, 7), (0x4F7D573, 5), (0x4F808C3, 5),
    (0x4F80962, 9), (0x4F809C8, 5), (0x4F9977F, 5), (0x4F997D6, 9),
    (0x4F99822, 5), (0x4F9B00A, 6), (0x4F9B010, 5),
)
BLOCK_SHA256 = "2e04886158df1e641bdb107728c3f43ea342eaf8b162765b403bb5be79386662"


def verify_code(emu, base):
    code = b"".join(bytes(emu.mem_read(base + rva, size)) for rva, size in BLOCKS)
    if hashlib.sha256(code).hexdigest() != BLOCK_SHA256:
        raise ValueError("copy-loop instruction hash mismatch")


def copy_prefix(emu, registers, source, destination, count):
    """Summarize n-1 iterations at the checked pre-load PC; leave n=1 native."""
    if not 1 < count <= 0xFFFFFFFF:
        return False
    if not (source + count <= destination or destination + count <= source):
        return False
    if any(emu.reg_read(registers[name]) != value for name, value in
           (("rsi", source), ("rdi", destination), ("rcx", count))):
        raise ValueError("copy-loop registers changed before summary")
    prefix = count - 1
    data = bytes(emu.mem_read(source, prefix))
    emu.mem_write(destination, data)
    emu.reg_write(registers["rsi"], source + prefix)
    emu.reg_write(registers["rdi"], destination + prefix)
    emu.reg_write(registers["rcx"], 1)
    return True


def install(g, output, observation):
    emu, base = g["u"], g["base"]
    registers = {name: g["UC_X86_REG_" + name.upper()] for name in ("rsi", "rdi", "rcx")}
    copies = observation.setdefault("verifiedCopies", [])

    def at_copy(engine, address, size, user):
        source, destination, count = (engine.reg_read(registers[k]) for k in ("rsi", "rdi", "rcx"))
        section = next((s for s in g["sections"] if s["index"] < 8
                        and destination == base + s["rva"]
                        and count == (s["virtualSize"] + 511) // 512 * 512), None)
        if section is None or not 1 < count <= g["imageSize"]:
            return
        if source not in g["virtualAllocations"] or g["virtualAllocations"][source] < count:
            return
        last = g["events"][-1] if g["events"] else {}
        if last.get("name") != "VirtualProtect" or last.get("args", [])[:3] != [hex(destination), hex(count), "0x4"]:
            return
        if not (source + count <= destination or destination + count <= source):
            g["stop"]("overlapping section copy is outside verified summary")
            return
        try:
            verify_code(engine, base)
            payload = bytes(engine.mem_read(source, count))
            filename = f"copy-source-{section['index']:02d}-{len(copies):02d}.bin"
            path = output / filename
            with path.open("xb") as stream:
                stream.write(payload)
            if not copy_prefix(engine, registers, source, destination, count):
                raise ValueError("section copy did not satisfy summary guards")
            entry = {"sectionIndex": section["index"], "destinationRva": hex(section["rva"]),
                     "sourceVa": hex(source), "bytes": count, "prefixBytesSummarized": count - 1,
                     "finalNativeIterations": 1, "sourceFile": filename,
                     "sourceSha256": hashlib.sha256(payload).hexdigest(),
                     "blockSha256": BLOCK_SHA256, "hookRva": hex(HOOK_RVA)}
            copies.append(entry)
            print(__import__("json").dumps({"verifiedSectionCopy": entry}), flush=True)
        except (ValueError, OSError, g["un"].UcError) as exc:
            g["stop"]("verified copy boundary: " + str(exc))

    emu.hook_add(g["un"].UC_HOOK_CODE, at_copy, begin=base + HOOK_RVA, end=base + HOOK_RVA)
