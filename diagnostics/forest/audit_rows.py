"""Offline aggregate audit of the previously verified forest archive.
No coordinates or occurrence rows are exported. No network access.
Usage: python3 diagnostics/forest/audit_rows.py EXISTING.zip --output audit.json
"""
import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import pathlib
import re
import sqlite3
import tempfile
import zipfile
from decimal import Decimal, InvalidOperation

EXPECTED = "35484328c3ee8b669146b29f71ceedd91283e11f7e3e8471fe9bde20fa0e8136"
COLUMNS = ["발생관리기관코드", "지역X좌표", "지역Y좌표", "국가지점번호", "PNU코드", "법정동코드", "발생경급수치", "고사목구분", "감염목구분", "조사일자", "방제완료여부"]
CUTOFF = dt.date(2026, 11, 26)

def date_value(value):
    value = value.strip()
    if re.fullmatch(r"\d{8}", value):
        value = value[:4] + "-" + value[4:6] + "-" + value[6:]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None

def finite(value):
    try:
        return bool(value.strip()) and Decimal(value).is_finite()
    except InvalidOperation:
        return False

def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def audit(path):
    if sha(path) != EXPECTED:
        raise ValueError("Archive differs from run 45767814587; review provenance first")
    result = {"sourceRun": 45767814587, "archiveSha256": EXPECTED,
              "sourceCrsVerified": False, "coverageComplete": False,
              "publicationAllowed": False, "members": []}
    with tempfile.TemporaryDirectory(prefix="forest-audit-") as tmp, zipfile.ZipFile(path) as archive:
        db = sqlite3.connect(str(pathlib.Path(tmp) / "rows.sqlite"))
        try:
            db.execute("CREATE TABLE seen (digest BLOB PRIMARY KEY) WITHOUT ROWID")
            infos = archive.infolist()
            if len(infos) != 8 or sum(i.file_size for i in infos) != 1169621584:
                raise ValueError("Unexpected archive inventory")
            for item in infos:
                counts = collections.Counter()
                missing = collections.Counter()
                first = last = None
                with archive.open(item) as raw, io.TextIOWrapper(raw, encoding="cp949", errors="strict", newline="") as stream:
                    reader = csv.reader(stream, strict=True)
                    header = next(reader)
                    if header != COLUMNS:
                        raise ValueError("Unexpected CSV header")
                    for row in reader:
                        counts["rows"] += 1
                        if len(row) != len(COLUMNS):
                            counts["wrongColumnCount"] += 1
                            continue
                        for key, value in zip(COLUMNS, row):
                            if not value.strip():
                                missing[key] += 1
                        day = date_value(row[9])
                        if day is None:
                            counts["missingOrUnsupportedOrInvalidDate"] += 1
                        elif day > CUTOFF:
                            counts["futureObservationDate"] += 1
                        else:
                            first = day if first is None else min(first, day)
                            last = day if last is None else max(last, day)
                            counts["validDate"] += 1
                        if not (finite(row[1]) and finite(row[2])):
                            counts["invalidNumericCoordinate"] += 1
                        # Exact parsed record equality only; not a tree identity.
                        digest = hashlib.sha256(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).digest()
                        inserted = db.execute("INSERT OR IGNORE INTO seen VALUES (?)", (digest,)).rowcount
                        if not inserted:
                            counts["exactDuplicateRowsAcrossArchive"] += 1
                        if counts["rows"] % 10000 == 0:
                            db.commit()
                db.commit()
                result["members"].append({"name": pathlib.PurePosixPath(item.filename).name,
                    "counts": dict(counts), "missingByColumn": dict(missing),
                    "earliestParsedObservationDate": first.isoformat() if first else None,
                    "latestParsedObservationDate": last.isoformat() if last else None})
        finally:
            db.close()
    return result

def self_test():
    assert date_value("20240229") == dt.date(2024, 2, 29)
    assert date_value("2023-02-29") is None
    assert date_value("2026-11-27") > CUTOFF
    assert date_value("2026/11/26") is None
    assert finite("123.5") and not finite("NaN") and not finite("Infinity") and not finite("")
    print("Synthetic date and coordinate parser assertions passed")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", nargs="?", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        if args.archive is None or args.output is None:
            parser.error("archive and --output required")
        result = audit(args.archive)
        with args.output.open("x", encoding="utf-8") as out:
            json.dump(result, out, ensure_ascii=False, indent=2)
