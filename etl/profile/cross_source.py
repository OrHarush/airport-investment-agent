"""Cross-source checks (read-only). Consumes the result dicts of the per-source profilers."""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import RAW, SCOPE, md_table, section


def _raw_codes() -> dict[str, pd.Series]:
    """Raw (un-normalised) airport code columns from every source, to test case/space issues."""
    t = pd.concat([pd.read_csv(f, usecols=["ORIGIN", "DEST"], dtype=str) for f in sorted((RAW / "t100").glob("*.gz"))])
    out = {
        "OurAirports.iata_code": pd.read_csv(RAW / "ourairports" / "airports.csv", dtype=str)["iata_code"],
        "T-100 ORIGIN": t["ORIGIN"],
        "T-100 DEST": t["DEST"],
        "Fares.airport_code": pd.read_csv(RAW / "fares" / "average_fares_scope.csv", dtype=str)["airport_code"],
        "TAF enplanements.locid": pd.read_csv(RAW / "taf" / "taf_enplanements_scope.csv", dtype=str)["locid"],
        "TAF operations.locid": pd.read_csv(RAW / "taf" / "taf_operations_scope.csv", dtype=str)["locid"],
        "TAF airports.LOCID": pd.read_csv(RAW / "taf" / "taf_airports_scope.csv", dtype=str)["LOCID"],
    }
    # On-Time: read only the two code columns of one file per year (codes are identical in shape across years)
    ot = []
    for f in sorted((RAW / "ontime").glob("*.csv.gz")):
        ot.append(pd.read_csv(f, usecols=["Origin", "Dest"], dtype="category"))
    o_codes = set()
    d_codes = set()
    for d in ot:
        o_codes |= set(d["Origin"].cat.categories)
        d_codes |= set(d["Dest"].cat.categories)
    out["On-Time Origin"] = pd.Series(sorted(o_codes))
    out["On-Time Dest"] = pd.Series(sorted(d_codes))
    return out


