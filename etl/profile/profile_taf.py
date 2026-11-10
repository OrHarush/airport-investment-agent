"""Profile data/raw/taf (read-only). FAA Terminal Area Forecast 2025 (fiscal years)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import RAW, SCOPE, generic_profile, md_table, section

D = RAW / "taf"
YEARS = [2019, 2024, 2025, 2030, 2040, 2055]


def profile() -> dict:
    en = pd.read_csv(D / "taf_enplanements_scope.csv", dtype={"locid": "string"})
    op = pd.read_csv(D / "taf_operations_scope.csv", dtype={"locid": "string"})
    ap = pd.read_csv(D / "taf_airports_scope.csv", dtype={"LOCID": "string"})
    md = []
    flags = {}

    for name, df, key in [("taf_enplanements_scope.csv", en, ["locid", "scenario", "ayear"]),
                          ("taf_operations_scope.csv", op, ["locid", "scenario", "ayear"]),
                          ("taf_airports_scope.csv", ap, ["LOCID"])]:
        md.append(f"\n**{name}**\n")
        m, info = generic_profile(df, key, [D / name])
        md.append(m)
        flags[name] = info

    # --- whitespace / id checks
    ws_lines = []
    for name, df, col in [("enplanements", en, "locid"), ("operations", op, "locid"), ("airports", ap, "LOCID")]:
        raw = df[col]
        n_ws = int((raw != raw.str.strip()).sum())
        n_case = int((raw.str.strip() != raw.str.strip().str.upper()).sum())
        ws_lines.append(f"- `{name}.{col}`: {n_ws:,} values with leading/trailing whitespace, {n_case} not upper-case; "
                        f"distinct raw={raw.nunique()}, distinct stripped={raw.str.strip().nunique()}")
    md.append(section("ID hygiene", 4))
    md.append("\n".join(ws_lines) + "\n")
    ap["name_len"] = ap["APORT_NAME"].str.len()
    md.append(f"- `APORT_NAME` is space-padded (max len {int(ap['name_len'].max())}); strip before display.\n")

    en["locid"] = en["locid"].str.strip()
    op["locid"] = op["locid"].str.strip()
    # NOTE: us_flag + frgn_flag are international enplanements and are NOT inside aac/aat/commuter
    # (verified against T-100: LAX 2019 domestic-only 30.6M vs total 42.8M vs T-100 43.4M).
    en["domestic"] = en[["aac", "aat", "commuter"]].sum(axis=1)
    en["total"] = en[["aac", "aat", "commuter", "us_flag", "frgn_flag"]].sum(axis=1)
    op["ops_total"] = op[["itn_Ac", "itn_at", "itn_ga", "itn_mil", "loc_ga", "loc_mil"]].sum(axis=1)
    op["ops_commercial"] = op[["itn_Ac", "itn_at"]].sum(axis=1)

    # --- actual vs forecast boundary
    b = en.groupby("scenario")["ayear"].agg(["min", "max", "count"])
    bo = op.groupby("scenario")["ayear"].agg(["min", "max", "count"])
    md.append(section("Actual vs forecast boundary (scenario 0 = actual, 1 = forecast)", 4))
    md.append("Enplanements:\n\n" + md_table(b) + "\nOperations:\n\n" + md_table(bo))
    last_actual = int(en.loc[en.scenario == 0, "ayear"].max())
    overlap = en.groupby(["locid", "ayear"])["scenario"].nunique()
    md.append(f"\n- Last actual year: **FY{last_actual}**; (locid, year) pairs present as both actual and forecast: "
              f"{int((overlap > 1).sum())}\n")
    md.append(f"- Scenario values: {en.scenario.value_counts().to_dict()}\n")

    # --- coverage grid & gaps
    cnt = en.groupby(["locid", "ayear"]).size().unstack(fill_value=0)
    gaps = []
    for a in SCOPE:
        if a not in cnt.index:
            gaps.append(f"{a}: ENTIRELY MISSING")
            continue
        yrs = set(cnt.columns[cnt.loc[a] > 0])
        rng = set(range(min(yrs), max(yrs) + 1))
        miss = sorted(rng - yrs)
        if miss:
            gaps.append(f"{a}: missing years {miss}")
    ranges = en.groupby("locid")["ayear"].agg(["min", "max", "count"]).reindex(SCOPE)
    md.append(section("Coverage (enplanements: year range per airport)", 4))
    md.append(md_table(ranges))
    md.append(f"\n**Gaps inside range:** {gaps or 'none'}\n")
    ranges_o = op.groupby("locid")["ayear"].agg(["min", "max", "count"]).reindex(SCOPE)
    md.append("\nOperations year range per airport:\n\n" + md_table(ranges_o))

    # --- values by airport and year
    pv = en.pivot_table(index="locid", columns="ayear", values="total", aggfunc="sum").reindex(SCOPE)
    pd_ = en.pivot_table(index="locid", columns="ayear", values="domestic", aggfunc="sum").reindex(SCOPE)
    md.append(section("Total enplanements (aac+aat+commuter+us_flag+frgn_flag) – 2019, 2024, 2025, 2030, 2040, 2055", 4))
    md.append("**Definition finding:** `docs/data-sources.md` says total = aac+aat+commuter. That omits international "
              "(`us_flag`, `frgn_flag`) and understates gateways (LAX, SFO, BOS, OAK, ANC) by up to ~30 %. "
              "The 5-column sum reconciles with T-100 (see Cross-source). Domestic-only shown below for comparison.\n\n")
    md.append(md_table(pv[YEARS].round(0).astype("Int64")))
    intl_share = (1 - pd_[YEARS] / pv[YEARS]) * 100
    md.append("\nInternational share of total (%), i.e. what the 3-column sum would miss:\n\n" + md_table(intl_share.round(1)))
    pvo = op.pivot_table(index="locid", columns="ayear", values="ops_total", aggfunc="sum").reindex(SCOPE)
    md.append(section("Total operations (all itinerant + local) – same years", 4))
    md.append(md_table(pvo[[y for y in YEARS if y in pvo.columns]].round(0).astype("Int64")))
    pvc = op.pivot_table(index="locid", columns="ayear", values="ops_commercial", aggfunc="sum").reindex(SCOPE)
    md.append("\nCommercial ops (itn_Ac + itn_at):\n\n" + md_table(pvc[[y for y in YEARS if y in pvc.columns]].round(0).astype("Int64")))

    # --- CAGR & plausibility
    def cagr(a, b, n):
        return (b / a) ** (1 / n) - 1 if a and a > 0 and b and b > 0 else np.nan
    rows = []
    for a in SCOPE:
        r = {"airport": a}
        if a in pv.index:
            p = pv.loc[a]
            r["enpl 2019→2024 CAGR %"] = 100 * cagr(p.get(2019), p.get(2024), 5)
            r["2024→2030 %"] = 100 * cagr(p.get(2024), p.get(2030), 6)
            r["2024→2040 %"] = 100 * cagr(p.get(2024), p.get(2040), 16)
            r["2024→2055 %"] = 100 * cagr(p.get(2024), p.get(2055), 31)
            r["2055/2024 ×"] = p.get(2055) / p.get(2024) if p.get(2024) else np.nan
            r["2025/2024 YoY %"] = 100 * (p.get(2025) / p.get(2024) - 1) if p.get(2024) else np.nan
            r["2024 vs 2019 %"] = 100 * (p.get(2024) / p.get(2019) - 1) if p.get(2019) else np.nan
        rows.append(r)
    ct = pd.DataFrame(rows).set_index("airport").round(2)
    md.append(section("Forecast sanity: CAGR by airport", 4))
    md.append(md_table(ct))
    odd = ct[(ct["2024→2055 %"] > 4) | (ct["2024→2055 %"] < -0.5) | (ct["2025/2024 YoY %"].abs() > 15)]
    md.append(f"\n- Airports with long-run forecast CAGR >4 % or <-0.5 %, or |2025 YoY| >15 %: "
              f"{list(odd.index) if len(odd) else 'none'}\n")

    # recovery check vs 2019 (is the 2019 baseline plausible?)
    ser = en[en.locid.isin(SCOPE)].pivot_table(index="ayear", columns="locid", values="total", aggfunc="sum")
    yoy = ser.pct_change() * 100
    big = [(a, int(y), round(v, 1)) for a in SCOPE if a in yoy for y, v in yoy[a].dropna().items()
           if abs(v) > 40 and 2015 <= y <= 2030]
    md.append(f"- Year-over-year changes >40 % in 2015–2030 (airport, FY, %): {big}\n")
    md.append("- Fiscal year (Oct–Sep), not calendar year; FY2020/FY2021 absorb COVID: real extreme, not error.\n")
    pre = en.assign(t=en.total).query("ayear==2019 and locid in @SCOPE")
    md.append(f"- 2019 baseline present for {pre.locid.nunique()}/16 airports; zero-valued rows in scope: "
              f"{int((en[en.locid.isin(SCOPE)].total == 0).sum())}\n")

    # airport table facts
    at = ap.assign(LOCID=ap.LOCID.str.strip(), APORT_NAME=ap.APORT_NAME.str.strip()).set_index("LOCID").reindex(SCOPE)
    md.append(section("Airports table (selected)", 4))
    md.append(md_table(at[["APORT_NAME", "STATE", "FAC_CLASS", "SER_VOL", "HUB_SIZE", "ATCT_FLAG", "OEP35"]]))

    # prior hub-scale check against T-100 handled in cross-source
    return {"md": "\n".join(md), "rows": len(en) + len(op) + len(ap), "enpl": pv, "enpl_dom": pd_, "ops": pvo, "cagr": ct, "gaps": gaps,
            "ids": set(en.locid) & set(SCOPE), "last_actual": last_actual,
            "years": (int(en.ayear.min()), int(en.ayear.max())),
            "files": [D / "taf_enplanements_scope.csv", D / "taf_operations_scope.csv", D / "taf_airports_scope.csv"],
            "flags": flags}


if __name__ == "__main__":
    print(profile()["md"])
