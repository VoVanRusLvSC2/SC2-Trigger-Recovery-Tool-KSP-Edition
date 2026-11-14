"""Install the retained ModKit runtime without redistributing its archive.

Run npm ci first. The supplied archive is pinned, never executed as an installer,
and stays outside Git. Existing files are verified rather than overwritten.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import zipfile


ARCHIVE_SHA256 = "aaa8df28cbfb5f61f52a0e38181cf93b938d8cf67fdd9e81a46e8fc7e295f0d4"
SCHEMA_SHA256 = "35bf301d911244dba3e1a1bcb4c3fc7d1a1ef03ca471a1f93361f0720304a5fb"
PREFIX = "modkit-extensions-blizzard/"
PACKAGES = {
    "@modkit/blizzard-casc": "1.0.0",
    "@modkit/blizzard-common-formats": "0.1.0",
    "@modkit/blizzard-mpq": "1.0.0",
    "@modkit/blizzard-starcraft2": "1.0.0",
    "@modkit/codec-kit": "1.0.0",
    "@modkit/core": "0.1.0",
    "@modkit/sdk": "0.1.0",
    "@modkit/vfs": "0.1.0",
    "modkit-extension-archives": "1.0.0",
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def write_verified(file, data):
    if file.exists():
        if file.read_bytes() != data:
            raise ValueError(f"Existing runtime file differs; left untouched: {file}")
        return
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(data)


def package_name(relative):
    parts = relative.parts
    count = 2 if parts[0].startswith("@") else 1
    return "/".join(parts[:count])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True, help="Original mk-revizer.zip")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    modules = root / "node_modules"
    if not (modules / "acorn" / "package.json").is_file():
        parser.error("Run npm ci --ignore-scripts before installing the local runtime")
    if args.archive.stat().st_size > 64 * 1024**2:
        parser.error("Archive exceeds the retained distribution's size bound")
    archive_bytes = args.archive.read_bytes()
    if sha256(archive_bytes) != ARCHIVE_SHA256:
        parser.error("Archive SHA-256 differs from the retained distribution; nothing installed")

    runtime = root / ".runtime" / "modkit"
    destination = runtime / "node_modules"
    with zipfile.ZipFile(args.archive) as archive:
        # Reuse installed public packages. Sharing their real paths also preserves
        # class identity (for example XmlElement) across package boundaries.
        shared = set()
        archive_prefix = PREFIX + "node_modules/"
        for info in archive.infolist():
            if not info.filename.startswith(archive_prefix) or not info.filename.endswith("/package.json"):
                continue
            relative = PurePosixPath(info.filename[len(archive_prefix):])
            name = package_name(relative)
            if relative.as_posix() != name + "/package.json":
                continue
            installed = modules / name / "package.json"
            if name not in PACKAGES and installed.is_file():
                expected = json.loads(archive.read(info))["version"]
                actual = json.loads(installed.read_text(encoding="utf8"))["version"]
                if actual == expected:
                    shared.add(name)

        files = 0
        for info in archive.infolist():
            if info.is_dir():
                continue
            if info.filename.startswith(archive_prefix):
                relative = PurePosixPath(info.filename[len(archive_prefix):])
                if package_name(relative) in shared:
                    continue
            elif info.filename.startswith(PREFIX + "starcraft2/"):
                relative = PurePosixPath("@modkit/blizzard-starcraft2") / info.filename[len(PREFIX + "starcraft2/"):]
            else:
                continue
            if relative.is_absolute() or ".." in relative.parts or any(":" in part for part in relative.parts):
                raise ValueError(f"Unsafe archive path: {relative}")
            if info.file_size > 16 * 1024**2 or (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError(f"Unsupported runtime entry: {relative}")
            write_verified(destination.joinpath(*relative.parts), archive.read(info))
            files += 1

        for name, version in PACKAGES.items():
            manifest = json.loads((destination / name / "package.json").read_text(encoding="utf8"))
            if manifest["name"] != name or manifest["version"] != version:
                raise ValueError(f"Runtime package identity differs: {name}")

        schema = archive.read(PREFIX + "starcraft2/dist/modules/data/services/schema/generated/sc2-data-schema.json")
        if sha256(schema) != SCHEMA_SHA256:
            raise ValueError("Generated schema fingerprint differs")
        for family in ["core", "private-switch", "production-preparation"]:
            write_verified(root / "src/sdk" / family / "modules/data/services/schema/generated/sc2-data-schema.json", schema)

    # A junction does not require Windows developer mode or administrator rights.
    # Node resolves it to the shared package tree, including transitive imports.
    for name in PACKAGES:
        target = destination / name
        link = modules / name
        link.parent.mkdir(parents=True, exist_ok=True)
        if link.exists() or link.is_symlink():
            if link.resolve() != target.resolve():
                raise ValueError(f"Existing package has a different location; left untouched: {link}")
        elif os.name == "nt":
            subprocess.run([
                "node", "-e",
                "require('node:fs').symlinkSync(process.argv[1],process.argv[2],'junction')",
                str(target), str(link),
            ], check=True)
        else:
            link.symlink_to(target, target_is_directory=True)

    receipt = {
        "archiveSha256": ARCHIVE_SHA256,
        "packages": PACKAGES,
        "sharedPublicPackages": sorted(shared),
        "verifiedRuntimeFiles": files,
        "schemaSha256": SCHEMA_SHA256,
        "qualification": "Pinned local installation; converter and map-equivalence checks are separate.",
    }
    (runtime / "installation.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8")
    print(f"Verified {files} archived runtime files; linked {len(PACKAGES)} packages.")
    print("Installed three pinned schema assets. No lifecycle scripts, maps or Editor operations ran.")


if __name__ == "__main__":
    main()
