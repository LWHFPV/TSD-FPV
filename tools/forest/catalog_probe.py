#!/usr/bin/env python3
"""Official dataset metadata probe. Does not assert that occurrence records were collected."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sys
import urllib.request
from urllib.parse import urlsplit

CATALOG = "https://www.data.go.kr/catalog/15120580/fileData.json"
DETAIL = "https://www.data.go.kr/data/15120580/fileData.do"
LIMIT = 2 * 1024 * 1024

def official(url):
    u = urlsplit(url)
    return u.scheme == "https" and u.hostname == "www.data.go.kr" and u.username is None and u.password is None and u.port in (None, 443)

class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not official(newurl):
            raise ValueError("Unverified redirect destination")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def parse_catalog(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or str(data.get("identifier")) != "15120580":
        raise ValueError("Unexpected dataset identifier")
    if data.get("url") != DETAIL or data.get("creator", {}).get("name") != "산림청":
        raise ValueError("Unexpected dataset source")
    modified = dt.date.fromisoformat(data["dateModified"]).isoformat()
    if data.get("encodingFormat", "").upper() != "CSV":
        raise ValueError("Unexpected source format")
    distributions = data.get("distribution", [])
    if isinstance(distributions, dict):
        distributions = [distributions]
    links = []
    for item in distributions:
        if isinstance(item, dict):
            link = item.get("contentUrl")
            if isinstance(link, str) and official(link):
                links.append(link)
    return {
        "datasetId": "15120580", "source": DETAIL,
        "catalogModified": modified, "metadataSha256": hashlib.sha256(raw).hexdigest(),
        "datasetName": data.get("alternateName", data.get("name")),
        "sourceFormat": "CSV", "candidateDistributionUrls": sorted(set(links)),
        "occurrenceDataStatus": "not_collected",
        "sourceCrsVerified": False, "coverageComplete": False,
        "asOf": None,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=pathlib.Path, default=pathlib.Path("forest-evidence"))
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    checked = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        opener = urllib.request.build_opener(OfficialRedirect())
        req = urllib.request.Request(CATALOG, headers={"Accept":"application/json", "User-Agent":"TSD-forest-catalog-review/1.0"})
        with opener.open(req, timeout=30) as res:
            if not official(res.geturl()):
                raise ValueError("Unexpected final URL")
            raw = res.read(LIMIT + 1)
            if len(raw) > LIMIT:
                raise ValueError("Metadata exceeds size limit")
            result = parse_catalog(raw)
            result["httpStatus"] = res.status
            result["etag"] = res.headers.get("ETag")
        (args.output / "catalog-original.json").write_bytes(raw)
        result.update({"checkedAt":checked, "metadataStatus":"verified"})
        code = 0
    except Exception as e:
        result = {"datasetId":"15120580", "source":DETAIL, "checkedAt":checked, "metadataStatus":"error", "errorType":type(e).__name__, "error":str(e)[:400], "occurrenceDataStatus":"not_collected", "sourceCrsVerified":False, "coverageComplete":False, "asOf":None}
        code = 1
    (args.output / "catalog-status.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return code

if __name__ == "__main__":
    sys.exit(main())
