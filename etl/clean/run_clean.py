"""Phase 2 ETL: data/raw (read-only) -> data/clean/*.csv, plus the schema section of docs/data-profile.md.

Usage: python etl/clean/run_clean.py

Rules implemented are the approved cleaning plan (docs/data-profile.md, section 9) with the user's decisions:
route-level T-100 rows (cutoffs are query parameters), cargo in its own table, On-Time aggregated to airport-month,
coverage_pct < 50 % in the scoring window nulls the delay metric for scoring, fare benchmark = 16-airport median per quarter,
both growth definitions stored. Never writes under data/raw.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
CLEAN = ROOT / "data" / "clean"
DOC = ROOT / "docs" / "data-profile.md"

SCOPE = ["BOS", "BDL", "PVD", "MHT", "PWM", "BTV", "LAX", "SNA", "BUR", "LGB", "ONT", "ANC", "FAI", "SFO", "OAK", "SJC"]
S = set(SCOPE)
GROUP = {**{a: "New England" for a in SCOPE[:6]}, **{a: "Southern California" for a in ("LAX", "SNA", "BUR", "LGB", "ONT")},
         "ANC": "Alaska", "FAI": "Alaska", **{a: "Bay Area" for a in ("SFO", "OAK", "SJC")}}
WINDOW = (201901, 202606)          # scoring window (fares exist through 2026Q2)
L12, P12 = (202507, 202606), (202407, 202506)
LATEST_FULL_YEAR, BASE_YEAR = 2025, 2019
COVERAGE_MIN = 50.0
CAUSES = {"CarrierDelay": "carrier_min", "WeatherDelay": "weather_min", "NASDelay": "nas_min",
          "SecurityDelay": "security_min", "LateAircraftDelay": "late_aircraft_min"}

flags: list[dict] = []


def flag(source, table, flag_name, severity, rows, detail, airport=None, period=None):
    flags.append({"source": source, "table": table, "airport": airport, "period": period, "flag": flag_name,
                  "severity": severity, "rows_affected": int(rows), "detail": detail})


def ym_int(y, m):
    return y * 100 + m


# ---------------------------------------------------------------------------------------------------- airports
def build_airports() -> pd.DataFrame:
    ap = pd.read_csv(RAW / "ourairports" / "airports.csv")
    rw = pd.read_csv(RAW / "ourairports" / "runways.csv")
    rw["closed"] = rw["closed"].fillna(0).astype(int)
    op = rw[rw.closed == 0].groupby("airport_ident").agg(open_runways=("id", "size"), longest_open_runway_ft=("length_ft", "max"))
    cl = rw[rw.closed == 1].groupby("airport_ident").size().rename("closed_runways")
    a = ap.set_index("ident").join(op).join(cl)
    a["closed_runways"] = a["closed_runways"].fillna(0).astype(int)
    taf = pd.read_csv(RAW / "taf" / "taf_airports_scope.csv", dtype={"LOCID": str})
    taf["LOCID"] = taf["LOCID"].str.strip()
    taf = taf.set_index("LOCID")[["HUB_SIZE", "FAC_CLASS"]].rename(columns={"HUB_SIZE": "taf_hub_size", "FAC_CLASS": "taf_facility_class"})
    a = a.reset_index().rename(columns={"ident": "icao_ident", "iata_code": "airport"})
    a["airport"] = a["airport"].str.strip().str.upper()
    a = a.merge(taf, left_on="airport", right_index=True, how="left")
    a["state"] = a["iso_region"].str.replace("US-", "", regex=False)
    a["region_group"] = a["airport"].map(GROUP)
    a["is_new_england"] = a["region_group"].eq("New England")
    a = a.rename(columns={"name": "name", "municipality": "city", "latitude_deg": "latitude", "longitude_deg": "longitude", "type": "airport_type"})
    cols = ["airport", "icao_ident", "name", "city", "state", "region_group", "is_new_england", "airport_type", "scheduled_service",
            "latitude", "longitude", "open_runways", "closed_runways", "longest_open_runway_ft", "taf_hub_size", "taf_facility_class"]
    a = a[cols].set_index("airport").reindex(SCOPE).reset_index()
    flag("ourairports", "airports", "closed_runways_excluded", "info", a.closed_runways.sum(),
         "Runways with closed=1 are excluded from open_runways/longest_open_runway_ft: " +
         ", ".join(f"{r.airport} ({r.closed_runways})" for r in a.itertuples() if r.closed_runways))
    return a


# ---------------------------------------------------------------------------------------------------- T-100
def build_t100():
    t = pd.concat([pd.read_csv(f) for f in sorted((RAW / "t100").glob("t100_segment_*.csv.gz"))], ignore_index=True)
    n_raw = len(t)
    last_ym = int((t.YEAR * 100 + t.MONTH).max())
    key = ["YEAR", "MONTH", "UNIQUE_CARRIER", "ORIGIN", "DEST", "AIRCRAFT_TYPE", "AIRCRAFT_CONFIG", "CLASS"]
    collisions = int(t.duplicated(key).sum())
    flag("t100", "route_stats", "key_collisions_summed", "info", collisions,
         "Rows sharing (year, month, carrier, origin, dest, aircraft type, config, class) carry different measures (separate partial records); summed. Aircraft type is aggregated away at route level.")
    t["service_class"] = t.CLASS
    t["is_international"] = t.DATA_SOURCE.isin(["IU", "IF"])
    pax = t.service_class.isin(["F", "L"])
    zero_perf = int((pax & (t.DEPARTURES_PERFORMED == 0)).sum())

    gk = ["YEAR", "MONTH", "ORIGIN", "DEST", "UNIQUE_CARRIER", "service_class", "is_international"]

    def agg(df, extra):
        a = df.groupby(gk, as_index=False).agg(carrier_name=("UNIQUE_CARRIER_NAME", "first"), departures=("DEPARTURES_PERFORMED", "sum"),
                                              seats=("SEATS", "sum"), passengers=("PASSENGERS", "sum"), distance=("DISTANCE", "max"),
                                              **extra)
        a = a.rename(columns={"YEAR": "year", "MONTH": "month", "ORIGIN": "origin", "DEST": "dest", "UNIQUE_CARRIER": "carrier"})
        a["period"] = a.year.astype(str) + "-" + a.month.astype(str).str.zfill(2)
        pi = a.year * 100 + a.month
        a["origin_in_scope"] = a.origin.isin(S)
        a["dest_in_scope"] = a.dest.isin(S)
        a["distance_valid"] = a.distance > 0
        a["is_partial_year"] = a.year == last_ym // 100
        a["in_scoring_window"] = (pi >= WINDOW[0]) & (pi <= WINDOW[1])
        return a

    r = agg(t[pax], {})
    r["lf_eligible"] = (r.seats > 0) & (r.departures > 0)
    r["lf_anomaly"] = (r.seats > 0) & (r.passengers > r.seats)
    r = r[["year", "month", "period", "origin", "dest", "carrier", "carrier_name", "service_class", "is_international", "departures", "seats",
           "passengers", "distance", "distance_valid", "lf_eligible", "lf_anomaly", "origin_in_scope", "dest_in_scope", "is_partial_year",
           "in_scoring_window"]]
    c = agg(t[~pax], {"freight_lbs": ("FREIGHT", "sum"), "mail_lbs": ("MAIL", "sum")})
    c = c[["year", "month", "period", "origin", "dest", "carrier", "carrier_name", "service_class", "is_international", "departures",
           "freight_lbs", "mail_lbs", "passengers", "distance", "distance_valid", "origin_in_scope", "dest_in_scope", "is_partial_year",
           "in_scoring_window"]]
    flag("t100", "route_stats", "cargo_rows_moved", "info", int((~t[pax.index].eq(0).all(axis=1) & ~pax).sum()) if False else int((~pax).sum()),
         "CLASS G/P raw rows moved to cargo_route_stats (passengers there are ~0).")
    flag("t100", "route_stats", "lf_ineligible_rows", "info", int((~r.lf_eligible).sum()),
         f"Route rows with seats=0 or departures=0 (schedule-only placeholders; {zero_perf} raw all-zero rows). passengers kept; excluded from load factor via lf_eligible.")
    flag("t100", "route_stats", "passengers_exceed_seats", "warn", int(r.lf_anomaly.sum()),
         "Route rows with passengers > seats (tiny air-taxi aircraft). Kept and flagged via lf_anomaly.")
    flag("t100", "route_stats", "distance_zero", "info", int((~r.distance_valid).sum()),
         "Same-airport (origin = dest) rows; distance_valid=false. Exclude from distance/long-haul queries; kept in passenger totals.")
    flag("t100", "route_stats", "partial_year", "warn", int(r.is_partial_year.sum()),
         f"Latest year is partial (through {last_ym}); is_partial_year=true. Annual metrics use full years only.")
    flag("t100", "route_stats", "outside_scoring_window", "info", int((~r.in_scoring_window).sum()),
         f"Months after {WINDOW[1]} are kept but in_scoring_window=false.")
    flag("t100", "route_stats", "departures_scheduled_dropped", "info", n_raw,
         "DEPARTURES_SCHEDULED is zero on ~28 % of flown passenger rows and is not carried into clean data.")
    return r, c, last_ym, t


# ---------------------------------------------------------------------------------------------------- On-Time
def _agg_ot(d: pd.DataFrame, key: str, direction: str, year: int) -> pd.DataFrame:
    dcol, fcol, tcol = ("DepDelay", "DepDel15", "TaxiOut") if direction == "dep" else ("ArrDelay", "ArrDel15", "TaxiIn")
    d = d[d[key].isin(S)]
    g = d.groupby([key, "Month"])
    out = g.agg(flights=("Cancelled", "size"), cancelled=("Cancelled", "sum"), diverted=("Diverted", "sum"))
    f = d[(d.Cancelled == 0) & (d.Diverted == 0)].copy()
    f["nas_pos"] = (f["NASDelay"] > 0).astype("int8")
    f["d15"] = (f[fcol] == 1).astype("int8")
    f["capped"] = f[dcol].clip(upper=600)
    gf = f.groupby([key, "Month"])
    out["flown"] = gf.size()
    out["delayed15"] = gf["d15"].sum()
    for src, dst in CAUSES.items():
        out[dst] = gf[src].sum()
    out["nas_delayed_flights"] = gf["nas_pos"].sum()
    out["median_delay_min"] = gf[dcol].median()
    out["p95_delay_min"] = gf[dcol].quantile(0.95)
    out["mean_delay_capped600_min"] = gf["capped"].mean()
    out["median_taxi_min"] = gf[tcol].median()
    out["max_delay_min"] = gf[dcol].max()
    out = out.reset_index().rename(columns={key: "airport", "Month": "month"})
    out["year"] = year
    out["direction"] = direction
    return out


def build_delay(t100_routes: pd.DataFrame) -> pd.DataFrame:
    cols = ["Year", "Month", "Origin", "Dest", "DepDelay", "DepDel15", "ArrDelay", "ArrDel15", "Cancelled", "Diverted", "TaxiOut", "TaxiIn",
            "CarrierDelay", "WeatherDelay", "NASDelay", "SecurityDelay", "LateAircraftDelay"]
    parts = []
    n_in = 0
    extreme = 0
    allnull = 0
    for f in sorted((RAW / "ontime").glob("ontime_*.csv.gz")):
        d = pd.read_csv(f, usecols=cols, dtype={"Origin": str, "Dest": str})
        n_in += len(d)
        y = int(d.Year.iloc[0])
        fl = (d.Cancelled == 0) & (d.Diverted == 0)
        extreme += int(((d.ArrDelay > 600) & fl & (d.Origin.isin(S) | d.Dest.isin(S))).sum())
        allnull += int((fl & (d.ArrDel15 == 1) & d[list(CAUSES)].isna().all(axis=1)).sum())
        parts.append(_agg_ot(d, "Origin", "dep", y))
        parts.append(_agg_ot(d, "Dest", "arr", y))
        print(f"  on-time {f.name}: {len(d):,} rows", flush=True)
    x = pd.concat(parts, ignore_index=True)
    for c in ["flights", "cancelled", "diverted", "flown", "delayed15", "nas_delayed_flights"]:
        x[c] = x[c].fillna(0).astype(int)
    x["period"] = x.year.astype(str) + "-" + x.month.astype(str).str.zfill(2)
    x["ym"] = x.year * 100 + x.month
    x["noncancelled"] = x.flights - x.cancelled
    # congestion: both definitions, per direction (each row already is one direction)
    x["nas_delay_share"] = x.nas_delayed_flights / x.flown.replace(0, np.nan)
    x["nas_min_per_flown"] = x.nas_min / x.flown.replace(0, np.nan)
    x["delayed15_share"] = x.delayed15 / x.flown.replace(0, np.nan)
    x["cancel_rate"] = x.cancelled / x.flights.replace(0, np.nan)
    # coverage vs T-100 passenger-class performed departures/arrivals
    r = t100_routes
    td = r[r.origin_in_scope].groupby(["origin", "year", "month"]).departures.sum().rename("t100_flights").reset_index().rename(columns={"origin": "airport"})
    td["direction"] = "dep"
    ta = r[r.dest_in_scope].groupby(["dest", "year", "month"]).departures.sum().rename("t100_flights").reset_index().rename(columns={"dest": "airport"})
    ta["direction"] = "arr"
    x = x.merge(pd.concat([td, ta]), on=["airport", "year", "month", "direction"], how="left")
    x["coverage_pct"] = 100 * x.noncancelled / x.t100_flights.replace(0, np.nan)
    w = x[(x.ym >= WINDOW[0]) & (x.ym <= WINDOW[1])].groupby(["airport", "direction"]).agg(nc=("noncancelled", "sum"), t=("t100_flights", "sum"))
    w["coverage_window_pct"] = 100 * w.nc / w.t
    w["delay_score_eligible"] = w.coverage_window_pct >= COVERAGE_MIN
    x = x.merge(w[["coverage_window_pct", "delay_score_eligible"]].reset_index(), on=["airport", "direction"], how="left")
    x["in_scoring_window"] = (x.ym >= WINDOW[0]) & (x.ym <= WINDOW[1])
    x["is_partial_year"] = x.year == x.year.max()
    for r_ in w.itertuples():
        if not r_.delay_score_eligible:
            flag("ontime", "delay_stats", "low_coverage_delay_metric_null_for_scoring", "high", int((x.airport.eq(r_.Index[0]) & x.direction.eq(r_.Index[1])).sum()),
                 f"coverage_pct {r_.coverage_window_pct:.1f} % over {WINDOW[0]}-{WINDOW[1]} is below {COVERAGE_MIN:.0f} %; delay metrics are null for scoring (delay_score_eligible=false); descriptive stats kept.",
                 airport=r_.Index[0])
        elif r_.coverage_window_pct < 80:
            flag("ontime", "delay_stats", "moderate_coverage", "warn", int((x.airport.eq(r_.Index[0]) & x.direction.eq(r_.Index[1])).sum()),
                 f"coverage_pct {r_.coverage_window_pct:.1f} % over the scoring window (eligible, below 80 %).", airport=r_.Index[0])
    flag("ontime", "delay_stats", "extreme_delays_kept", "info", extreme,
         "In-scope flown flights with ArrDelay > 600 min: kept in sums/maxima; use medians, p95, shares, or mean_delay_capped600_min.")
    flag("ontime", "delay_stats", "delayed_flight_all_causes_null", "info", allnull, "Delayed flights with all five cause columns null (not imputed; contribute 0 minutes).")
    flag("ontime", "delay_stats", "partial_year", "warn", int(x.is_partial_year.sum()), f"Latest year {int(x.year.max())} is partial; is_partial_year=true.")
    flag("ontime", "delay_stats", "aggregated_not_flight_level", "info", n_in, "Flight-level rows aggregated to airport-month x direction; none are written.")
    return x.drop(columns=["ym", "noncancelled", "nc"], errors="ignore")


# ---------------------------------------------------------------------------------------------------- fares / TAF
def build_fares() -> pd.DataFrame:
    f = pd.read_csv(RAW / "fares" / "average_fares_scope.csv", dtype={"airport_code": str})
    f["airport"] = f.airport_code.str.strip().str.upper()
    bench = f.groupby(["year", "quarter"]).avg_fare_usd.median().rename("benchmark_median_fare_usd")
    benchr = f.groupby(["year", "quarter"]).inflation_adj_fare_usd_base_Q2_2026.median().rename("benchmark_median_fare_real_usd")
    f = f.merge(bench.reset_index(), on=["year", "quarter"]).merge(benchr.reset_index(), on=["year", "quarter"])
    f["fare_vs_benchmark"] = f.avg_fare_usd / f.benchmark_median_fare_usd
    f["period"] = f.year.astype(str) + "Q" + f.quarter.astype(str)
    last = (f.year * 10 + f.quarter).max()
    f["is_provisional"] = (f.year * 10 + f.quarter) == last
    f["in_scoring_window"] = True
    f = f.rename(columns={"avg_fare_usd": "avg_fare_usd", "inflation_adj_fare_usd_base_Q2_2026": "avg_fare_real_usd"})
    f = f[["airport", "year", "quarter", "period", "avg_fare_usd", "avg_fare_real_usd", "benchmark_median_fare_usd",
           "benchmark_median_fare_real_usd", "fare_vs_benchmark", "is_provisional"]].sort_values(["airport", "year", "quarter"])
    flag("fares", "fares", "latest_quarter_provisional", "info", int(f.is_provisional.sum()), "2026Q2 marked is_provisional=true.")
    flag("fares", "fares", "benchmark_is_16_airport_median", "info", len(f),
         "Benchmark = median of the 16 scope airports per quarter (California-heavy, not national).")
    return f


def build_forecast() -> pd.DataFrame:
    en = pd.read_csv(RAW / "taf" / "taf_enplanements_scope.csv", dtype={"locid": str})
    op = pd.read_csv(RAW / "taf" / "taf_operations_scope.csv", dtype={"locid": str})
    for d in (en, op):
        d["locid"] = d["locid"].str.strip().str.upper()
    en["enplanements_total"] = en[["aac", "aat", "commuter", "us_flag", "frgn_flag"]].sum(axis=1)
    en["enplanements_domestic"] = en[["aac", "aat", "commuter"]].sum(axis=1)
    en["enplanements_international"] = en[["us_flag", "frgn_flag"]].sum(axis=1)
    op["ops_commercial"] = op[["itn_Ac", "itn_at"]].sum(axis=1)
    op["ops_total"] = op[["itn_Ac", "itn_at", "itn_ga", "itn_mil", "loc_ga", "loc_mil"]].sum(axis=1)
    m = en.merge(op, on=["locid", "scenario", "ayear"], how="outer")
    m = m.rename(columns={"locid": "airport", "ayear": "fiscal_year", "us_flag": "enpl_intl_us_flag", "frgn_flag": "enpl_intl_foreign_flag",
                          "aac": "enpl_air_carrier", "aat": "enpl_air_taxi", "commuter": "enpl_commuter", "itn_Ac": "ops_itinerant_air_carrier",
                          "itn_at": "ops_itinerant_air_taxi", "itn_ga": "ops_itinerant_ga", "itn_mil": "ops_itinerant_military",
                          "loc_ga": "ops_local_ga", "loc_mil": "ops_local_military"})
    m["scenario_label"] = np.where(m.scenario == 0, "actual", "forecast")
    m["is_forecast"] = m.scenario == 1
    cols = ["airport", "fiscal_year", "scenario_label", "is_forecast", "enplanements_total", "enplanements_domestic", "enplanements_international",
            "enpl_air_carrier", "enpl_air_taxi", "enpl_commuter", "enpl_intl_us_flag", "enpl_intl_foreign_flag", "ops_commercial", "ops_total",
            "ops_itinerant_air_carrier", "ops_itinerant_air_taxi", "ops_itinerant_ga", "ops_itinerant_military", "ops_local_ga", "ops_local_military"]
    m = m[cols].sort_values(["airport", "fiscal_year"])
    flag("taf", "forecast", "enplanements_total_definition", "info", len(m),
         "enplanements_total = aac+aat+commuter+us_flag+frgn_flag (international included); reconciles with T-100.")
    flag("taf", "forecast", "fy2025_is_forecast", "warn", int(((m.fiscal_year == 2025)).sum()),
         "FY2025 already ended but is a forecast in TAF 2025; use T-100 for actuals. TAF is fiscal year (Oct-Sep). Use for growth ratios, not levels.")
    return m


# ---------------------------------------------------------------------------------------------------- growth metrics
def build_metrics(r: pd.DataFrame, last_ym: int) -> pd.DataFrame:
    o = r[r.origin_in_scope].copy()
    o["ym"] = o.year * 100 + o.month

    def win(lo, hi):
        return o[(o.ym >= lo) & (o.ym <= hi)]

    def pax(d):
        return d.groupby("origin").passengers.sum()

    def lf(d):
        e = d[d.lf_eligible]
        g = e.groupby("origin")
        return g.passengers.sum() / g.seats.sum()

    cur, pri = win(*L12), win(*P12)
    fy, base = o[o.year == LATEST_FULL_YEAR], o[o.year == BASE_YEAR]
    m = pd.DataFrame({
        "pax_last12m": pax(cur), "pax_prior12m": pax(pri), "pax_latest_full_year": pax(fy), "pax_2019": pax(base),
        "departures_last12m": cur.groupby("origin").departures.sum(), "seats_last12m": cur.groupby("origin").seats.sum(),
        "load_factor_last12m": lf(cur), "load_factor_prior12m": lf(pri), "load_factor_latest_full_year": lf(fy), "load_factor_2019": lf(base),
    }).reindex(SCOPE)
    m["growth_last12m_vs_prior12m_pct"] = 100 * (m.pax_last12m / m.pax_prior12m - 1)
    m["growth_latest_full_year_vs_2019_pct"] = 100 * (m.pax_latest_full_year / m.pax_2019 - 1)
    m["last12m_window"] = f"{L12[0]}-{L12[1]}"
    m["prior12m_window"] = f"{P12[0]}-{P12[1]}"
    m["latest_full_year"] = LATEST_FULL_YEAR
    m = m.reset_index().rename(columns={"origin": "airport", "index": "airport"})
    return m


# ---------------------------------------------------------------------------------------------------- schema docs
DESC = {
    "airports": ("Airport", "1 row per scope airport (16)", {
        "airport": "IATA code (key)", "icao_ident": "OurAirports ident (join key for runways)", "name": "OurAirports name", "city": "Municipality",
        "state": "US state code", "region_group": "New England / Southern California / Bay Area / Alaska", "is_new_england": "Q1 scope flag",
        "airport_type": "OurAirports type", "scheduled_service": "yes/no", "latitude": "deg", "longitude": "deg", "open_runways": "Runways with closed=0",
        "closed_runways": "Runways with closed=1", "longest_open_runway_ft": "Longest open runway", "taf_hub_size": "FAA hub size code (1-3)",
        "taf_facility_class": "FAA facility class code"}),
    "route_stats": ("RouteStat (monthly)", "year x month x origin x dest x carrier x service_class x is_international; passenger classes F/L only; aircraft type aggregated away; origin or dest in scope", {
        "year": "Calendar year", "month": "1-12", "period": "YYYY-MM", "origin": "IATA", "dest": "IATA", "carrier": "T-100 unique carrier code",
        "carrier_name": "Carrier name", "service_class": "F scheduled, L non-scheduled", "is_international": "DATA_SOURCE IU/IF", "departures": "Departures performed",
        "seats": "Seats available", "passengers": "Passengers", "distance": "Route distance, miles", "distance_valid": "false when distance=0 (same-airport)",
        "lf_eligible": "seats>0 and departures>0: use for load factor", "lf_anomaly": "passengers>seats (kept)", "origin_in_scope": "origin is one of 16",
        "dest_in_scope": "dest is one of 16", "is_partial_year": "latest (incomplete) year", "in_scoring_window": "2019-01..2026-06"}),
    "cargo_route_stats": ("Cargo (monthly)", "As route_stats for service_class G (scheduled all-cargo) and P (non-scheduled all-cargo)", {
        "freight_lbs": "Freight pounds", "mail_lbs": "Mail pounds", "passengers": "~0 (kept for audit)"}),
    "delay_stats": ("DelayStat (monthly per airport)", "airport x year x month x direction (dep = flights leaving, arr = flights arriving); aggregated from 10.2 M flight rows", {
        "airport": "IATA", "month": "1-12", "year": "Calendar year", "direction": "dep or arr", "period": "YYYY-MM", "flights": "All scheduled flights in On-Time file",
        "cancelled": "Cancelled", "diverted": "Diverted", "flown": "Not cancelled and not diverted", "delayed15": "Flown flights delayed 15+ min (DepDel15 for dep, ArrDel15 for arr)",
        "carrier_min": "Carrier-delay minutes (sum, flown; cause fields attach to arrival delay)", "weather_min": "Weather-delay minutes",
        "nas_min": "NAS-delay minutes", "security_min": "Security-delay minutes", "late_aircraft_min": "Late-aircraft minutes",
        "nas_delayed_flights": "Flown flights with NASDelay>0", "median_delay_min": "Median DepDelay (dep) / ArrDelay (arr), flown",
        "p95_delay_min": "95th percentile delay", "mean_delay_capped600_min": "Mean delay capped at 600 min", "median_taxi_min": "Median TaxiOut (dep) / TaxiIn (arr)",
        "max_delay_min": "Max delay (kept, real extreme)", "nas_delay_share": "CONGESTION: nas_delayed_flights / flown", "nas_min_per_flown": "CONGESTION: nas_min / flown",
        "delayed15_share": "delayed15 / flown", "cancel_rate": "cancelled / flights", "t100_flights": "T-100 passenger-class performed flights (denominator)",
        "coverage_pct": "100 x non-cancelled flights / t100_flights (monthly)", "coverage_window_pct": "Same, pooled over the scoring window",
        "delay_score_eligible": "false when coverage_window_pct < 50: delay metrics must be null for scoring", "in_scoring_window": "2019-01..2026-06",
        "is_partial_year": "latest (incomplete) year"}),
    "fares": ("Fare (quarterly)", "airport x year x quarter (480 rows)", {
        "airport": "IATA", "year": "Year", "quarter": "1-4", "period": "YYYYQn", "avg_fare_usd": "Nominal average domestic itinerary fare",
        "avg_fare_real_usd": "Inflation-adjusted, base Q2-2026", "benchmark_median_fare_usd": "Median of 16 airports, same quarter",
        "benchmark_median_fare_real_usd": "Same, real", "fare_vs_benchmark": "avg_fare_usd / benchmark_median_fare_usd", "is_provisional": "latest quarter"}),
    "forecast": ("Forecast (annual)", "airport x TAF fiscal year (Oct-Sep), actual to FY2024, forecast FY2025-FY2055", {
        "airport": "IATA", "fiscal_year": "FAA fiscal year", "scenario_label": "actual / forecast", "is_forecast": "true for FY2025+",
        "enplanements_total": "aac+aat+commuter+us_flag+frgn_flag", "enplanements_domestic": "aac+aat+commuter", "enplanements_international": "us_flag+frgn_flag",
        "enpl_air_carrier": "aac", "enpl_air_taxi": "aat", "enpl_commuter": "commuter", "enpl_intl_us_flag": "us_flag", "enpl_intl_foreign_flag": "frgn_flag",
        "ops_commercial": "itinerant air carrier + air taxi (use for congestion)", "ops_total": "all itinerant + local operations (GA-dominated)",
        "ops_itinerant_air_carrier": "itn_Ac", "ops_itinerant_air_taxi": "itn_at", "ops_itinerant_ga": "itn_ga", "ops_itinerant_military": "itn_mil",
        "ops_local_ga": "loc_ga", "ops_local_military": "loc_mil"}),
    "airport_metrics": ("Growth and load-factor metrics (derived, per airport)", "1 row per scope airport; both growth definitions stored, scoring config picks", {
        "airport": "IATA", "pax_last12m": "Enplaned pax 2025-07..2026-06 (origin basis, F+L)", "pax_prior12m": "Enplaned pax 2024-07..2025-06",
        "pax_latest_full_year": "Enplaned pax 2025", "pax_2019": "Enplaned pax 2019", "departures_last12m": "Departures last 12 m", "seats_last12m": "Seats last 12 m",
        "load_factor_last12m": "sum(pax)/sum(seats) over lf_eligible rows, 2025-07..2026-06", "load_factor_prior12m": "Same, 2024-07..2025-06",
        "load_factor_latest_full_year": "Same, 2025", "load_factor_2019": "Same, 2019",
        "growth_last12m_vs_prior12m_pct": "(a) last 12m vs prior 12m, ending 2026-06", "growth_latest_full_year_vs_2019_pct": "(b) 2025 vs 2019",
        "last12m_window": "text", "prior12m_window": "text", "latest_full_year": "2025"}),
    "data_quality_flags": ("data_quality_flags", "1 row per flag (source, table, optional airport/period)", {
        "source": "ourairports/t100/ontime/fares/taf", "table": "Output table the flag applies to", "airport": "IATA or empty", "period": "Period or empty",
        "flag": "Flag code", "severity": "info / warn / high", "rows_affected": "Count", "detail": "Explanation"}),
}


def friendly(dt) -> str:
    s = str(dt)
    if s.startswith("int"):
        return "integer"
    if s.startswith("float"):
        return "decimal"
    if s == "bool":
        return "boolean"
    return "string"


def schema_md(tables: dict[str, pd.DataFrame]) -> str:
    out = ["\n## 10. Clean data schema (`data/clean/`)\n",
           "Generated by `etl/clean/run_clean.py`. Raw files are untouched. CSV, UTF-8, header row, booleans as `True`/`False`, empty = null. "
           "Scoring window = 2019-01 to 2026-06.\n",
           "### 10.1 Files, rows and grain\n", "| File | Entity | Rows | Grain |", "|---|---|---|---|"]
    for name, df in tables.items():
        ent, grain, _ = DESC[name]
        out.append(f"| `{name}.csv` | {ent} | {len(df):,} | {grain} |")
    for name, df in tables.items():
        ent, grain, d = DESC[name]
        out.append(f"\n### 10.{list(tables).index(name) + 2} `{name}.csv` - {ent}\n\nGrain: {grain}.\n")
        out.append("| Column | Type | Nulls | Description |\n|---|---|---|---|")
        for c in df.columns:
            out.append(f"| `{c}` | {friendly(df[c].dtype)} | {int(df[c].isna().sum()):,} | {d.get(c, '')} |")
    out.append("\n**Congestion metric:** `nas_delay_share` and `nas_min_per_flown` in `delay_stats.csv`, for `direction` = `dep` and `arr`. "
               "Rows with `delay_score_eligible=false` must be treated as null for scoring.\n")
    out.append("**Long-haul:** query `route_stats.csv` (passenger) and `cargo_route_stats.csv` with any `distance` cutoff; filter `distance_valid` and weight by `departures`.\n")
    out.append("**Not in clean data:** NAS live status (snapshot only, parsed at request time) and flight-level On-Time rows.\n")
    return "\n".join(out)


def inject(fragment: str) -> None:
    txt = DOC.read_text(encoding="utf8")
    txt = re.split(r"\n## 10\. Clean data schema", txt)[0].rstrip() + "\n"
    DOC.write_text(txt + fragment + "\n", encoding="utf8")


# ---------------------------------------------------------------------------------------------------- main
def main() -> None:
    CLEAN.mkdir(parents=True, exist_ok=True)
    print("airports ...", flush=True)
    airports = build_airports()
    print("t100 ...", flush=True)
    routes, cargo, last_ym, _ = build_t100()
    print("on-time (aggregating) ...", flush=True)
    delay = build_delay(routes)
    print("fares/taf/metrics ...", flush=True)
    fares = build_fares()
    fc = build_forecast()
    metrics = build_metrics(routes, last_ym)
    dq = pd.DataFrame(flags)
    tables = {"airports": airports, "route_stats": routes, "cargo_route_stats": cargo, "delay_stats": delay, "fares": fares,
              "forecast": fc, "airport_metrics": metrics, "data_quality_flags": dq}
    delay_cols = [c for c in DESC["delay_stats"][2]]
    tables["delay_stats"] = delay[[c for c in delay_cols if c in delay.columns]]
    # sort for determinism
    tables["route_stats"] = routes.sort_values(["year", "month", "origin", "dest", "carrier", "service_class"]).reset_index(drop=True)
    tables["cargo_route_stats"] = cargo.sort_values(["year", "month", "origin", "dest", "carrier", "service_class"]).reset_index(drop=True)
    tables["delay_stats"] = tables["delay_stats"].sort_values(["airport", "direction", "year", "month"]).reset_index(drop=True)
    for name, df in tables.items():
        df.to_csv(CLEAN / f"{name}.csv", index=False, encoding="utf8")
    inject(schema_md(tables))
    print("\n=== row counts ===")
    for name, df in tables.items():
        print(f"{name+'.csv':26s} {len(df):>10,} rows  {df.shape[1]:>3} cols  {(CLEAN / (name + '.csv')).stat().st_size / 1e6:6.1f} MB")

    # ---- sanity checks (read back from the written files)
    r = pd.read_csv(CLEAN / "route_stats.csv")
    f = pd.read_csv(CLEAN / "forecast.csv")
    d = pd.read_csv(CLEAN / "delay_stats.csv")
    print("\n=== sanity 1: SFO 2019 passengers, route_stats vs TAF ===")
    sfo = r[(r.origin == "SFO") & (r.year == 2019)].passengers.sum()
    taf = f[(f.airport == "SFO") & (f.fiscal_year == 2019)].iloc[0]
    print(f"T-100 enplaned (calendar 2019): {sfo:,.0f}\nTAF FY2019 total: {taf.enplanements_total:,.0f}  (domestic only {taf.enplanements_domestic:,.0f})\n"
          f"ratio T-100/TAF total = {sfo / taf.enplanements_total:.3f}; vs domestic-only = {sfo / taf.enplanements_domestic:.3f}")
    print("\n=== sanity 2: ANC passenger long-haul share of departures (F+L, distance_valid) ===")
    a = r[(r.origin == "ANC") & r.distance_valid & (r.departures > 0)]
    for yr_label, dd in (("all years 2019-2026", a), ("2025", a[a.year == 2025])):
        print(yr_label + ": " + ", ".join(f">={c} mi: {100 * dd[dd.distance >= c].departures.sum() / dd.departures.sum():.1f} %" for c in (1500, 2500, 3000)))
    c = pd.read_csv(CLEAN / "cargo_route_stats.csv")
    ca = c[(c.origin == "ANC") & c.distance_valid & (c.departures > 0)]
    allc = pd.concat([a[["departures", "distance"]], ca[["departures", "distance"]]])
    print("incl. freight (all years): " + ", ".join(f">={k} mi: {100 * allc[allc.distance >= k].departures.sum() / allc.departures.sum():.1f} %" for k in (1500, 2500, 3000)))
    print("\n=== sanity 3: LAX vs SNA congestion (NAS-delay), 2025 and scoring window ===")
    for lab, dd in (("2025", d[d.year == 2025]), ("window 2019-01..2026-06", d[d.in_scoring_window])):
        g = dd[dd.airport.isin(["LAX", "SNA"])].groupby(["airport", "direction"]).agg(flown=("flown", "sum"), nas=("nas_delayed_flights", "sum"), mins=("nas_min", "sum"),
                                                                                    cov=("coverage_window_pct", "first"), elig=("delay_score_eligible", "first"))
        g["nas_delay_share_%"] = 100 * g.nas / g.flown
        g["nas_min_per_flown"] = g.mins / g.flown
        print(f"-- {lab}\n{g[['flown', 'nas_delay_share_%', 'nas_min_per_flown', 'cov', 'elig']].round(2).to_string()}")
    el = d.groupby(["airport", "direction"]).delay_score_eligible.first().unstack()
    low = d.groupby(["airport", "direction"]).coverage_window_pct.first()
    print("\nairports with delay_score_eligible=false:", [f"{i[0]}/{i[1]} ({v:.1f} %)" for i, v in low.items() if v < COVERAGE_MIN] or "none")


if __name__ == "__main__":
    main()
