"""Post the fictional fixture sheet to a running server and compare each field with the ground truth.

Usage (from server/):  python -m commands.smoke [base_url]     default http://localhost:8000
Against a live-mode server this runs real OCR and makes one billed Gemini call.
"""

from __future__ import annotations

import json
import sys
import time
import unicodedata
from pathlib import Path

import httpx

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def canon(value):
    """Compare text leniently: NFKC folds full-width characters, and whitespace is ignored."""
    return "".join(unicodedata.normalize("NFKC", value).split()) if isinstance(value, str) else value


def main(base_url: str = "http://localhost:8000") -> int:
    expected = json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))
    image = (FIXTURES / "listing-sheet.png").read_bytes()
    started = time.perf_counter()
    response = httpx.post(f"{base_url.rstrip('/')}/api/extract-listing", files={"image": ("listing-sheet.png", image, "image/png")}, timeout=120)
    seconds = time.perf_counter() - started
    body = response.json()
    if response.status_code != 200:
        print(f"HTTP {response.status_code} after {seconds:.1f}s", body)
        return 1

    failures = 0
    print(f"mode={body['meta']['mode']} model={body['meta']['model']} {seconds:.1f}s documentId={body['documentId']}")
    for key, want in expected["fields"].items():
        got = body["fields"][key]
        ok = canon(got["value"]) == canon(want)
        failures += not ok
        box = ",".join(f"{n:.3f}" for n in got["evidence"]) if got["evidence"] else "none"
        print(f"{'PASS' if ok else 'FAIL'} {key:<16} got={got['value']!r} want={want!r} confidence={got['confidence']} box=[{box}]")
    for want in expected["expectedWarnings"]:
        found = any(w["code"] == want["code"] and set(want["fields"]) <= set(w["fields"]) for w in body["warnings"])
        failures += not found
        print(f"{'PASS' if found else 'FAIL'} warning {want['code']} on {','.join(want['fields'])}")
    for warning in body["warnings"]:
        print(f"  warning: {warning['message']}")
    print(f"{failures} check(s) failed" if failures else "all checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