def run(r: dict) -> dict:
    md = []
    # --- presence matrix
    ap = r["ourairports"]["runways"]
    pres = pd.DataFrame(index=SCOPE)
    pres["OurAirports"] = [a in set(ap.index.dropna()) and pd.notna(ap.loc[a, "ident"]) for a in SCOPE]
    pres["T-100"] = [a in r["t100"]["airports"] for a in SCOPE]
    pres["On-Time"] = [a in r["ontime"]["airports"] for a in SCOPE]
    pres["Fares"] = [a in r["fares"]["airports"] for a in SCOPE]
    pres["TAF"] = [a in r["taf"]["ids"] for a in SCOPE]
    pres["NAS snapshot"] = [a in set(r["nas"]["in_scope"]) for a in SCOPE]
    show = pres.replace({True: "yes", False: "NO"})
    md.append(section("Do all 16 airports appear in every source?", 4))
    md.append(md_table(show))
    md.append("\nNAS is a live snapshot listing only airports with an active event, so absence is expected (not a gap).\n")
    missing = {c: [a for a in SCOPE if not pres.loc[a, c]] for c in pres.columns if c != "NAS snapshot"}
    md.append(f"- Missing per historical source: {({k: v for k, v in missing.items() if v} or 'none')}\n")

    # --- code hygiene
    codes = _raw_codes()
    rows = []
    for k, s in codes.items():
        s = s.dropna().astype(str)
        bad = int((s != s.str.strip().str.upper()).sum())
        sc = set(s.str.strip().str.upper()) & set(SCOPE)
        rows.append({"source.column": k, "values checked": len(s), "case/whitespace problems": bad,
                     "scope airports found": f"{len(sc)}/16", "code length set": ",".join(map(str, sorted(set(s.str.len()))))})
    md.append(section("IATA code consistency (raw values, before any normalisation)", 4))
    md.append(md_table(pd.DataFrame(rows).set_index("source.column")))
    md.append("\nAll sources use 3-letter IATA codes for scope airports with no case/space issues in the scoped extracts. "
              "Only join key to avoid: OurAirports runways use ICAO `airport_ident` (KBOS), and the TAF airports table `APORT_NAME` is space-padded. "
              "The docs warn of padded `locid`; the scoped CSVs are already trimmed (a re-extract from the original xlsx would not be).\n")

    # --- date overlap
    t_lo, t_hi = r["t100"]["range"]
    o_lo, o_hi = r["ontime"]["range"]
    f_lo, f_hi = r["fares"]["range"]
    tl = r["taf"]["last_actual"]
    md.append(section("Period coverage and overlap", 4))
    md.append(md_table(pd.DataFrame([
        {"source": "T-100", "grain": "month", "first": f"{t_lo // 100}-{t_lo % 100:02d}", "last": f"{t_hi // 100}-{t_hi % 100:02d}", "note": "2026 partial (Jan-Jul)"},
        {"source": "On-Time", "grain": "day", "first": f"{o_lo // 100}-{o_lo % 100:02d}", "last": f"{o_hi // 100}-{o_hi % 100:02d}", "note": "2026 partial (Jan-Aug)"},
        {"source": "Fares", "grain": "quarter", "first": f_lo, "last": f_hi, "note": "2026 Q1-Q2 only"},
        {"source": "TAF", "grain": "fiscal year", "first": f"FY{r['taf']['years'][0]}", "last": f"FY{r['taf']['years'][1]}",
         "note": f"actual to FY{tl}, forecast FY{tl + 1}-FY{r['taf']['years'][1]}"},
        {"source": "NAS", "grain": "snapshot", "first": r["nas"]["snapshot"], "last": r["nas"]["snapshot"], "note": "no history"},
    ]), index=False))
    md.append("\n- **Window where T-100, On-Time and Fares all have data:** 2019-01 -> 2026-06 (quarters 2019Q1-2026Q2). "
              "Months 2026-07 (T-100, On-Time) and 2026-08 (On-Time only) have no fares.\n"
              f"- **Complete calendar years in all three monthly sources:** 2019-2025. 2026 is partial everywhere.\n"
              f"- TAF actuals end FY{tl}: FY2025 (already finished) is still a forecast in the TAF, so for 2025 T-100 is the better 'actual'.\n")

    # --- TAF vs T-100 reconciliation
    py = r["t100"]["py"]
    en = r["taf"]["enpl"]
    en_d = r["taf"]["enpl_dom"]
    rec = pd.DataFrame(index=SCOPE)
    for y in (2019, 2024, 2025):
        rec[f"T-100 {y}"] = py[y]
        rec[f"TAF total {y}"] = en.loc[SCOPE, y]
        rec[f"T-100/TAF {y}"] = py[y] / en.loc[SCOPE, y]
        rec[f"T-100/TAF-domestic {y}"] = py[y] / en_d.loc[SCOPE, y]
    md.append(section("Reconciliation: T-100 enplaned passengers (F+L, calendar year) vs TAF enplanements (fiscal year)", 4))
    md.append(md_table(rec.round(3)))
    md.append("\nWith the 5-column TAF total (incl. `us_flag`+`frgn_flag`) the ratio is ~1.0 (diff = calendar vs fiscal year, "
              "foreign-carrier segments, connecting-passenger handling). With the documented 3-column total it is 1.2-1.4x for gateway airports.\n")
    rr = rec[["T-100/TAF 2019", "T-100/TAF 2024", "T-100/TAF 2025"]]
    outl = rr[(rr < 0.9).any(axis=1) | (rr > 1.1).any(axis=1)]
    md.append(f"- Airports where T-100/TAF is outside 0.90-1.10 in 2019, 2024 or 2025 (TAF 2025 is a forecast): {({a: tuple(outl.loc[a].round(3)) for a in outl.index} or 'none')}\n")

    # --- On-Time vs T-100 coverage
    cov = r["ontime"]["cov"]
    md.append(section("Reconciliation: On-Time departures vs T-100 passenger departures", 4))
    md.append("(on-time departures as % of T-100 F+L performed departures; see On-Time section)\n\n"
              + md_table(cov[[2019, 2023, 2024, 2025]].round(1)))
    # --- fares sample rank vs T-100 2025
    f = r["fares"]["df"]
    fr = f.groupby("airport_code").agg(rank=("rank_2025", "first"), pax10=("pax_2025_10pct_sample", "first")).reindex(SCOPE)
    fr["T-100 2025 pax"] = py[2025]
    fr["T-100 rank among 16"] = fr["T-100 2025 pax"].rank(ascending=False)
    fr["fares rank among 16"] = fr["pax10"].rank(ascending=False)
    fr["pax10 x10 / T-100 (enpl)"] = fr["pax10"] * 10 / fr["T-100 2025 pax"]
    md.append(section("Fares 10 % sample vs T-100 2025", 4))
    md.append(md_table(fr[["rank", "pax10", "T-100 2025 pax", "T-100 rank among 16", "fares rank among 16", "pax10 x10 / T-100 (enpl)"]].round(2)))
    md.append("\nThe fares file's passenger sample counts itineraries/tickets (round trips and O&D), not segment enplanements, so exact agreement is not expected; "
              "rank order is the useful check.\n")
    return {"md": "\n".join(md), "presence": pres, "recon": rec, "missing": missing}
