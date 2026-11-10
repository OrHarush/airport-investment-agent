"""Profile data/raw/ontime (read-only). BTS Reporting-Carrier On-Time Performance, 2019 -> latest, scope airports only."""
from __future__ import annotations

import gc

import numpy as np
import pandas as pd

from common import RAW, SCOPE, generic_profile, human, md_table, numeric_table, schema_table, section

D = RAW / "ontime"
S = set(SCOPE)
KEY = ["FlightDate", "Reporting_Airline", "Flight_Number_Reporting_Airline", "Origin", "Dest", "CRSDepTime"]
CAUSES = ["CarrierDelay", "WeatherDelay", "NASDelay", "SecurityDelay", "LateAircraftDelay"]
STR_COLS = ["FlightDate", "Reporting_Airline", "Origin", "OriginCityName", "OriginState", "Dest", "DestCityName", "DestState",
            "CRSDepTime", "DepTime", "WheelsOff", "WheelsOn", "CRSArrTime", "ArrTime", "CancellationCode"]
NUM_COLS = ["Year", "Month", "Flight_Number_Reporting_Airline", "DepDelay", "DepDel15", "TaxiOut", "TaxiIn", "ArrDelay", "ArrDel15",
            "Cancelled", "Diverted", "CRSElapsedTime", "ActualElapsedTime", "AirTime", "Distance"] + CAUSES


def load() -> tuple[pd.DataFrame, list]:
    files = sorted(D.glob("ontime_*.csv.gz"))
    parts = []
    for f in files:
        d = pd.read_csv(f, dtype={c: "string" for c in STR_COLS}, low_memory=False)
        for c in NUM_COLS:
            d[c] = d[c].astype("int32" if c in ("Year", "Month", "Flight_Number_Reporting_Airline") else "float32")
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    for c in STR_COLS:  # concat of categoricals with different category sets falls back to object
        df[c] = df[c].astype("category")
    del parts
    gc.collect()
    return df, files


def pct(a, b):
    return 100 * a / b if b else np.nan


