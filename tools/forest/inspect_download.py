"""Inspect an official download without extracting or publishing occurrence rows."""
import csv
import hashlib
import io
import json
import pathlib
import re
import sys
import zipfile

LIMIT = 200 * 1024 * 1024
EXPANDED_LIMIT = 2 * 1024 * 1024 * 1024
MAX_RATIO = 100
REQUIRED = {"지역X좌표", "지역Y좌표", "감염목구분"}

def normalize(s):
    return re.sub(r"\s+", "", s).lstrip("\ufeff").upper()

def inspect_header(raw):
    for encoding in ("utf-8-sig", "cp949"):
        try:
            # Only decode a complete first line, not a truncated multibyte row.
            first = raw.splitlines()[0].decode(encoding)
            cols = next(csv.reader([first]))
        except (UnicodeError, StopIteration, IndexError, csv.Error):
            continue
        if {normalize(x) for x in REQUIRED} <= {normalize(x) for x in cols}:
            return {"encodingCandidate": encoding, "header": cols, "schemaVerified": True}
    raise ValueError("Expected occurrence CSV columns not verified")

def inspect_download(file):
    file = pathlib.Path(file)
    size = file.stat().st_size
    if not 0 < size <= LIMIT:
        raise ValueError("Unexpected file size")
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        head = stream.read(8192)
        stream.seek(0)
        for chunk in iter(lambda: stream.read(1024*1024), b""):
            digest.update(chunk)
    base = {"size": size, "sha256": digest.hexdigest(), "magicHex": head[:8].hex()}
    if zipfile.is_zipfile(file):
        with zipfile.ZipFile(file) as z:
            infos = z.infolist()
            expanded = sum(i.file_size for i in infos)
            compressed = sum(i.compress_size for i in infos)
            if len(infos) > 1000 or expanded > EXPANDED_LIMIT or expanded > MAX_RATIO * max(1, compressed):
                raise ValueError(f"Archive limits: members={len(infos)}, expanded={expanded}, compressed={compressed}")
            base.update({"expandedSize": expanded, "memberCount": len(infos)})
            candidates = [i for i in infos if not i.is_dir() and i.filename.lower().endswith(".csv")]
            base.update({"container":"zip", "csvMemberCount":len(candidates)})
            if len(candidates) != 1:
                raise ValueError("Archive must contain exactly one CSV; found "+str(len(candidates)))
            item = candidates[0]
            if item.flag_bits & 1:
                raise ValueError("Encrypted archive not supported")
            if item.file_size <= 0 or item.file_size > EXPANDED_LIMIT or item.file_size > MAX_RATIO * max(1, item.compress_size):
                raise ValueError("CSV member size invalid")
            # No extractall, no paths from archive are used to write files.
            with z.open(item) as stream:
                raw = stream.read(8192)
                schema = inspect_header(raw)
                csv_hash = hashlib.sha256(raw)
                streamed = len(raw)
                for chunk in iter(lambda: stream.read(1024*1024), b""):
                    streamed += len(chunk)
                    if streamed > EXPANDED_LIMIT or streamed > item.file_size:
                        raise ValueError("Expanded stream exceeds declared or permitted size")
                    csv_hash.update(chunk)
                if streamed != item.file_size:
                    raise ValueError("Expanded size mismatch")
            return {**base, **schema, "csvSha256":csv_hash.hexdigest(), "csvSize":item.file_size,
                    "csvMember":pathlib.PurePosixPath(item.filename).name}
    return {**base, "container":"plain", **inspect_header(head), "csvSha256":digest.hexdigest(), "csvSize":size}

if __name__ == "__main__":
    try:
        print(json.dumps(inspect_download(sys.argv[1]), ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"inspectionError":str(e)[:400]}, ensure_ascii=False))
        sys.exit(1)
