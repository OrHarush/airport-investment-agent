"""Row-impact numbers for the proposed cleaning plan (read-only; computes counts, saves nothing)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import RAW, SCOPE

S = set(SCOPE)
KEY = ["YEAR", "MONTH", "UNIQUE_CARRIER", "ORIGIN", "DEST", "AIRCRAFT_TYPE", "AIRCRAFT_CONFIG", "CLASS"]


def n(x) -> str:
    return f"{int(round(x)):,}"


def p(x, d=1) -> str:
    return f"{x:.{d}f} %"


def compute(res: dict) -> dict:
    m: dict[str, str] = {}
    # ------------------------------------------------------------------ T-100
    t = pd.concat([pd.read_csv(f) for f in sorted((RAW / "t100").glob("*.csv.gz"))], ignore_index=True)
    N = len(t)
    pax = t.CLASS.isin(["F", "L"])
    o_in, d_in = t.ORIGIN.isin(S), t.DEST.isin(S)
    m["t_rows"] = n(N)
    m["t_rows_cargo"] = n((~pax).sum())
    m["t_rows_cargo_pct"] = p(100 * (~pax).mean())
    m["t_rows_pax"] = n(pax.sum())
    zero = pax & (t.DEPARTURES_PERFORMED == 0)
    m["t_zero_perf"] = n(zero.sum())
    sz = pax & (t.SEATS == 0) & (t.PASSENGERS > 0)
    m["t_seats0_pax"] = n(sz.sum())
    gt = pax & (t.SEATS > 0) & (t.PASSENGERS > t.SEATS)
    m["t_pax_gt_seats"] = n(gt.sum())
    m["t_pax_gt_seats_pax"] = n(t.loc[gt, "PASSENGERS"].sum())
    g105 = pax & (t.SEATS > 0) & (t.PASSENGERS > 1.05 * t.SEATS)
    m["t_pax_gt_105"] = n(g105.sum())
    d0 = t.DISTANCE == 0
    m["t_dist0"] = n(d0.sum())
    m["t_dist0_pax"] = n((d0 & pax).sum())
    m["t_dist0_same"] = n((d0 & (t.ORIGIN == t.DEST)).sum())
    m["t_dist0_pax_total"] = n(t.loc[d0 & pax, "PASSENGERS"].sum())
    dup = t.duplicated(KEY, keep="first")
    m["t_key_extra"] = n(dup.sum())
    m["t_key_extra_pax"] = n((dup & pax).sum())
    allk = t.duplicated(KEY, keep=False)
    m["t_key_rows_pax_total"] = n(t.loc[allk & pax, "PASSENGERS"].sum())
    both = o_in & d_in
    m["t_both"] = n(both.sum())
    m["t_both_pct"] = p(100 * both.mean())
    m["t_both_pax"] = n(t.loc[both & pax, "PASSENGERS"].sum())
    m["t_2026_rows"] = n((t.YEAR == 2026).sum())
    fl = pax & (t.DEPARTURES_PERFORMED > 0)
    m["t_sched0_pct"] = p(100 * ((t.DEPARTURES_SCHEDULED == 0) & fl).sum() / fl.sum())
    # LF-eligible rows (scope origin, F/L, seats>0, performed>0)
    lf_ok = o_in & pax & (t.SEATS > 0) & (t.DEPARTURES_PERFORMED > 0)
    m["t_lf_rows"] = n(lf_ok.sum())
    m["t_lf_excluded"] = n((o_in & pax).sum() - lf_ok.sum())
    m["t_o_pax_rows"] = n((o_in & pax).sum())
    # ANC long-haul sensitivity
    a = t[(t.ORIGIN == "ANC") & (t.DEPARTURES_PERFORMED > 0)]
    ap = a[a.CLASS.isin(["F", "L"])]
    for thr in (1000, 1500, 2000, 2500):
        m[f"anc_lh{thr}"] = p(100 * ap.loc[ap.DISTANCE >= thr, "DEPARTURES_PERFORMED"].sum() / ap.DEPARTURES_PERFORMED.sum())
        m[f"anc_lh{thr}_all"] = p(100 * a.loc[a.DISTANCE >= thr, "DEPARTURES_PERFORMED"].sum() / a.DEPARTURES_PERFORMED.sum())
        f_only = ap[ap.CLASS == "F"]
        m[f"anc_lh{thr}_F"] = p(100 * f_only.loc[f_only.DISTANCE >= thr, "DEPARTURES_PERFORMED"].sum() / f_only.DEPARTURES_PERFORMED.sum())
    m["anc_sea_pct"] = p(100 * ap.loc[ap.DEST == "SEA", "DEPARTURES_PERFORMED"].sum() / ap.DEPARTURES_PERFORMED.sum())
    m["anc_cargo_dep_pct"] = p(100 * a.loc[~a.CLASS.isin(["F", "L"]), "DEPARTURES_PERFORMED"].sum() / a.DEPARTURES_PERFORMED.sum())
    m["anc_dep_pax"] = n(ap.DEPARTURES_PERFORMED.sum())
    # LF levels for the narrative
    lfd = t[lf_ok].groupby(["ORIGIN", "YEAR"]).apply(lambda g: g.PASSENGERS.sum() / g.SEATS.sum(), include_groups=False).unstack()
    for ap_ in ("SFO", "LAX", "ANC", "FAI", "BUR"):
        m[f"lf_{ap_}_2019"] = f"{lfd.loc[ap_, 2019]:.3f}"
        m[f"lf_{ap_}_2025"] = f"{lfd.loc[ap_, 2025]:.3f}"
    m["lf_sfo_peak"] = ""  # filled below
    mon = t[lf_ok & (t.ORIGIN == "SFO") & (t.YEAR >= 2023)].groupby(["YEAR", "MONTH"]).apply(lambda g: g.PASSENGERS.sum() / g.SEATS.sum(), include_groups=False)
    m["lf_sfo_peak"] = f"{mon.max():.2f} ({'-'.join(map(str, mon.idxmax()))})"
    m["lf_sfo_min23"] = f"{mon.min():.2f} ({'-'.join(map(str, mon.idxmin()))})"

    # ------------------------------------------------------------------ On-Time
    o = res["ontime"]["stats"]
    for k, v in o.items():
        m["o_" + k] = n(v) if isinstance(v, (int, np.integer)) else v

    # ------------------------------------------------------------------ Fares / TAF / OurAirports
    f = res["fares"]["df"]
    m["f_rows"] = n(len(f))
    last4 = f[f.yq.isin(sorted(f.yq.unique())[-4:])]
    med = last4.groupby("airport_code").avg_fare_usd.mean()
    nat = med.median()
    rel = (med / nat).round(2)
    m["f_rel_sfo"], m["f_rel_anc"], m["f_rel_bur"], m["f_rel_btv"] = (str(rel[x]) for x in ("SFO", "ANC", "BUR", "BTV"))
    rec = res["taf"]["enpl"]
    m["taf_rows"] = n(res["taf"]["rows"])
    m["taf_last_actual"] = str(res["taf"]["last_actual"])
    rn = res["ourairports"]["runways"]
    m["oa_closed_rows"] = n(rn["closed_rows"].sum())
    m["oa_closed_airports"] = ", ".join(f"{i} ({int(r.closed_rows)})" for i, r in rn.iterrows() if r.closed_rows > 0)

    # coverage strings for the summary table
    def ym(x):
        return f"{x // 100}-{x % 100:02d}"
    t_lo, t_hi = res["t100"]["range"]
    o_lo, o_hi = res["ontime"]["range"]
    m["cov_ourairports"] = "16/16 airports, 50 runway rows (static snapshot)"
    m["cov_t100"] = f"{ym(t_lo)} to {ym(t_hi)}; 16/16 airports; {len(res['t100']['gaps'])} airport-month gaps"
    m["cov_ontime"] = f"{ym(o_lo)} to {ym(o_hi)}; 16/16 airports; {len(res['ontime']['gaps'])} airport-month gaps"
    m["cov_fares"] = f"{res['fares']['range'][0]} to {res['fares']['range'][1]}; 16 x 30 quarters, {len(res['fares']['gaps'])} gaps"
    m["cov_taf"] = f"FY{res['taf']['years'][0]} to FY{res['taf']['years'][1]} (actual to FY{res['taf']['last_actual']}); 16/16"
    m["cov_nas"] = "one live snapshot, no history"
    return m
