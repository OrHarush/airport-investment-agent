"""Profile data/raw/fares (read-only). BTS average domestic itinerary fares by origin airport and quarter."""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import RAW, SCOPE, generic_profile, md_table, section

F = RAW / "fares" / "average_fares_scope.csv"


def profile() -> dict:
    df = pd.read_csv(F, dtype={"airport_code": "string"})
    md = []
    m, info = generic_profile(df, ["year", "quarter", "airport_code"], [F])
    md.append(m)

    raw_codes = df["airport_code"]
    ws = int((raw_codes != raw_codes.str.strip().str.upper()).sum())
    df["airport_code"] = raw_codes.str.strip().str.upper()
    df["yq"] = df["year"].astype(str) + "Q" + df["quarter"].astype(str)
    md.append(section("Coverage", 4))
    md.append(f"- Date range: {df.yq.min()} → {df.yq.max()}; quarters present: {df.yq.nunique()}; airports: {df.airport_code.nunique()}; "
              f"IATA values with case/space issues: {ws}\n")
    grid = df.pivot_table(index="airport_code", columns="yq", values="avg_fare_usd", aggfunc="count").reindex(SCOPE)
    exp_q = [f"{y}Q{q}" for y in range(2019, 2027) for q in range(1, 5)]
    exp_q = [q for q in exp_q if q <= df.yq.max()]
    missing_q = [q for q in exp_q if q not in grid.columns]
    gaps = []
    for a in SCOPE:
        if a not in grid.index or grid.loc[a].isna().all():
            gaps.append(f"{a}: all quarters missing")
            continue
        miss = [q for q in exp_q if q not in grid.columns or pd.isna(grid.loc[a].get(q))]
        if miss:
            gaps.append(f"{a}: {miss}")
    md.append(f"- Missing quarters (whole dataset): {missing_q or 'none'}\n- Per-airport gaps vs 2019Q1..{df.yq.max()}: {gaps or 'none'}\n")
    md.append(f"- Nulls/zero/negative fares: null={int(df.avg_fare_usd.isna().sum())}, ≤0={int((df.avg_fare_usd <= 0).sum())}\n")

    # distribution per airport
    d = df.groupby("airport_code")["avg_fare_usd"].describe(percentiles=[.05, .5, .95])[["count", "min", "5%", "50%", "95%", "max", "mean", "std"]]
    d["max/median"] = d["max"] / d["50%"]
    d["min/median"] = d["min"] / d["50%"]
    md.append(section("Fare distribution per airport (avg_fare_usd, 30 quarters)", 4))
    md.append(md_table(d.reindex(SCOPE).round(1)))

    # per quarter
    q = df.groupby("yq")["avg_fare_usd"].agg(["count", "min", "median", "mean", "max"]).round(1)
    md.append(section("Fare distribution per quarter (across the 16 airports)", 4))
    md.append(md_table(q))

    # outliers vs each airport median
    med = df.groupby("airport_code")["avg_fare_usd"].transform("median")
    df["ratio"] = df["avg_fare_usd"] / med
    # robust z via MAD
    mad = df.groupby("airport_code")["avg_fare_usd"].transform(lambda s: (s - s.median()).abs().median())
    df["rz"] = 0.6745 * (df["avg_fare_usd"] - med) / mad.replace(0, np.nan)
    out = df[(df.ratio > 1.3) | (df.ratio < 0.7) | (df.rz.abs() > 3.5)].sort_values("ratio")
    md.append(section("Outliers vs each airport's own median (ratio >1.3 or <0.7, or |robust z|>3.5)", 4))
    md.append(md_table(out[["yq", "airport_code", "avg_fare_usd", "ratio", "rz"]].round(2), index=False))
    md.append("\nInterpretation: fares trend up (2022–23 post-COVID rebound, inflation); a high ratio late in the series is "
              "a real trend, not an error. Q2 2020 low-traffic quarter can show odd mix effects (real).\n")

    # YoY and QoQ jumps
    df = df.sort_values(["airport_code", "year", "quarter"])
    df["qoq"] = df.groupby("airport_code")["avg_fare_usd"].pct_change() * 100
    j = df[df.qoq.abs() > 15][["yq", "airport_code", "avg_fare_usd", "qoq"]].round(1)
    md.append(section("Quarter-over-quarter jumps >15 %", 4))
    md.append(md_table(j, index=False))

    # inflation adj sanity
    infl = df["inflation_adj_fare_usd_base_Q2_2026"] / df["avg_fare_usd"]
    imin = df.assign(r=infl).groupby("yq")["r"].agg(["min", "max"]).round(3)
    md.append(section("Inflation factor (inflation_adj / nominal) by quarter – should be constant within a quarter", 4))
    md.append(f"- Factor range overall: {infl.min():.3f}–{infl.max():.3f}; quarters where min≠max (±0.001): "
              f"{[i for i, r in imin.iterrows() if r['max'] - r['min'] > 0.001] or 'none'}\n")
    md.append(f"- Latest quarter factor: {infl[df.yq == df.yq.max()].round(3).unique().tolist()} (≈1.0 expected for base Q2-2026)\n")

    # metadata columns
    meta = df.groupby("airport_code").agg(name=("airport_name", "nunique"), city=("city", "nunique"), state=("state", "nunique"),
                                          rank=("rank_2025", "nunique"), pax=("pax_2025_10pct_sample", "nunique")).reindex(SCOPE)
    md.append(f"- Static metadata varying within an airport (should all be 1): {meta[(meta > 1).any(axis=1)].index.tolist() or 'none'}\n")

    # national benchmark note
    nat = df.groupby("yq")["avg_fare_usd"].mean()
    md.append("- **No national average fare column exists** in this file: 'pricing power vs national' must be computed vs the mean/"
              "median of these 16 airports (sample is not national) or an external benchmark. Flag for decision.\n")
    return {"md": "\n".join(md), "rows": len(df), "df": df, "gaps": gaps, "range": (df.yq.min(), df.yq.max()), "info": info,
            "files": [F], "airports": set(df.airport_code)}


if __name__ == "__main__":
    print(profile()["md"])
