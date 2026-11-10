"""Profile data/raw/ourairports (read-only)."""
from __future__ import annotations

import pandas as pd

from common import RAW, SCOPE, generic_profile, md_table, section

D = RAW / "ourairports"


def profile() -> dict:
    ap = pd.read_csv(D / "airports.csv", dtype={"iata_code": "string"})
    rw = pd.read_csv(D / "runways.csv", dtype={"le_ident": "string", "he_ident": "string"})
    md = ["**airports.csv**\n"]
    m, info = generic_profile(ap, ["ident"], [D / "airports.csv"])
    md.append(m)
    md.append("\n**runways.csv**\n")
    m2, info2 = generic_profile(rw, ["id"], [D / "runways.csv"])
    md.append(m2)

    # --- scope checks
    ap["iata_raw"] = ap["iata_code"]
    ap["iata_norm"] = ap["iata_code"].str.strip().str.upper()
    present = set(ap["iata_norm"].dropna())
    missing = [a for a in SCOPE if a not in present]
    dup_iata = ap["iata_norm"].value_counts()
    dup_iata = dup_iata[dup_iata > 1]
    ws = ap[ap["iata_code"].notna() & (ap["iata_code"] != ap["iata_norm"])]

    rw["closed"] = rw["closed"].fillna(0).astype(int)
    g = rw.groupby("airport_ident")
    rt = pd.DataFrame({
        "runway_rows": g.size(),
        "closed_rows": g["closed"].sum(),
        "open_runways": g.apply(lambda x: int((x["closed"] == 0).sum()), include_groups=False),
        "longest_open_ft": g.apply(lambda x: x.loc[x["closed"] == 0, "length_ft"].max(), include_groups=False),
        "longest_any_ft": g["length_ft"].max(),
        "null_length_rows": g["length_ft"].apply(lambda s: int(s.isna().sum())),
    })
    t = ap.set_index("ident")[["iata_norm", "type", "name", "iso_region", "municipality", "scheduled_service"]].join(rt)
    t = t.reset_index().set_index("iata_norm").reindex(SCOPE)
    md.append(section("Scope check: runways per airport (open = `closed`≠1)", 4))
    md.append(md_table(t[["ident", "type", "name", "iso_region", "scheduled_service", "runway_rows", "closed_rows",
                          "open_runways", "longest_open_ft", "longest_any_ft"]]))
    md.append("\n**Scope findings**\n")
    md.append(f"- Missing from airports.csv: {missing or 'none'}\n- IATA codes appearing >1 time: "
              f"{dict(dup_iata) if len(dup_iata) else 'none'}\n- IATA codes with case/whitespace issues: {len(ws)}\n"
              f"- Airports.csv rows not in scope: {len(ap) - len(set(SCOPE) & present)}\n"
              f"- Runway rows whose `airport_ident` is not in airports.csv: "
              f"{int((~rw['airport_ident'].isin(ap['ident'])).sum())}\n"
              f"- Scope airports with zero runway rows: {[i for i, r in t.iterrows() if pd.isna(r['runway_rows'])] or 'none'}\n")
    odd = t[t["name"].str.contains("Oakland|Bay", na=False)]
    md.append(f"- Ambiguous names: OAK listed as `{t.loc['OAK','name']}`; surface/length nulls: "
              f"{int(rw['length_ft'].isna().sum())} rows.\n")
    return {"md": "\n".join(md), "rows": len(ap) + len(rw), "info": info, "missing": missing, "runways": t,
            "files": [D / "airports.csv", D / "runways.csv"]}


if __name__ == "__main__":
    print(profile()["md"])
