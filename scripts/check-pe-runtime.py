"""Refuse Windows binaries that silently require a separately installed MSVC CRT."""
import argparse
import re
import struct
from pathlib import Path


def imports(file):
    data = file.read_bytes()
    pe = struct.unpack_from("<I", data, 0x3c)[0]
    if data[pe:pe+4] != b"PE\0\0":
        raise ValueError("Not a PE binary")
    coff = pe + 4
    count = struct.unpack_from("<H", data, coff+2)[0]
    optional = coff + 20
    size = struct.unpack_from("<H", data, coff+16)[0]
    kind = struct.unpack_from("<H", data, optional)[0]
    directory = optional + (112 if kind == 0x20b else 96)
    import_rva = struct.unpack_from("<I", data, directory+8)[0]
    sections = [struct.unpack_from("<IIII", data, optional+size+i*40+8) for i in range(count)]
    def offset(rva):
        return next(raw+rva-va for vs,va,rs,raw in sections if va <= rva < va+max(vs,rs))
    at = offset(import_rva)
    names = []
    while any(data[at:at+20]):
        name = offset(struct.unpack_from("<I", data, at+12)[0])
        names.append(data[name:data.index(0,name)].decode("ascii"))
        at += 20
    return names


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binary", type=Path)
    args = parser.parse_args()
    names = imports(args.binary)
    forbidden = [name for name in names if re.match(r"(?:msvcp|msvcr|vcruntime)\d", name, re.I)]
    if forbidden:
        raise ValueError("Separate MSVC runtime required: " + ", ".join(forbidden))
    print(f"Verified {args.binary.name}: no separate MSVC CRT imports; {len(names)} Windows system DLL imports")
