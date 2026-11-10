"""Profile data/raw/t100 (read-only). BTS T-100 Segment, All Carriers, 2019 -> latest."""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import RAW, SCOPE, generic_profile, md_table, section

D = RAW / "t100"
KEY = ["YEAR", "MONTH", "UNIQUE_CARRIER", "ORIGIN", "DEST", "AIRCRAFT_TYPE", "AIRCRAFT_CONFIG", "CLASS"]
PAX_CLASSES = ["F", "L"]
S = set(SCOPE)


def load() -> tuple[pd.DataFrame, list]:
    files = sorted(D.glob("t100_segment_*.csv.gz"))
    df = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    return df, files


def lf(num, den):
    return num / den if den else np.nan


def profile() -> dict:
    df, files = load()
    md = []
    m, info = generic_profile(df, KEY, files)
    md.append(m)
    extra = int(df.duplicated(subset=KEY + ["DATA_SOURCE"]).sum())
    md.append(f"- Key + DATA_SOURCE: {extra:,} extra rows (so duplicates are not an artefact of DU/DF/IU/IF splitting)\n")
    # --- duplicate deep dive: key collisions are NOT exact duplicates
    dk = df[df.duplicated(KEY, keep=False)]
    gk = dk.groupby(KEY)
    measures = ["DEPARTURES_SCHEDULED", "DEPARTURES_PERFORMED", "PAYLOAD", "SEATS", "PASSENGERS", "FREIGHT", "MAIL", "RAMP_TO_RAMP", "AIR_TIME", "DISTANCE"]
    differ = {c: int((gk[c].nunique() > 1).sum()) for c in measures}
    sc_dk = dk[(dk.ORIGIN.isin(S) | dk.DEST.isin(S))]
    md.append(section("Natural-key collisions (deep dive)", 4))
    md.append(f"- Groups: {gk.ngroups:,} (sizes {gk.size().value_counts().to_dict()}); none are exact duplicates, but share carrier/route/aircraft/class/month.\n"
              f"- Measure columns that differ inside a group (groups): {differ} -> they look like separate partial records for the same key "
              "(summing is the conventional treatment; dropping would lose passengers).\n"
              f"- Carriers involved: {dk.UNIQUE_CARRIER.value_counts().head(6).to_dict()}; CLASS: {dk.CLASS.value_counts().to_dict()}\n"
              f"- Collision rows touching scope: {len(sc_dk):,}; passenger-class (F/L) scope rows: {int(sc_dk.CLASS.isin(PAX_CLASSES).sum()):,}; "
              f"passengers in them: {sc_dk.PASSENGERS.sum():,.0f}\n")
    ex = dk[dk.ORIGIN.isin(S) & dk.CLASS.isin(PAX_CLASSES)].sort_values(KEY).head(6)
    if len(ex):
        md.append("\nExample colliding passenger rows in scope:\n\n" + md_table(ex[KEY + ["DEPARTURES_PERFORMED", "SEATS", "PASSENGERS"]], index=False))
    # per-year rows vs docs
    yr = df.groupby("YEAR").size()
    md.append(section("Rows per year", 4))
    md.append(md_table(yr.to_frame("rows").T, index=False))

    # whitespace/case
    ws = {c: int((df[c] != df[c].str.strip().str.upper()).sum()) for c in ["ORIGIN", "DEST"]}
    md.append(f"\n- ORIGIN/DEST case/whitespace issues: {ws}; distinct ORIGIN={df.ORIGIN.nunique()}, DEST={df.DEST.nunique()}\n")

    # scope flags
    df["o_in"] = df.ORIGIN.isin(S)
    df["d_in"] = df.DEST.isin(S)
    df["scope_side"] = np.select([df.o_in & df.d_in, df.o_in, df.d_in], ["both", "origin only", "dest only"], "neither")
    df["ym"] = df.YEAR * 100 + df.MONTH
    df["is_pax_class"] = df.CLASS.isin(PAX_CLASSES)

    # coverage
    ym = sorted(df.ym.unique())
    allm = [y * 100 + m for y in range(2019, 2027) for m in range(1, 13)]
    last = max(ym)
    exp = [x for x in allm if x <= last]
    md.append(section("Date coverage", 4))
    md.append(f"- First month: {min(ym)}, latest month: **{last}**; months present: {len(ym)}; missing months in range: "
              f"{[x for x in exp if x not in ym] or 'none'}\n")
    md.append(f"- Latest year **{last // 100} is PARTIAL** (months {sorted(df[df.YEAR == last // 100].MONTH.unique())}).\n")
    rm = df.groupby("ym").size()
    md.append("- Rows in last 6 months vs same months a year earlier: "
              + ", ".join(f"{k}: {rm[k]:,} (vs {rm.get(k - 100, float('nan')):,.0f})" for k in rm.index[-6:]) + "\n")

    # --- 1. CLASS breakdown per airport (origin basis)
    o = df[df.o_in]
    cl = o.groupby(["ORIGIN", "CLASS"]).agg(rows=("CLASS", "size"), departures=("DEPARTURES_PERFORMED", "sum"),
                                            seats=("SEATS", "sum"), passengers=("PASSENGERS", "sum"),
                                            freight_lbs=("FREIGHT", "sum")).round(0)
    cl = cl.reset_index()
    cl["ORIGIN"] = pd.Categorical(cl.ORIGIN, SCOPE, ordered=True)
    cl = cl.sort_values(["ORIGIN", "CLASS"])
    md.append(section("CLASS breakdown per airport (origin basis, all years 2019-latest)", 4))
    md.append("CLASS: F = scheduled pax/cargo, L = non-scheduled pax/cargo, G = scheduled all-cargo, P = non-scheduled all-cargo.\n\n")
    md.append(md_table(cl, index=False))
    cls_tot = df.groupby("CLASS").agg(rows=("CLASS", "size"), departures=("DEPARTURES_PERFORMED", "sum"),
                                      seats=("SEATS", "sum"), passengers=("PASSENGERS", "sum"))
    md.append("\nAll rows by CLASS:\n\n" + md_table(cls_tot.round(0)))

    # --- 2. ANC passenger vs freight
    anc = df[df.ORIGIN == "ANC"].copy()
    anc["kind"] = np.where(anc.CLASS.isin(PAX_CLASSES), "passenger (F+L)", "cargo (G+P)")
    a = anc.groupby(["YEAR", "kind"]).agg(rows=("kind", "size"), departures=("DEPARTURES_PERFORMED", "sum"),
                                          passengers=("PASSENGERS", "sum"), freight_lbs=("FREIGHT", "sum")).round(0)
    md.append(section("ANC: passenger vs cargo split (origin = ANC)", 4))
    md.append(md_table(a))
    ap = anc.groupby("YEAR").apply(lambda g: g.loc[g.kind.str.startswith("cargo"), "DEPARTURES_PERFORMED"].sum()
                                   / g["DEPARTURES_PERFORMED"].sum(), include_groups=False).round(3)
    md.append(f"\n- Cargo share of ANC departures by year: {ap.to_dict()}\n")
    fp = anc[anc.kind.str.startswith("cargo") & (anc.PASSENGERS > 0)]
    md.append(f"- Cargo-class ANC rows with passengers>0: {len(fp):,} (passengers total {fp.PASSENGERS.sum():,.0f}) -> `CLASS` is the "
              "reliable filter; `PASSENGERS>0` alone is not enough.\n")
    pc = anc[~anc.kind.str.startswith("cargo")]
    pc_zero = pc[(pc.PASSENGERS == 0)]
    md.append(f"- Passenger-class (F/L) ANC rows with 0 passengers: {len(pc_zero):,} of {len(pc):,} "
              f"(carry belly cargo / positioning or were scheduled-only; departures {pc_zero.DEPARTURES_PERFORMED.sum():,.0f})\n")
    top = pc.groupby("UNIQUE_CARRIER_NAME").DEPARTURES_PERFORMED.sum().sort_values(ascending=False).head(8)
    md.append("- Top ANC passenger-class carriers by departures (all years): " + ", ".join(f"{k} ({v:,.0f})" for k, v in top.items()) + "\n")
    cg = anc[anc.CLASS.isin(PAX_CLASSES) & (anc.YEAR == 2025)]
    # F-class carriers that are cargo-only operators?
    cargo_names = anc[anc.CLASS == "F"].groupby("UNIQUE_CARRIER_NAME").agg(dep=("DEPARTURES_PERFORMED", "sum"), pax=("PASSENGERS", "sum"))
    cargo_names = cargo_names[(cargo_names.pax == 0) & (cargo_names.dep > 0)].sort_values("dep", ascending=False).head(8)
    md.append("- CLASS=F carriers at ANC with 0 passengers ever (cargo operators filed as F): "
              + (", ".join(f"{k} ({v:,.0f} dep)" for k, v in cargo_names.dep.items()) or "none") + "\n")

    # --- 3. anomalies
    def cnt(mask, sub=None):
        d = df if sub is None else sub
        mm = mask(d)
        return int(mm.sum()), float(d.loc[mm, "PASSENGERS"].sum())
    scope_pax = df[(df.o_in | df.d_in) & df.is_pax_class]
    checks = {
        "seats=0 & passengers>0": lambda d: (d.SEATS == 0) & (d.PASSENGERS > 0),
        "passengers > seats (seats>0)": lambda d: (d.SEATS > 0) & (d.PASSENGERS > d.SEATS),
        "passengers > 1.05×seats (seats>0)": lambda d: (d.SEATS > 0) & (d.PASSENGERS > 1.05 * d.SEATS),
        "departures_performed=0 & passengers>0": lambda d: (d.DEPARTURES_PERFORMED == 0) & (d.PASSENGERS > 0),
        "departures_performed=0 & seats>0": lambda d: (d.DEPARTURES_PERFORMED == 0) & (d.SEATS > 0),
        "departures_performed=0 (all zero row, sched only)": lambda d: (d.DEPARTURES_PERFORMED == 0) & (d.SEATS == 0) & (d.PASSENGERS == 0),
        "departures_scheduled=0 & performed>0": lambda d: (d.DEPARTURES_SCHEDULED == 0) & (d.DEPARTURES_PERFORMED > 0),
        "performed > scheduled (scheduled>0)": lambda d: (d.DEPARTURES_SCHEDULED > 0) & (d.DEPARTURES_PERFORMED > d.DEPARTURES_SCHEDULED),
        "distance = 0": lambda d: d.DISTANCE == 0,
        "distance null": lambda d: d.DISTANCE.isna(),
        "air_time=0 & performed>0": lambda d: (d.AIR_TIME == 0) & (d.DEPARTURES_PERFORMED > 0),
        "seats/performed > 600 (implausible)": lambda d: (d.DEPARTURES_PERFORMED > 0) & (d.SEATS / d.DEPARTURES_PERFORMED > 600),
        "negative numerics": lambda d: (d[["SEATS", "PASSENGERS", "DEPARTURES_PERFORMED", "FREIGHT", "DISTANCE"]] < 0).any(axis=1),
    }
    rows = []
    for k, f in checks.items():
        n_all, p_all = cnt(f)
        n_sc, p_sc = cnt(f, scope_pax)
        rows.append({"check": k, "rows (all)": n_all, "pax in those rows (all)": p_all, "rows (scope, F+L)": n_sc, "pax (scope, F+L)": p_sc})
    ck = pd.DataFrame(rows).set_index("check").round(0)
    md.append(section("Row-level anomaly checks (all rows, and scope-touching passenger-class rows)", 4))
    md.append(md_table(ck))
    n_scope_pax = len(scope_pax)
    md.append(f"\nScope passenger-class rows total: {n_scope_pax:,}\n")
    bad = scope_pax[(scope_pax.SEATS > 0) & (scope_pax.PASSENGERS > scope_pax.SEATS)]
    if len(bad):
        b = bad.assign(lf=bad.PASSENGERS / bad.SEATS).sort_values("lf", ascending=False).head(10)
        md.append("\nWorst passengers>seats rows in scope:\n\n"
                  + md_table(b[["YEAR", "MONTH", "UNIQUE_CARRIER", "ORIGIN", "DEST", "AIRCRAFT_TYPE", "DEPARTURES_PERFORMED", "SEATS", "PASSENGERS", "lf"]].round(2), index=False))
    z = scope_pax[(scope_pax.SEATS == 0) & (scope_pax.PASSENGERS > 0)]
    if len(z):
        md.append("\nExamples seats=0 & passengers>0 (scope, F+L):\n\n"
                  + md_table(z.sort_values("PASSENGERS", ascending=False).head(8)[["YEAR", "MONTH", "UNIQUE_CARRIER", "ORIGIN", "DEST", "AIRCRAFT_TYPE", "DEPARTURES_PERFORMED", "SEATS", "PASSENGERS"]], index=False))
    dz = df[(df.DISTANCE == 0)]
    if len(dz):
        md.append(f"\nDistance=0 rows: carriers {dz.UNIQUE_CARRIER.value_counts().head(5).to_dict()}; CLASS {dz.CLASS.value_counts().to_dict()}; "
                  f"pairs e.g. {dz.groupby(['ORIGIN','DEST']).size().sort_values(ascending=False).head(5).to_dict()}\n")

    # --- 4. load factor distribution per airport, passenger only (F+L), origin basis
    p = df[df.o_in & df.is_pax_class & (df.SEATS > 0) & (df.DEPARTURES_PERFORMED > 0)].copy()
    p["lf"] = p.PASSENGERS / p.SEATS
    rowq = p.groupby("ORIGIN").lf.describe(percentiles=[.05, .5, .95])[["count", "min", "5%", "50%", "95%", "max"]].reindex(SCOPE)
    # seat-weighted aggregate LF
    agg = p.groupby("ORIGIN").apply(lambda g: g.PASSENGERS.sum() / g.SEATS.sum(), include_groups=False).reindex(SCOPE)
    rowq["agg LF (all yrs)"] = agg
    rowq["rows LF>1"] = p[p.lf > 1].groupby("ORIGIN").size().reindex(SCOPE).fillna(0)
    rowq["rows LF<0.2"] = p[p.lf < 0.2].groupby("ORIGIN").size().reindex(SCOPE).fillna(0)
    md.append(section("Load factor (passengers/seats), passenger-class F+L, origin basis, rows with seats>0 & departures>0", 4))
    md.append("Row-level LF quantiles (rows are carrier x route x aircraft x month, unweighted) plus seat-weighted aggregate.\n\n")
    md.append(md_table(rowq.round(3)))
    # annual aggregate LF
    ann = p.groupby(["ORIGIN", "YEAR"]).apply(lambda g: g.PASSENGERS.sum() / g.SEATS.sum(), include_groups=False).unstack().reindex(SCOPE)
    md.append("\nSeat-weighted annual LF (origin basis):\n\n" + md_table(ann.round(3)))
    mon = p[p.ORIGIN.isin(["SFO", "LAX", "ANC"])].groupby(["ym", "ORIGIN"]).apply(lambda g: g.PASSENGERS.sum() / g.SEATS.sum(), include_groups=False).unstack()
    md.append("\nMonthly LF extremes (min/max month) for SFO/LAX/ANC: "
              + "; ".join(f"{c}: min {mon[c].idxmin()} = {mon[c].min():.2f}, max {mon[c].idxmax()} = {mon[c].max():.2f}" for c in mon.columns) + "\n")
    # LF>1 rows detail
    md.append(f"\n- In-scope origin passenger rows with LF>1: {(p.lf > 1).sum():,} of {len(p):,} ({100*(p.lf>1).mean():.2f} %); LF>1.5: {(p.lf>1.5).sum():,}\n")

    # --- 5. scope side / double counting
    ss = df[df.scope_side != "neither"].groupby("scope_side").agg(rows=("scope_side", "size"), departures=("DEPARTURES_PERFORMED", "sum"),
                                                                    seats=("SEATS", "sum"), passengers=("PASSENGERS", "sum"))
    ss["rows %"] = 100 * ss.rows / ss.rows.sum()
    ss["pax %"] = 100 * ss.passengers / ss.passengers.sum()
    md.append(section("Scope membership of rows (origin in scope / dest in scope / both)", 4))
    md.append(md_table(ss.round(1)))
    neither = int((df.scope_side == "neither").sum())
    md.append(f"\n- Rows where neither end is in scope: {neither:,} (should be 0).\n")
    both = df[df.scope_side == "both"]
    md.append(f"- Both-in-scope rows would be counted twice if summing passengers over `ORIGIN in scope` + `DEST in scope`: "
              f"{len(both):,} rows, {both.PASSENGERS.sum():,.0f} passengers ({100 * both.PASSENGERS.sum() / ss.passengers.sum():.1f} % of scope pax). "
              f"Pairs: {both.groupby(['ORIGIN','DEST']).PASSENGERS.sum().sort_values(ascending=False).head(6).round(0).to_dict()}\n")
    md.append("- Rule of thumb: define airport passengers as `ORIGIN`-basis (enplaned) OR `DEST`-basis (deplaned), never the sum of both. "
              "T-100 enplaned vs deplaned symmetry check follows.\n")
    en = df[df.is_pax_class].groupby(["DEST"]).PASSENGERS.sum()
    ed = df[df.is_pax_class].groupby(["ORIGIN"]).PASSENGERS.sum()
    sym = pd.DataFrame({"enplaned (origin)": ed, "deplaned (dest)": en}).reindex(SCOPE)
    sym["dest/origin"] = sym["deplaned (dest)"] / sym["enplaned (origin)"]
    md.append("\nEnplaned vs deplaned passengers, F+L, all years:\n\n" + md_table(sym.round(3)))

    # --- 6. Passengers per airport by year (enplaned, F+L)
    py = df[df.o_in & df.is_pax_class].pivot_table(index="ORIGIN", columns="YEAR", values="PASSENGERS", aggfunc="sum").reindex(SCOPE)
    md.append(section("Enplaned passengers per airport per year (origin basis, F+L)", 4))
    md.append(md_table(py.round(0).astype("Int64")))
    lastY = last // 100
    lastM = last % 100
    same = df[df.o_in & df.is_pax_class & (df.MONTH <= lastM)].pivot_table(index="ORIGIN", columns="YEAR", values="PASSENGERS", aggfunc="sum").reindex(SCOPE)
    md.append(f"\nSame-window comparison (Jan-{lastM:02d} of each year, enplaned):\n\n" + md_table(same.round(0).astype("Int64")))
    rec = pd.DataFrame({"Jan-Jul 2019": same[2019], f"Jan-Jul {lastY}": same[lastY]})
    rec["vs 2019 %"] = 100 * (rec.iloc[:, 1] / rec.iloc[:, 0] - 1)
    md.append("\nRecovery vs 2019 (same months):\n\n" + md_table(rec.round(1)))
    lm = df[df.o_in & df.is_pax_class & (df.ym == last)].groupby("ORIGIN").PASSENGERS.sum().reindex(SCOPE)
    lm_prev = df[df.o_in & df.is_pax_class & (df.ym == last - 100)].groupby("ORIGIN").PASSENGERS.sum().reindex(SCOPE)
    lt = pd.DataFrame({f"{last} pax": lm, f"{last - 100} pax": lm_prev})
    lt["YoY %"] = 100 * (lt.iloc[:, 0] / lt.iloc[:, 1] - 1)
    md.append(f"\nLatest month ({last}) vs same month prior year:\n\n" + md_table(lt.round(1)))

    # --- 7. coverage grid airport x month (pax-class origin rows)
    g = df[df.o_in & df.is_pax_class & (df.PASSENGERS > 0)].pivot_table(index="ORIGIN", columns="ym", values="PASSENGERS", aggfunc="size").reindex(index=SCOPE, columns=exp)
    gaps = []
    for a in SCOPE:
        miss = [int(c) for c in exp if pd.isna(g.loc[a, c])]
        if miss:
            gaps.append(f"{a}: {miss}")
    md.append(section("Coverage grid: airport x year-month (origin, F+L, passengers>0)", 4))
    md.append(f"Grid is {len(SCOPE)} airports x {len(exp)} months = {len(SCOPE) * len(exp)} cells; cells with no rows: {sum(g.isna().sum()):,}.\n\n")
    md.append("Gaps (every missing airport-month): " + (("\n- " + "\n- ".join(gaps)) if gaps else "none") + "\n")
    rpm = df[df.o_in].groupby(["ORIGIN", "YEAR"]).size().unstack().reindex(SCOPE)
    md.append("\nRows per airport per year (origin side, all classes):\n\n" + md_table(rpm))
    # routes with very few months?
    # --- 8. Long-haul at ANC (distance definition sensitivity)
    ap_ = df[(df.ORIGIN == "ANC") & df.is_pax_class & (df.DEPARTURES_PERFORMED > 0)]
    tot = ap_.DEPARTURES_PERFORMED.sum()
    rows = []
    for thr in [500, 1000, 1500, 2000, 2500, 3000]:
        r = {"threshold (mi)": f">= {thr}", "dep share %": 100 * ap_.loc[ap_.DISTANCE >= thr, "DEPARTURES_PERFORMED"].sum() / tot}
        for y in [2019, 2024, 2025]:
            a_ = ap_[ap_.YEAR == y]
            r[f"{y} %"] = 100 * a_.loc[a_.DISTANCE >= thr, "DEPARTURES_PERFORMED"].sum() / a_.DEPARTURES_PERFORMED.sum()
        rows.append(r)
    md.append(section("ANC long-haul sensitivity: share of passenger-class (F+L) departures by distance threshold", 4))
    md.append(md_table(pd.DataFrame(rows).set_index("threshold (mi)").round(1)))
    dg = ap_.groupby("DISTANCE_GROUP").DEPARTURES_PERFORMED.sum()
    md.append("\nDeparture share by DISTANCE_GROUP (1 = <500 mi, 500-mi bins): "
              + ", ".join(f"{k}: {100 * v / tot:.1f} %" for k, v in dg.items()) + "\n")
    top_d = ap_.groupby("DEST").agg(dep=("DEPARTURES_PERFORMED", "sum"), dist=("DISTANCE", "first")).sort_values("dep", ascending=False).head(10)
    md.append("\nTop ANC destinations (F+L departures, all years): " + ", ".join(f"{k} ({v.dep:,.0f}, {v.dist:,.0f} mi)" for k, v in top_d.iterrows()) + "\n")
    dist_chk = df.groupby(["ORIGIN", "DEST"]).DISTANCE.nunique()
    md.append(f"- Route pairs with >1 distinct DISTANCE value: {int((dist_chk > 1).sum()):,} (distance should be constant per pair)\n")
    intl = ap_.groupby("DATA_SOURCE").DEPARTURES_PERFORMED.sum()
    md.append(f"- ANC pax departures by DATA_SOURCE: {intl.round(0).to_dict()} (international legs likely to Asia: long-haul)\n")
    # groups sanity: DISTANCE_GROUP vs distance
    dgc = df[df.DISTANCE > 0].assign(expect=lambda d: np.ceil(d.DISTANCE / 500).clip(1, 20))
    mism = int((dgc.expect != dgc.DISTANCE_GROUP).sum())
    md.append(f"- Rows where DISTANCE_GROUP != ceil(DISTANCE/500): {mism:,} of {len(dgc):,}\n")

    # --- 9. SFO unmet-demand relevant: scheduled vs performed
    sfo = df[(df.ORIGIN == "SFO") & df.is_pax_class].groupby("YEAR").agg(sched=("DEPARTURES_SCHEDULED", "sum"), perf=("DEPARTURES_PERFORMED", "sum"),
                                                                       seats=("SEATS", "sum"), pax=("PASSENGERS", "sum"))
    sfo["perf/sched"] = sfo.perf / sfo.sched
    sfo["LF"] = sfo.pax / sfo.seats
    md.append(section("SFO (origin, F+L): scheduled vs performed departures and LF", 4))
    md.append(md_table(sfo.round(3)))
    sc0 = df[df.o_in & df.is_pax_class].groupby("ORIGIN").apply(lambda g: g.DEPARTURES_SCHEDULED.sum() / g.DEPARTURES_PERFORMED.sum(), include_groups=False).reindex(SCOPE)
    md.append(f"\n- Scheduled/performed ratio (all years, F+L) by airport: {sc0.round(2).to_dict()}; if scheduled is mostly 0 for some "
              "carriers/airports, `DEPARTURES_SCHEDULED` is not a usable cancellation proxy.\n")
    zs = df[df.o_in & df.is_pax_class & (df.DEPARTURES_PERFORMED > 0)]
    md.append(f"- Scope F+L rows with performed>0 and scheduled=0: {int((zs.DEPARTURES_SCHEDULED == 0).sum()):,} of {len(zs):,} "
              f"({100 * (zs.DEPARTURES_SCHEDULED == 0).mean():.1f} %)\n")

    return {"md": "\n".join(md), "rows": len(df), "info": info, "files": files, "last_ym": last, "gaps": gaps,
            "checks": ck, "scope_pax_rows": n_scope_pax, "lf": rowq, "py": py, "same": same, "scope_side": ss,
            "range": (min(ym), last), "airports": set(df.ORIGIN) & S | set(df.DEST) & S, "both": both}


if __name__ == "__main__":
    print(profile()["md"])
