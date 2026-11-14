"""Download verified Windows x64 packaging/runtime tools from their publishers."""
import hashlib
from pathlib import Path
import urllib.request
import zipfile
import argparse

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / ".runtime/tools"
MPQ = ("https://github.com/thegraydot/mpqcli/releases/download/v0.10.0/mpqcli-windows-amd64.exe",
       "efed6d68060b70b5f71b383f3dc3b87db84ff1a299f02f8e32ae6be93eb6dcfc")
INNO = ("https://github.com/jrsoftware/issrc/releases/download/is-6_7_4/innosetup-6.7.4.exe",
        "a549929319f9120716677c685535ca4671e4b937b5fdc87e2585f32d8eb30e8c")


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installer", action="store_true", help="Also download Node and Inno Setup for a release build")
    args = parser.parse_args()
    fetch(MPQ[0], TOOLS / "mpqcli.exe", MPQ[1])
    print("Verified mpqcli 0.10.0")
    if args.installer:
        # The Node binary fingerprint is pinned independently of the download.
        import json
        pins = json.loads((ROOT / "packaging/tools.json").read_text())
        fetch(pins["node"]["url"], TOOLS / "node.zip", pins["node"]["sha256"])
        with zipfile.ZipFile(TOOLS / "node.zip") as archive:
            for name, relative in [("node.exe", "node/node.exe"), ("LICENSE", "node/LICENSE")]:
                data = archive.read("node-v24.14.1-win-x64/" + name)
                target = TOOLS / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        fetch(INNO[0], TOOLS / "innosetup.exe", INNO[1])
        print("Verified Node 24.14.1 x64 and Inno Setup 6.7.4")


if __name__ == "__main__":
    main()
