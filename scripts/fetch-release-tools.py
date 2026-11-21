"""Download verified Windows x64 packaging/runtime tools from their publishers."""
import hashlib
from pathlib import Path
import urllib.request
import zipfile
import argparse
import json

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / ".runtime/tools"


def fetch(url, target, digest):
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
        return
    request = urllib.request.Request(url, headers={"User-Agent": "SC2-Trigger-Recovery-build"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(80 * 1024**2 + 1)
    if len(data) > 80 * 1024**2 or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"Publisher download fingerprint mismatch: {url}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def fetch_benchmark():
    # The exact published oracle is also fingerprinted per file by bundle-benchmark.
    destination = ROOT / ".runtime/pinned-benchmark"
    if destination.exists():
        return
    archive = TOOLS / "strict-benchmark-304.zip"
    fetch("https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition/releases/download/runtime-tools-v1/strict-benchmark-304.zip",
          archive, "243da2d57d2d22a1c2fd27d35c3bb616c2dd3385831f73f58507a284b3f46a8f")
    import tempfile
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        staging = Path(temp) / "oracle"
        with zipfile.ZipFile(archive) as source:
            source.extractall(staging)
        staging.rename(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installer", action="store_true", help="Also download Node and Inno Setup for a release build")
    args = parser.parse_args()
    pins = json.loads((ROOT / "packaging/tools.json").read_text())
    fetch(pins["mpqcli"]["url"], TOOLS / "mpqcli.exe", pins["mpqcli"]["sha256"])
    import runpy
    pe = runpy.run_path(str(ROOT / "scripts/check-pe-runtime.py"))
    if any(name.lower().startswith(("msvcp", "vcruntime", "msvcr")) for name in pe["imports"](TOOLS / "mpqcli.exe")):
        raise ValueError("MPQ tool requires a separately installed MSVC runtime")
    print("Verified mpqcli 0.10.0 with static CRT")
    if args.installer:
        fetch_benchmark()
        # The Node binary fingerprint is pinned independently of the download.
        fetch(pins["node"]["url"], TOOLS / "node.zip", pins["node"]["sha256"])
        with zipfile.ZipFile(TOOLS / "node.zip") as archive:
            for name, relative in [("node.exe", "node/node.exe"), ("LICENSE", "node/LICENSE")]:
                data = archive.read("node-v24.14.1-win-x64/" + name)
                target = TOOLS / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        fetch(pins["innoSetup"]["url"], TOOLS / "innosetup.exe", pins["innoSetup"]["sha256"])
        print("Verified Node 24.14.1 x64 and Inno Setup 6.7.4")


if __name__ == "__main__":
    main()
