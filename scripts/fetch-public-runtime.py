"""Fetch the pinned, licensed public ModKit source before npm ci.

Only the SC2/archive packages and platform tarballs are retained. No game files,
private distribution or generated Galaxy native API catalog is downloaded.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

REVISION = "d4218ef890064108384e8b871081a02acaa86c87"
SHA256 = "c42d209f5191a0075baedf4859b77bc11e49efb82dfbd399bddb5101b8965072"
URL = f"https://codeload.github.com/hometlt/modkit-extensions-blizzard/zip/{REVISION}"
ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / ".runtime/public-upstream"
PACKAGES = ["starcraft2", "casc", "mpq", "blizzard-common-formats"]


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    archive = DEST / "upstream.zip"
    if not archive.is_file():
        request = urllib.request.Request(URL, headers={"User-Agent": "SC2-Galaxy-Trigger-Recovery-build"})
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = response.read(64 * 1024**2 + 1)
        if len(payload) > 64 * 1024**2:
            raise ValueError("Public source archive exceeds size limit")
        if hashlib.sha256(payload).hexdigest() != SHA256:
            raise ValueError("Public source fingerprint differs; nothing extracted")
        archive.write_bytes(payload)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        raise ValueError("Cached public source fingerprint differs")
    count = 0
    with zipfile.ZipFile(archive) as source:
        for info in source.infolist():
            relative = PurePosixPath(*PurePosixPath(info.filename).parts[1:])
            if info.is_dir() or not relative.parts:
                continue
            if relative.parts[0] not in [*PACKAGES, "vendor", "licenses", "LICENSE"]:
                continue
            if relative.is_absolute() or any(x in ["..", "."] or ":" in x for x in relative.parts):
                raise ValueError("Unsafe public source path")
            if info.file_size > 32 * 1024**2 or (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unsupported public source entry")
            target = DEST.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read(info))
            count += 1
    # The public workspace uses pnpm workspace/file references. npm installs the
    # same four local packages and pinned platform bundles from our root lockfile.
    for package in PACKAGES:
        file = DEST / package / "package.json"
        original = file.read_text(encoding="utf8")
        (file.parent / "package.upstream.json").write_text(original, encoding="utf8")
        manifest = json.loads(original)
        for name, value in manifest.get("dependencies", {}).items():
            if value == "workspace:*":
                manifest["dependencies"][name] = "0.1.0" if name.endswith("common-formats") else "1.0.0"
            elif value.startswith("file:"):
                manifest["dependencies"][name] = "0.1.0" if name in ["@modkit/core", "@modkit/sdk", "@modkit/vfs"] else "1.0.0"
        # Development tools belong to the upstream workspace, not runtime consumers.
        manifest.pop("devDependencies", None)
        if package == "starcraft2":
            # No retained SC2 source imports extract-zip. Avoid shipping that
            # unrelated, vulnerable legacy dependency in the recovery product.
            manifest["dependencies"].pop("extract-zip", None)
            manifest["dependencies"]["xml2js"] = "0.6.2"
        file.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    (DEST / "source-receipt.json").write_text(json.dumps({
        "repository": "https://github.com/hometlt/modkit-extensions-blizzard",
        "revision": REVISION, "archiveSha256": SHA256, "files": count,
        "manifestAdaptation": "workspace/file dependency references to pinned root package identities; no source edits",
    }, indent=2) + "\n", encoding="utf8")
    print(f"Verified licensed public ModKit source: {REVISION}; {count} files")


if __name__ == "__main__":
    main()
