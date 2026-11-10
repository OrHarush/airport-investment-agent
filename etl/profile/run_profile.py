"""Run every source profiler (read-only) and assemble docs/data-profile.md.

Usage:  python etl/profile/run_profile.py [--only t100 ontime ...] [--out docs/data-profile.md]

Reads data/raw/** only. Writes exactly one file: docs/data-profile.md (or --out).
Hand-written interpretation lives in etl/profile/narrative.md; numbers in it are filled from the data via <<key>> placeholders
computed in cleaning_impact.py, so re-running keeps text and numbers consistent.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cleaning_impact  # noqa: E402
import cross_source  # noqa: E402
import profile_fares  # noqa: E402
import profile_nas  # noqa: E402
import profile_ontime  # noqa: E402
import profile_ourairports  # noqa: E402
import profile_t100  # noqa: E402
import profile_taf  # noqa: E402
from common import DOCS, ROOT, SCOPE, human  # noqa: E402

HERE = Path(__file__).resolve().parent

SOURCES = [
    ("ourairports", "OurAirports", profile_ourairports),
    ("t100", "BTS T-100 Segment", profile_t100),
    ("ontime", "BTS On-Time Performance", profile_ontime),
    ("fares", "BTS Average Domestic Fares", profile_fares),
    ("taf", "FAA TAF 2025", profile_taf),
    ("nas", "FAA NAS Status (live)", profile_nas),
]


def load_narrative() -> dict[str, str]:
    txt = (HERE / "narrative.md").read_text(encoding="utf8")
    parts = re.split(r"^=== (\S+) ===\s*$", txt, flags=re.M)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts), 2)}


def fill(text: str, metrics: dict) -> str:
    def rep(m):
        k = m.group(1)
        if k not in metrics:
            raise KeyError(f"narrative placeholder <<{k}>> has no metric")
        return str(metrics[k])
    return re.sub(r"<<(\w+)>>", rep, text)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="subset of sources; cross-source and narrative are skipped when partial")
    ap.add_argument("--out", default=str(DOCS / "data-profile.md"))
    args = ap.parse_args()

    res: dict[str, dict] = {}
    for key, _, mod in SOURCES:
        if args.only and key not in args.only:
            continue
        t0 = time.time()
        print(f"[profile] {key} ...", flush=True)
        res[key] = mod.profile()
        print(f"[profile] {key} done in {time.time() - t0:.0f}s ({res[key]['rows']:,} rows)", flush=True)

    full = len(res) == len(SOURCES)
    if not full:
        out = ["# Partial profile (subset run)\n"] + [f"\n## {n}\n\n{res[k]['md']}" for k, n, _ in SOURCES if k in res]
        Path(args.out).write_text("\n".join(out), encoding="utf8")
        print(f"[profile] partial output -> {args.out}")
        return

    cross = cross_source.run(res)
    metrics = cleaning_impact.compute(res)
    nar = load_narrative()

    def f(key: str) -> str:
        return fill(nar[key], metrics)

    d = []
    d.append("# Data profile (Phase 1: read-only)\n")
    d.append(f"_Generated {dt.date.today().isoformat()} by `etl/profile/run_profile.py` from `data/raw/**` (read-only; nothing under `data/clean/` was produced)._  \n"
             f"_Scope: {' '.join(SCOPE)}. Re-run: `python etl/profile/run_profile.py` (about 5 minutes; On-Time is 10.2 M rows)._\n")
    d.append("\n## Summary\n")
    d.append("| Source | Rows | Size on disk | Coverage | Biggest data-quality issue |\n|---|---|---|---|---|")
    for key, name, _ in SOURCES:
        r = res[key]
        size = sum(p.stat().st_size for p in r["files"])
        d.append(f"| {name} | {r['rows']:,} | {human(size)} | {f('cov_' + key)} | {f('issue_' + key)} |")
    d.append("\n" + f("summary_notes"))
    d.append("\n## Reading guide\n\n- **DATA ERROR** = very likely wrong/artefact; **REAL EXTREME** = real-world event; **LIKELY ARTEFACT** = a quirk of how the source is built. Nothing was dropped, altered or saved.\n"
             "- 'Scope' always means the 16 airports; 'passenger-class' means T-100 `CLASS` F or L.\n")

    for i, (key, name, _) in enumerate(SOURCES, 1):
        d.append(f"\n## {i}. {name}\n")
        d.append(res[key]["md"])
        d.append(f"\n### Anything surprising ({name})\n\n" + f("surprising_" + key))

    d.append("\n## 7. Cross-source\n")
    d.append(cross["md"])
    d.append("\n### Anything surprising (cross-source)\n\n" + f("surprising_cross"))
    d.append("\n## 8. Risks for the four questions\n\n" + f("risks"))
    d.append("\n## 9. Proposed cleaning plan (for approval)\n\n" + f("plan"))

    Path(args.out).write_text("\n".join(d) + "\n", encoding="utf8")
    print(f"[profile] wrote {args.out} ({Path(args.out).stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