def profile() -> dict:
    df, files = load()
    n = len(df)
    md = []
    # ---- schema / numeric (generic_profile is too slow for 10M rows on the key dup, so do it by hand)
    size = sum(f.stat().st_size for f in files)
    md.append(f"**Shape:** {n:,} rows x {df.shape[1]} columns | {len(files)} files, total {human(size)} (gzip)\n")
    md.append(section("Schema (dtype, nulls, distinct, low-cardinality values)", 4))
    sch = schema_table(df.drop(columns=["FlightDate", "CRSDepTime", "DepTime", "WheelsOff", "WheelsOn", "CRSArrTime", "ArrTime"]), low_card=20)
    for c in ["FlightDate", "CRSDepTime", "DepTime", "WheelsOff", "WheelsOn", "CRSArrTime", "ArrTime"]:
        s = df[c]
        sch.loc[c] = [str(s.dtype), int(s.isna().sum()), round(100 * s.isna().mean(), 2), int(s.nunique()), ""]
    sch = sch.reindex(df.columns)
    md.append(md_table(sch))
    nt, flags = numeric_table(df, [c for c in NUM_COLS if c not in ("Year", "Month", "Flight_Number_Reporting_Airline")])
    md.append(section("Numeric columns", 4))
    md.append(md_table(nt))
    md.append("\n**Flagged (max > 10x p95):** " + (", ".join(f"`{c}`" for c in flags) or "none") + "\n")

    # ---- dates
    df["fd"] = pd.to_datetime(df["FlightDate"].astype("string"), errors="coerce")
    bad_dates = int(df.fd.isna().sum())
    ym = (df.Year * 100 + df.Month).astype("int32")
    df["ym"] = ym
    mism = int(((df.fd.dt.year != df.Year) | (df.fd.dt.month != df.Month)).sum())
    yms = sorted(ym.unique())
    allm = [y * 100 + m for y in range(2019, 2027) for m in range(1, 13)]
    last = max(yms)
    exp = [x for x in allm if x <= last]
    md.append(section("Date coverage", 4))
    md.append(f"- Range: {df.fd.min().date()} -> {df.fd.max().date()}; unparseable dates: {bad_dates}; Year/Month vs FlightDate mismatches: {mism}\n"
              f"- Months present: {len(yms)}; missing months in range: {[int(x) for x in exp if x not in yms] or 'none'}; "
              f"latest year {last // 100} is PARTIAL (through month {last % 100}).\n")
    # days per month
    dpm = df.groupby("ym", observed=True).fd.nunique()
    dim = pd.Series({m: pd.Period(f"{m // 100}-{m % 100:02d}").days_in_month for m in dpm.index})
    short = dpm[dpm < dim]
    md.append(f"- Months with fewer distinct flight dates than calendar days: {({int(k): f'{v}/{dim[k]}' for k, v in short.items()} or 'none')}\n")

    # ---- duplicates (hash based)
    h_all = pd.util.hash_pandas_object(df.drop(columns=["fd", "ym"]), index=False)
    exact = int(h_all.duplicated().sum())
    h_key = pd.util.hash_pandas_object(df[KEY].astype("string"), index=False)
    key_extra = int(h_key.duplicated().sum())
    key_grp = int(h_key.duplicated(keep=False).sum())
    del h_all
    md.append(section("Duplicates", 4))
    md.append(f"- Exact duplicate rows: **{exact:,}**\n- Natural key `{', '.join(KEY)}`: **{key_extra:,}** extra rows ({key_grp:,} rows in duplicated-key groups)\n")
    if key_extra:
        dk = df[h_key.duplicated(keep=False).values]
        md.append(f"  - Duplicated-key rows by Cancelled={dk.Cancelled.value_counts().to_dict()}, Diverted={dk.Diverted.value_counts().to_dict()}; "
                  f"top carriers {dk.Reporting_Airline.value_counts().head(5).to_dict()}\n")
        # are they same flight diverted legs?
        md.append("\n" + md_table(dk.sort_values(KEY).head(6)[KEY + ["Cancelled", "Diverted", "DepTime", "ArrTime", "ArrDelay"]], index=False))
    del h_key

    # ---- whitespace
    ws = {c: int((df[c].astype("string") != df[c].astype("string").str.strip().str.upper()).sum()) for c in ["Origin", "Dest"]}
    md.append(f"- Origin/Dest case/whitespace issues: {ws}\n")

    # ---- scope flags
    df["o_in"] = df.Origin.isin(S)
    df["d_in"] = df.Dest.isin(S)
    side = np.select([df.o_in & df.d_in, df.o_in, df.d_in], ["both", "origin only", "dest only"], "neither")
    sc = pd.Series(side).value_counts()
    md.append(section("Scope membership of rows", 4))
    md.append(md_table(pd.DataFrame({"rows": sc, "%": (100 * sc / n).round(1)})))
    md.append("\nA flight with both ends in scope appears once in this file, but is relevant to two airports "
              "(a departure for one and an arrival for the other): count departures by `Origin`, arrivals by `Dest`.\n")

    # ---- rows per airport per year (departures + arrivals)
    dep = df[df.o_in].groupby(["Origin", "Year"], observed=True).size().unstack().reindex(SCOPE)
    arr = df[df.d_in].groupby(["Dest", "Year"], observed=True).size().unstack().reindex(SCOPE)
    md.append(section("Flights per airport per year", 4))
    md.append("Departures (Origin = airport):\n\n" + md_table(dep.astype("Int64")))
    md.append("\nArrivals (Dest = airport):\n\n" + md_table(arr.astype("Int64")))

    # ---- coverage grid & gaps (departures per airport-month)
    g = df[df.o_in].groupby(["Origin", "ym"], observed=True).size().unstack().reindex(index=SCOPE, columns=exp)
    gaps = []
    for a in SCOPE:
        miss = [int(c) for c in exp if pd.isna(g.loc[a, c]) or g.loc[a, c] == 0]
        if miss:
            gaps.append(f"{a}: {miss}")
    md.append(section("Coverage grid: airport x year-month (departures)", 4))
    md.append(f"Grid {len(SCOPE)} x {len(exp)} = {len(SCOPE) * len(exp)} cells; empty cells: {int(g.isna().sum().sum() + (g == 0).sum().sum())}.\n\n"
              "Gaps (airport: months with zero departures): " + (("\n- " + "\n- ".join(gaps)) if gaps else "none") + "\n")
    # unusually low months: ratio to airport's same calendar month median across 2019,2022-2025
    base = g.copy()
    low = []
    for a in SCOPE:
        for c in exp:
            y, m = c // 100, c % 100
            if y in (2020, 2021):
                continue
            ref = [g.loc[a].get(yy * 100 + m) for yy in (2019, 2022, 2023, 2024, 2025) if yy != y]
            ref = [r for r in ref if pd.notna(r) and r > 0]
            v = g.loc[a, c]
            if ref and pd.notna(v) and v < 0.5 * np.median(ref):
                low.append(f"{a} {c} ({int(v)} vs ~{int(np.median(ref))})")
    md.append(f"\nAirport-months (excl. 2020-21) below 50 % of the same calendar month in other years: {low or 'none'}\n")
    # zero-flight days
    days = df[df.o_in].groupby(["Origin", "Year"], observed=True).fd.nunique().unstack().reindex(SCOPE)
    md.append("\nDistinct days with >=1 departure per airport-year (full year = 365/366; 2026 partial):\n\n" + md_table(days.astype("Int64")))

    # ---- cancelled / diverted share (departures basis)
    cd = df[df.o_in].groupby("Origin", observed=True).agg(flights=("Cancelled", "size"), cancelled=("Cancelled", "mean"), diverted=("Diverted", "mean")).reindex(SCOPE)
    cd["cancelled"] *= 100
    cd["diverted"] *= 100
    cy = df[df.o_in].groupby(["Origin", "Year"], observed=True).Cancelled.mean().unstack().reindex(SCOPE) * 100
    md.append(section("Cancelled / diverted share (departing flights, %)", 4))
    md.append(md_table(cd.round(2)))
    md.append("\nCancellation % by year:\n\n" + md_table(cy.round(2)))
    tot_c = 100 * df.Cancelled.mean()
    md.append(f"\n- Overall cancel rate in file {tot_c:.2f} %, diverted {100 * df.Diverted.mean():.2f} %.\n")
    cc = df.CancellationCode.value_counts(dropna=False).to_dict()
    md.append(f"- CancellationCode counts: {cc}; cancelled rows with null code: {int(((df.Cancelled == 1) & df.CancellationCode.isna()).sum()):,}; "
              f"non-cancelled with code: {int(((df.Cancelled == 0) & df.CancellationCode.notna()).sum()):,}\n")
    worst = df[df.o_in].groupby(["Origin", "ym"], observed=True).Cancelled.mean().mul(100)
    worst = worst[worst > 15].sort_values(ascending=False)
    md.append(f"- Airport-months with cancel rate >15 % (top 12): {[(a, int(m), round(v, 1)) for (a, m), v in worst.head(12).items()]}\n")

    # ---- delay distribution (flown flights: not cancelled, not diverted)
    fl = df[~((df.Cancelled == 1) | (df.Diverted == 1))]
    nullarr = int(fl.ArrDelay.isna().sum())
    nulldep = int(fl.DepDelay.isna().sum())
    md.append(section("Delay distribution (flown flights = not cancelled, not diverted)", 4))
    md.append(f"- Flown flights with null ArrDelay: {nullarr:,}; null DepDelay: {nulldep:,}; cancelled/diverted rows with a non-null ArrDelay: "
              f"{int(df[(df.Cancelled == 1) | (df.Diverted == 1)].ArrDelay.notna().sum()):,}\n\n")

    def dist(sub, key):
        q = sub.groupby(key, observed=True).ArrDelay.describe(percentiles=[.5, .95, .99])[["count", "min", "50%", "95%", "99%", "max"]]
        q["mean"] = sub.groupby(key, observed=True).ArrDelay.mean()
        q["% >=15"] = 100 * sub.groupby(key, observed=True).ArrDel15.mean()
        return q.reindex(SCOPE)
    arrd = dist(fl[fl.d_in], "Dest")
    md.append("Arrival delay minutes by destination airport (all years):\n\n" + md_table(arrd.round(1)))
    depd = fl[fl.o_in].groupby("Origin", observed=True).DepDelay.describe(percentiles=[.5, .95, .99])[["count", "min", "50%", "95%", "99%", "max"]].reindex(SCOPE)
    md.append("\nDeparture delay minutes by origin airport:\n\n" + md_table(depd.round(1)))
    ext = fl.loc[fl.ArrDelay > 600, ["FlightDate", "Reporting_Airline", "Origin", "Dest", "ArrDelay", "DepDelay", "CarrierDelay", "WeatherDelay", "NASDelay", "LateAircraftDelay"]]
    ext = ext[ext.Origin.isin(S) | ext.Dest.isin(S)].sort_values("ArrDelay", ascending=False)
    md.append(f"\n- Flown in-scope flights with ArrDelay > 600 min (10 h): {len(ext):,}; > 1,440 min: {int((ext.ArrDelay > 1440).sum())}. Top 8:\n\n"
              + md_table(ext.head(8), index=False))
    yd = fl[fl.d_in].groupby("Year").ArrDelay.agg(["median", lambda s: s.quantile(.95), "mean"]).round(1)
    yd.columns = ["median", "p95", "mean"]
    md.append("\nArrival delay by year (all in-scope arrivals): \n\n" + md_table(yd))
    md.append("\nInterpretation: negative delays (early arrivals) are real; delays up to ~1-2 days are real extreme events (storms, "
              "overnight aircraft problems) because BTS records delay vs schedule. Nothing was dropped.\n")

    # ---- delay-cause nulls
    md.append(section("Delay-cause columns: nulls overall vs among flights delayed 15+ min", 4))
    delayed = fl[fl.ArrDel15 == 1]
    rows = []
    for c in CAUSES:
        rows.append({"column": c, "null % overall (all rows)": pct(df[c].isna().sum(), n),
                     "null % among flown flights": pct(fl[c].isna().sum(), len(fl)),
                     "null % among ArrDel15=1": pct(delayed[c].isna().sum(), len(delayed)),
                     "non-null % among ArrDel15=0": pct(fl[fl.ArrDel15 == 0][c].notna().sum(), (fl.ArrDel15 == 0).sum())})
    md.append(md_table(pd.DataFrame(rows).set_index("column").round(2)))
    md.append(f"\nFlown flights ArrDel15=1: {len(delayed):,} ({pct(len(delayed), len(fl)):.1f} %).\n")
    # consistency of cause sum
    cs = delayed[CAUSES].sum(axis=1, min_count=5)
    diff = (cs - delayed.ArrDelay).abs()
    md.append(f"- Among delayed flights with all five causes present, |sum(causes) - ArrDelay| > 1 min: {int((diff > 1).sum()):,} of {int(cs.notna().sum()):,}\n")
    gd = (fl.ArrDelay >= 15) & (fl.ArrDel15 == 0)
    md.append(f"- Consistency: ArrDelay>=15 but ArrDel15=0: {int(gd.sum()):,}; ArrDelay<15 but ArrDel15=1: {int(((fl.ArrDelay < 15) & (fl.ArrDel15 == 1)).sum()):,}\n")
    cn = delayed[CAUSES].isna().all(axis=1)
    md.append(f"- Delayed flights where ALL five cause columns are null: {int(cn.sum()):,} ({pct(cn.sum(), len(delayed)):.2f} %); "
              f"those with null in some but not all: {int((delayed[CAUSES].isna().any(axis=1) & ~cn).sum()):,}\n")
    # by airport (departing / arriving) among delayed
    def null_by(key, sub):
        t = sub[sub.ArrDel15 == 1].groupby(key, observed=True).agg(delayed=("ArrDel15", "size"), nasdelay_null=("NASDelay", lambda s: 100 * s.isna().mean()),
                                                                   carrier_null=("CarrierDelay", lambda s: 100 * s.isna().mean()))
        return t.reindex(SCOPE)
    nb = null_by("Origin", fl[fl.o_in])
    nb2 = null_by("Dest", fl[fl.d_in])
    nbx = nb.join(nb2, lsuffix=" (dep)", rsuffix=" (arr)") if False else nb.add_suffix(" (dep)").join(nb2.add_suffix(" (arr)"))
    md.append("\nDelay-cause null % among ArrDel15=1 flights, by airport (dep = flights leaving it, arr = flights arriving):\n\n" + md_table(nbx.round(2)))
    ny = delayed.groupby("Year")[CAUSES].agg(lambda s: 100 * s.isna().mean()).round(2)
    md.append("\nCause null % among delayed flights by year (a jump would signal a schema change):\n\n" + md_table(ny))

    # ---- coverage quality: ontime departures vs T-100 performed passenger departures
    t100 = pd.concat([pd.read_csv(f, usecols=["ORIGIN", "DEST", "UNIQUE_CARRIER", "UNIQUE_CARRIER_NAME", "YEAR", "MONTH", "CLASS", "DEPARTURES_PERFORMED", "PASSENGERS"]) for f in sorted((RAW / "t100").glob("*.gz"))])
    t_last = int((t100.YEAR * 100 + t100.MONTH).max())
    t100 = t100[t100.ORIGIN.isin(S) & t100.CLASS.isin(["F", "L"])]
    td = t100.groupby(["ORIGIN", "YEAR"]).DEPARTURES_PERFORMED.sum().unstack().reindex(SCOPE)
    dep_cmp = df[df.o_in & (df.ym <= t_last)].groupby(["Origin", "Year"], observed=True).size().unstack().reindex(SCOPE)
    cov = (dep_cmp / td * 100)
    md.append(section("Coverage quality: On-Time departures as % of T-100 passenger-class performed departures", 4))
    md.append(f"(100 % = On-Time sees every passenger-class departure; <100 % = carriers missing. Compared only for months <= {t_last} so 2026 is like-for-like.)\n\n" + md_table(cov.round(1)))
    ot_carr = set(map(str, df.Reporting_Airline.cat.categories))
    t24 = t100[t100.YEAR == 2024]
    miss_rows = []
    for a in SCOPE:
        x = t24[t24.ORIGIN == a]
        tot = x.DEPARTURES_PERFORMED.sum()
        mm = x[~x.UNIQUE_CARRIER.isin(ot_carr)].groupby("UNIQUE_CARRIER_NAME").DEPARTURES_PERFORMED.sum().sort_values(ascending=False)
        miss_rows.append({"airport": a, "T-100 dep 2024": tot, "not in On-Time %": 100 * mm.sum() / tot if tot else np.nan,
                          "largest missing carriers (departures)": "; ".join(f"{k} ({v:,.0f})" for k, v in mm.head(3).items())})
    md.append("\nWhy: T-100 passenger departures in 2024 flown by carriers that are not among the 18 On-Time reporting carriers:\n\n"
              + md_table(pd.DataFrame(miss_rows).set_index("airport").round(1)))
    cm = df[df.o_in].groupby("Origin", observed=True).Reporting_Airline.nunique().reindex(SCOPE)
    md.append("\nReporting carriers seen per departing airport: " + ", ".join(f"{k}={v}" for k, v in cm.items()) + "\n")
    for a in ["ANC", "FAI"]:
        vc = df[df.Origin == a].Reporting_Airline.value_counts()
        md.append(f"- {a} departures by carrier (all years): {vc[vc > 0].to_dict()}\n")
    md.append("- All national carriers: " + ", ".join(sorted(map(str, df.Reporting_Airline.cat.categories))) + "\n")
    poor = [a for a in SCOPE if cov.loc[a, [2019, 2023, 2024, 2025]].mean() < 85]
    md.append(f"- Airports where On-Time covers <85 % of T-100 passenger departures (mean of 2019,2023-25): **{poor}**\n")

    # ---- other sanity
    md.append(section("Other sanity checks", 4))
    md.append(f"- Distance == 0: {int((df.Distance == 0).sum()):,}; Distance null: {int(df.Distance.isna().sum()):,}\n"
              f"- TaxiOut > 180 min (flown): {int((fl.TaxiOut > 180).sum()):,}; TaxiOut < 0: {int((fl.TaxiOut < 0).sum())}; TaxiIn > 120: {int((fl.TaxiIn > 120).sum()):,}\n"
              f"- Cancelled flights with non-null DepTime: {int(((df.Cancelled == 1) & df.DepTime.notna()).sum()):,}\n"
              f"- Not cancelled & DepTime null: {int(((df.Cancelled == 0) & df.DepTime.isna()).sum()):,}\n"
              f"- Diverted flights: ArrDelay null {int(df[df.Diverted == 1].ArrDelay.isna().sum()):,} of {int((df.Diverted == 1).sum()):,}\n")
    tx = fl[fl.o_in].groupby("Origin", observed=True).TaxiOut.describe(percentiles=[.5, .95])[["count", "min", "50%", "95%", "max"]].reindex(SCOPE)
    md.append("\nTaxiOut minutes by origin airport (flown flights; proxy for ground congestion):\n\n" + md_table(tx.round(1)))
    ty = fl[fl.o_in & fl.Origin.isin(["LAX", "SNA"])].groupby(["Origin", "Year"], observed=True).TaxiOut.median().unstack()
    md.append("\nMedian TaxiOut LAX vs SNA by year:\n\n" + md_table(ty.round(1)))

    stats = {
        "cancelled": int((df.Cancelled == 1).sum()), "diverted": int((df.Diverted == 1).sum()), "flown": int(len(fl)),
        "delayed15": int(len(delayed)), "gt600": int(len(ext)), "gt1440": int((ext.ArrDelay > 1440).sum()),
        "cause_all_null_delayed": int(cn.sum()), "cause_null_rows": int(df.CarrierDelay.isna().sum()),
        "cancel_with_deptime": int(((df.Cancelled == 1) & df.DepTime.notna()).sum()),
        "rows_after_t100": int((df.ym > t_last).sum()), "t100_last": str(t_last),
        "taxiin_gt120": int((fl.TaxiIn > 120).sum()), "taxiout_gt180": int((fl.TaxiOut > 180).sum()),
        "sum_mismatch": int((diff > 1).sum()),
    }
    return {"stats": stats, "md": "\n".join(md), "rows": n, "files": files, "range": (int(min(yms)), int(last)), "gaps": gaps, "low": low,
            "dep": dep, "cov": cov, "poor": poor, "exact": exact, "key_extra": key_extra, "cd": cd,
            "airports": set(df.Origin.astype(str)) & S | set(df.Dest.astype(str)) & S,
            "cause_null_delayed": 100 * delayed[CAUSES].isna().mean().mean(), "ymset": set(int(x) for x in yms)}


if __name__ == "__main__":
    print(profile()["md"])
