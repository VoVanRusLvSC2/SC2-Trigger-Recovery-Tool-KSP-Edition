"""Archive every portable payload file, including dotfiles, without shell globbing."""
import argparse
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("stage", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
stage = args.stage.resolve(strict=True)
destination = args.destination.resolve()
if destination.exists() or stage == destination or stage in destination.parents:
    raise ValueError("ZIP must be a new file outside the stage")
files = sorted(stage.rglob("*"))
with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        if file.is_symlink():
            raise ValueError(f"Portable payload contains a link: {file}")
        if file.is_file():
            archive.write(file, Path(stage.name) / file.relative_to(stage))
with zipfile.ZipFile(destination) as archive:
    failed = archive.testzip()
    if failed is not None:
        raise ValueError(f"ZIP integrity failed: {failed}")
print(f"Verified portable ZIP: {destination.name}; {len(archive.namelist())} files")
