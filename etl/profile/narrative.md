=== cov_ourairports ===
<<cov_ourairports>>
=== cov_t100 ===
<<cov_t100>>
=== cov_ontime ===
<<cov_ontime>>
=== cov_fares ===
<<cov_fares>>
=== cov_taf ===
<<cov_taf>>
=== cov_nas ===
<<cov_nas>>

=== issue_ourairports ===
Runway rows include closed runways (<<oa_closed_rows>> rows: <<oa_closed_airports>>); must filter `closed=1`. No gates/terminal data at all.
=== issue_t100 ===
Freight and passenger mixed (<<t_rows_cargo_pct>> of rows are CLASS G/P); 2026 partial; <<t_key_extra>> natural-key collisions (not exact duplicates); `DEPARTURES_SCHEDULED`=0 on <<t_sched0_pct>> of flown passenger rows.
=== issue_ontime ===
Only 18 reporting carriers: covers roughly half of ANC (43-59 % by year) and a quarter of FAI (19-33 %) passenger departures, 75-80 % at BOS/LAX/SFO. Extreme delays up to 3,240 min.
=== issue_fares ===
No national benchmark and no carrier/route split; small-airport quarters are noisy (10 % sample). No missing quarters.
=== issue_taf ===
`docs/data-sources.md` defines total enplanements wrongly: international (`us_flag`+`frgn_flag`) is separate and adds up to 40 % at gateways. FY2025 is still a forecast.
=== issue_nas ===
Live snapshot only, no history; "closure" entries are mostly NOTAM curfews / GA restrictions, and XML dates carry no year.

=== summary_notes ===
**Headline findings (details below):**
1. **Coverage is complete.** All 16 airports are in every historical source and there are **no missing months/quarters** (T-100, On-Time, Fares) and no missing fiscal years (TAF).
2. **One documentation error that matters:** the TAF "total enplanements" in `docs/data-sources.md` omits international traffic. With the 5-column total, TAF reconciles with T-100 to within a few percent; with the 3-column total it understates LAX/SFO/BOS by 17-31 %.
3. **On-Time is a biased sample for ANC and FAI** (and moderately for BOS/LAX/SFO): congestion/delay scores there describe only the 18 large reporting carriers.
4. **T-100 "duplicates" are not duplicates:** <<t_key_extra>> key collisions carry different measures (mostly Kalitta cargo and United), so they should be summed, not dropped.
5. **`DEPARTURES_SCHEDULED` is unusable** as a cancellation/capacity proxy (zero on <<t_sched0_pct>> of flown passenger rows; performed exceeds scheduled at SFO).
6. **The 2026 year is partial** in every monthly source (T-100 through July, On-Time through August, Fares through Q2). Annual totals must not mix 2026 with full years.

=== surprising_ourairports ===
- Clean and complete; the only trap is the join key (`ident` such as `KBOS`, not IATA) and `closed=1` runways.
- OAK is named "Oakland San Francisco Bay Airport" (display name differs from TAF/fares: "Oakland International"). Join on code, never on name.
- Runway length cannot be used as a capacity proxy for SNA vs LAX in any simple way (SNA longest runway 5,700 ft vs LAX 12,894 ft), but it is a structural constraint worth mentioning in the answer.

=== surprising_t100 ===
| Flag | Classification | Reasoning |
|---|---|---|
| Max/p95 > 10x on DEPARTURES, PAYLOAD, FREIGHT, MAIL, RAMP_TO_RAMP, AIR_TIME | **REAL EXTREME** | Rows are carrier x route x aircraft x month aggregates; cargo hubs (ANC, ONT, OAK, LAX) and big carriers legitimately dwarf the median thin route. Not an error. |
| April 2020 LF 0.14-0.25 at SFO/LAX/ANC; passengers -70 % | **REAL EXTREME** | COVID. Keep, but exclude 2020-21 from "normal" baselines. |
| Passengers > seats (<<t_pax_gt_seats>> rows in scope, <<t_pax_gt_seats_pax>> pax; worst LF 4.0 on a 3-seat air-taxi FAI-TKJ) | **likely DATA ERROR** (immaterial) | Tiny commuter aircraft (types 194/406/639) with 1-6 seats; LF>1 is impossible. Only <<t_pax_gt_105>> rows exceed 1.05. Flag, do not distort aggregates. |
| seats = 0 and passengers > 0 | **likely DATA ERROR** | 178 rows in the whole file (354 pax), **<<t_seats0_pax>> in passenger-class scope rows**. Immaterial. |
| Departures_performed = 0, all measures 0 | **LIKELY ARTEFACT** | <<t_zero_perf>> scope passenger-class rows are schedule-only placeholders (no seats, no pax). Harmless for sums, harmful for row-level averages. |
| Distance = 0 (<<t_dist0>> rows, <<t_dist0_same>> with ORIGIN=DEST) | **REAL** but unusable for distance | All of them have ORIGIN=DEST: local/sightseeing or positioning flights (ANC-ANC, FAI-FAI, LAX-LAX). Must be excluded from long-haul calculations. |
| 333 route pairs with more than one DISTANCE value; 50 rows where DISTANCE_GROUP differs from ceil(DISTANCE/500) | **likely DATA ERROR** (minor) | Distance should be constant per pair; probably airport-code reuse/changes over time. Immaterial to shares. |
| Natural-key collisions (<<t_key_extra>> extra rows) | **LIKELY ARTEFACT** | Different measure values for same key, so they are separate partial records. Passenger-class collisions carry <<t_key_rows_pax_total>> passengers; dropping them would lose real traffic. |
| `DEPARTURES_SCHEDULED` = 0 while performed > 0 on <<t_sched0_pct>> of flown passenger rows; performed > scheduled | **LIKELY ARTEFACT** | Scheduled is only reported for some carriers/filing types. Not usable. |

Other surprises:
- ANC: cargo (G+P) is **<<anc_cargo_dep_pct>> of all ANC departures**. Passenger-class ANC traffic is dominated by Alaska Airlines and small Alaska bush carriers (Grant, New Pacific, Kenai, Iliamna), and 51 % of passenger departures are under 500 miles.
- ANC passengers > 0 on 165 cargo-class rows (1,270 pax): `CLASS` is the reliable filter.
- The latest month (2026-07) is complete in row count (7,804 rows vs 8,317 a year earlier) but passenger counts are 1-13 % below July 2025 at 13 of 16 airports (OAK -13 %, LGB -13 %, MHT -11 %); treat as real softness, not missing data, but confirm with later revisions (BTS can restate recent months).
- OAK and SJC are structurally down: Jan-Jul 2026 enplanements are -42 % and -38 % vs Jan-Jul 2019; ONT is +30 %.

=== surprising_ontime ===
| Flag | Classification | Reasoning |
|---|---|---|
| ArrDelay/DepDelay up to 3,240 min (54 h); <<o_gt600>> in-scope flights above 600 min, <<o_gt1440>> above 1,440 min | **REAL EXTREME** (mean-distorting) | The top rows are American Airlines flights where CarrierDelay equals ArrDelay (aircraft out of service overnight/multi-day). BTS measures delay against the original schedule. Real, but they inflate means; use medians, p95 and share of flights delayed 15+ min. |
| 2020 mean arrival delay -7.9 min, median -13 | **REAL EXTREME** | COVID-emptied schedules. |
| April 2020 cancellation 38-54 % at all airports | **REAL EXTREME** | COVID. |
| TaxiIn max 380 min (<<o_taxiin_gt120>> flights above 120 min); TaxiOut above 180 min (<<o_taxiout_gt180>>) | **likely REAL, some DATA ERROR** | Extended tarmac/gate waits and diversions are real but values above 3 h are suspicious; they affect only means. |
| Delay-cause columns null on 81.2 % of rows (<<o_cause_null_rows>>) | **LIKELY ARTEFACT (by design)** | Populated only for ArrDel15=1. Among delayed flights, null = 0.00 % for every cause, every year, every scope airport. Exactly one delayed flight has all five causes null. |
| Cancelled flights with a non-null DepTime (<<o_cancel_with_deptime>>) | **LIKELY ARTEFACT** | Cancelled after pushback/return to gate. Keep as cancelled. |
| <<o_sum_mismatch>> delayed flights where the cause minutes do not sum to ArrDelay (tolerance 1 min) | **likely DATA ERROR** (immaterial) | Out of 1.9 M delayed flights. |

Other surprises:
- **No duplicates, no missing months, no missing days** for any airport (every airport has a departure on all 365/366 days of every year).
- **Coverage vs T-100 (On-Time departures as % of T-100 passenger-class departures, 2024): ANC 43 %, FAI 21 %, BOS 76 %, LAX 75 %, SFO 77 %, SNA 90 %, LGB 100 %.** Missing carriers: bush carriers at ANC/FAI (Grant, Kenai, New Pacific, Wright, Everts, Warbelow), Cape Air/Porter at BOS, foreign airlines at LAX/SFO (Air Canada, Volaris, EVA), Breeze/Avelo/JSX on the low-cost side. On-Time also counts cancelled flights while T-100 counts performed ones, so true coverage of flown flights is slightly lower than the ratios.
- BTV coverage falls to 62-68 % in 2025-26 (Breeze, GoJet and Air Wisconsin are not reporting carriers) while BTV departures in On-Time drop 19 % in 2025: carrier mix, not demand.
- Scope membership: 8.4 % of rows have both ends in scope (LAX-SFO etc.). Each flight appears once, so count departures by `Origin` and arrivals by `Dest`.
- The cause columns are attached to the flight's arrival, so "NAS delay at LAX" is delay on flights that arrived delayed with an NAS cause, wherever it arose.

=== surprising_fares ===
| Flag | Classification | Reasoning |
|---|---|---|
| 2020Q2-2021Q1 fares 30-40 % below own median (MHT 0.61, LGB 0.63, LAX 0.63) | **REAL EXTREME** | COVID fare and mix collapse. |
| QoQ swings of 15-48 % (FAI 2021Q4 +48 %, ANC 2019Q4 +19 %) | **real but noisy** | Alaska airports have small 10 % samples and a strong seasonal mix; ANC and FAI jump in most Q4s (2019, 2020, 2021, 2024). |
| 2026Q2 BUR 1.37x, LGB 1.37x, OAK 1.31x own median | **plausibly real** | Latest fares are at the top of the distribution everywhere (2026Q2 cross-airport median is the highest in the series, 449.8). Keep, but treat the last quarter as provisional. |

Other surprises:
- **There is no national average in the file.** "Fare vs national" cannot be computed from this source alone; the only available benchmark is the 16-airport median (not national, and 8 of 16 are California). A decision is needed (see plan).
- The inflation-adjusted column is a constant factor per quarter (1.000 in 2026Q2, 1.32 in 2019Q1). On the 16-airport mean, nominal fares rose about 34 % from 2019Q1 (342) to 2026Q2 (457) while the inflation-adjusted series is flat (452 to 457): the 'growth' in fares is inflation.
- `pax_2025_10pct_sample` is a single 2025 value repeated over all quarters; do not use it as a time series.
- Latest-4-quarter fare relative to the 16-airport median: SFO <<f_rel_sfo>>, ANC <<f_rel_anc>>, BTV <<f_rel_btv>>, BUR <<f_rel_bur>>.

=== surprising_taf ===
- **Definition error in `docs/data-sources.md`:** total enplanements = `aac+aat+commuter` excludes international. International (`us_flag`+`frgn_flag`) is 28-31 % of LAX, 25-29 % of SFO, 17-20 % of BOS in 2019-2025 (and will be 40 % at LAX by 2055). The 5-column sum matches T-100 (BOS 2019: 20.56 M vs 20.74 M; LAX 42.8 M vs 43.4 M).
- **`locid` whitespace:** the scoped CSVs are already trimmed (0 padded IDs); only `APORT_NAME` is space-padded. The warning in the docs applies to the original xlsx, not to these files.
- **FY2025 is still a forecast** in this release, although FY2025 has ended (T-100 has the actual): TAF forecasts OAK 4.69 M and SFO 26.1 M for FY2025, while T-100 shows 4.56 M and 26.5 M for calendar 2025 (within 3 %). Actuals end at FY2024.
- Forecast growth is not absurd (5-column totals): 2024-2055 CAGR is 1.0-2.6 % everywhere (MHT 1.0 %, SFO 2.6 %, BOS 2.2 %, LAX 2.2 %). Near-term CAGR 2024-2030 is 3.4-4.1 % at MHT, PVD, BTV and SFO (recovery rather than growth) and negative only for LGB (-0.8 %) and OAK (-0.8 %). One-year jumps: OAK FY2025 -14.0 % (real; T-100 shows -14.7 % for calendar 2025), PVD +11.1 %, BTV +10.2 %, PWM +7.6 % (plausible recovery). No flag exceeded the thresholds (long-run CAGR above 4 % or below -0.5 %, or a one-year move above 15 %).
- 2024 actuals are still below 2019 at 8 of 16 airports: MHT -26 %, SJC -23 %, OAK -17 %, LAX -12 %, SFO -10 %, BTV -5 %, PVD -4 %, BDL -3 %; ONT +30 %, LGB +18 %, BUR +15 %. A "growth vs 2019" score and a "forecast growth" score therefore mostly measure recovery, not underlying growth.
- **Operations totals are dominated by general aviation:** BTV total ops +30 % from 2019 to 2024 (73,529 to 95,875) while commercial ops fell 14 %; LGB total ops +33 %. Use `itn_Ac + itn_at` (commercial) for congestion, not the total.

=== surprising_nas ===
- Two-airport hit rate for our scope: SNA and LAX. Neither is a service disruption: SNA's entry is a recurring night curfew NOTAM (`AP CLSD DLY 0730-1415` UTC = about 23:30-06:15 local); LAX's is a GA-only restriction. The XML window strings ("May 27 ... May 28") carry no year; the LAX NOTAM id `2605271826-2705281600` shows it actually runs May 2026 to May 2027.
- JSON (5 airports) and XML (4 airport entries over 2 Delay_type blocks) do not list the same airports (ABQ only in JSON, SAN/LAS/LAX/SNA in both). Do not assume either is complete.
- The snapshot has zero ground stops, ground delays or arrival/departure delays anywhere, so the schemas of those event types are unobserved.

=== surprising_cross ===
- **T-100 vs TAF reconciles only with the 5-column TAF total**, and TAF is a fiscal year (Oct-Sep), T-100 a calendar year. Use T-100 for actuals through 2026-07 and TAF only for forward growth ratios (for example FY2030/FY2025), not for level comparisons.
- **On-Time and T-100 agree on direction but not on scale** (see coverage table): any per-flight metric from On-Time at ANC/FAI describes a minority of the traffic.
- The fares passenger sample ranks airports consistently with T-100 for the top (LAX, BOS, SFO) but is itinerary-based.
- Airports appear in the same code format in all sources: no case or whitespace issues were found in any scoped extract.

=== risks ===
### Q1. Which New England airports are strong expansion candidates?
**Uses:** T-100 (load factor, seats, enplanements 2019 vs latest), TAF (forward growth), On-Time (delay, cancel, taxi-out), Fares (pricing), OurAirports (runways) for BOS, BDL, PVD, MHT, PWM, BTV.

| What could go wrong | Impact |
|---|---|
| No capacity data (gates, terminal sqft) anywhere, so "strong candidate" is a demand-pressure proxy | High: must be stated in the answer |
| Growth vs 2019 mixes recovery and growth: MHT is -26 % vs 2019 but TAF forecasts +22 % by 2030; PWM is +9 % and BOS about 0 % | High: normalise growth to 2023-2025 run-rate, not only to 2019 |
| 2026 partial: using full-year 2025 vs Jan-Jul 2026 totals would show a fake ~40 % drop | High unless same-window comparisons are used |
| On-Time coverage falls at BTV (62-68 % since 2025), PVD, MHT (70-76 %) because Breeze/Avelo/GoJet are not reporting carriers: delay metrics drift with carrier mix | Medium |
| Fare "pricing power" has no national benchmark; BTV looks high (<<f_rel_btv>> of the 16-airport median) partly because of thin competition and small 10 % samples | Medium |
| BOS foreign traffic (about 20 % international) is in T-100 but only partly in On-Time | Low-medium |

### Q2. LAX vs SNA congestion
**Uses:** On-Time (DepDelay, ArrDelay, ArrDel15 share, TaxiOut, cancellations, NASDelay), T-100 departures, TAF commercial operations, NAS live status, OurAirports runways.

| What could go wrong | Impact |
|---|---|
| Delay causes are attached to a flight's arrival, not the airport that caused it, so "NAS delay at LAX origin" is not LAX-caused. Prefer departure-side measures (DepDelay, TaxiOut) plus arrival delay of flights *into* each airport | High |
| On-Time covers about 75 % of LAX and 90 % of SNA passenger departures; LAX's missing 25 % is mostly foreign carriers, so LAX is under-sampled on its most complex flights | Medium |
| Scale difference: LAX about 190 k flights/yr vs SNA about 45 k with a 5,700 ft runway and a curfew/noise-cap regime. Delay rates may be similar while physical congestion is not | High: report rates and volumes, and flights per runway |
| Extreme delays (up to 54 h) distort means; the mean of NASDelay uses only delayed flights | Medium |
| NAS live snapshot is one moment and shows nothing on delays; SNA's "closure" is a nightly curfew, not an outage | Low |
| 2020-21 are not representative; 2026 partial through August | Medium |

### Q3. % of long-haul flights out of ANC
**Uses:** T-100 only (`DISTANCE`, `DEPARTURES_PERFORMED`, `CLASS`, `DATA_SOURCE`).

| What could go wrong | Impact |
|---|---|
| **The answer depends on the definition.** Passenger-class share of ANC departures at >= 1,000 mi is <<anc_lh1000>>, >= 1,500 mi <<anc_lh1500>>, >= 2,000 mi <<anc_lh2000>>, >= 2,500 mi <<anc_lh2500>>. ANC-SEA is 1,448 mi and is <<anc_sea_pct>> of passenger departures, so a 1,500 mi cut-off sits right on top of the biggest route | **Critical**: pick and state the threshold up front |
| Cargo: <<anc_cargo_dep_pct>> of ANC departures are G/P freighters. Including them gives >= 1,500 mi share <<anc_lh1500_all>> of all departures, versus <<anc_lh1500>> for passenger flights; the user's wording "flights" is ambiguous | **Critical** |
| Rows are carrier-route-aircraft-month aggregates: must weight by `DEPARTURES_PERFORMED`, never count rows | High |
| Same-airport rows (ANC-ANC, 786 rows) have distance 0; they count as short-haul flights unless excluded | Medium |
| On-Time cannot be used (covers 43-59 % of ANC passenger departures depending on year, no freight) | Info |
| 2026 partial: compute per full year (2019-2025) and report 2025 as latest | Low |

### Q4. Unmet demand at SFO, and why
**Uses:** T-100 (seats, passengers, load factor, departures), On-Time (delay, cancellations), Fares (SFO vs peers), TAF (forecast), plus OAK/SJC T-100 for Bay Area context.

| What could go wrong | Impact |
|---|---|
| True unmet demand needs O&D/booking data (not in scope); load factor 0.82 (2025) vs 0.82 (2019) with monthly peaks of <<lf_sfo_peak>> is only a proxy: high LF can mean efficient capacity, not unmet demand | **Critical**: must be framed as an inference |
| "Why" is not in the data: no slot, gate or airline-strategy information. Hypotheses from the data: SFO traffic is still about 5 % below 2019 in 2025 while OAK (-33 %) and SJC (-32 %) are far lower, so capacity moved or was cut; this is correlation | High |
| `DEPARTURES_SCHEDULED` cannot be used to show cancelled capacity (performed exceeds scheduled at SFO: 1.12x in 2025) | High |
| Seats are available seats: they include non-revenue and lag airline schedule changes; passengers exclude non-revenue | Low |
| On-Time covers about 77 % of SFO passenger departures (missing mostly foreign airlines) | Medium |
| Fare "pressure" needs a benchmark: SFO fares are <<f_rel_sfo>> of the 16-airport median, a California-heavy set | Medium |
| TAF vs T-100 level differences if mixed (fiscal vs calendar year, definition issue above) | Medium |

=== plan ===
Each rule says what it does, why, and the expected row impact **computed from the data** (counts are rows removed/changed/flagged; nothing is deleted from `data/raw/`). Please approve, change or reject each one.

| # | Source | Rule | Expected row impact | Why |
|---|---|---|---|---|
| 1 | All | Normalise airport codes with `strip().upper()`; join on IATA (TAF `locid`, fares `airport_code`, T-100/On-Time `ORIGIN`/`DEST`); OurAirports joins via `ident` | 0 rows (no problems found) | Cheap safeguard if files are re-extracted |
| 2 | T-100 | Passenger table: keep `CLASS` in (F, L) only. Cargo table: keep G, P separately for the ANC freight context | Passenger: **<<t_rows_pax>>** rows kept; **<<t_rows_cargo>>** G/P rows moved to the cargo table (<<t_rows_cargo_pct>> of <<t_rows>>) | Freight must not enter load factor/long-haul passenger shares |
| 3 | T-100 | Sum the <<t_key_extra>> natural-key collisions into one row per (year, month, carrier, origin, dest, aircraft type, config, class) | -<<t_key_extra>> rows total, of which -<<t_key_extra_pax>> are passenger-class; passenger totals unchanged | They are separate partial records, not duplicates |
| 4 | T-100 | For load factor only: use rows with `SEATS>0` and `DEPARTURES_PERFORMED>0`; for passenger counts keep every F/L row | LF excludes <<t_lf_excluded>> of <<t_o_pax_rows>> scope-origin passenger rows (all zero-seat or schedule-only placeholders; <<t_zero_perf>> rows are all-zero) | Schedule-only rows add nothing and distort row-level averages |
| 5 | T-100 | Rows with passengers > seats: keep, add `lf_anomaly` flag; compute airport LF as sum(pax)/sum(seats) (never average row LFs) | <<t_pax_gt_seats>> rows flagged (<<t_pax_gt_seats_pax>> pax; <<t_pax_gt_105>> above 1.05); 0 removed | Tiny air-taxi aircraft; immaterial at aggregate level |
| 6 | T-100 | Exclude `DISTANCE=0` rows from all distance/long-haul metrics; keep them in passenger totals | <<t_dist0>> rows (<<t_dist0_pax>> passenger-class, <<t_dist0_pax_total>> pax) | Same-airport local flights |
| 7 | T-100 | Airport traffic is defined on `ORIGIN` basis (enplaned); departures from `ORIGIN`; no sum of origin and destination sides. Both-in-scope rows (<<t_both>>, <<t_both_pct>>) are kept once and counted only for their origin airport | 0 rows removed; avoids double counting <<t_both_pax>> passengers | Prevents LAX-SFO type double counting |
| 8 | T-100 / On-Time / Fares | Partial 2026: keep, add `is_partial_year`; annual metrics use 2019-2025 only; latest-state metrics use the last full 12 months or same-window YTD comparisons (Jan-Jul) | T-100 <<t_2026_rows>> rows and On-Time 2026 rows flagged, 0 removed | Avoid fake 2026 drops |
| 9 | T-100 / On-Time | Common analysis window for scoring: 2019-01 to 2026-06 (where fares exist); months after that kept for "latest" views only. On-Time rows after T-100's last month (<<o_t100_last>>): <<o_rows_after_t100>> | 0 removed, flagged | Align sources |
| 10 | T-100 | Do not use `DEPARTURES_SCHEDULED` for anything; cancelled capacity comes from On-Time only | 0 rows; column ignored | Zero on <<t_sched0_pct>> of flown passenger rows |
| 11 | On-Time | Keep all rows (no duplicates). Delay statistics use flown flights (`Cancelled=0` and `Diverted=0`); cancelled and diverted are kept for rate metrics | Cancelled **<<o_cancelled>>**, diverted **<<o_diverted>>** excluded from delay stats only; **<<o_flown>>** flown rows used | Delay is undefined for cancelled/diverted |
| 12 | On-Time | Delay-cause columns: do not impute; analyse only `ArrDel15=1` rows; leave nulls elsewhere. Drop the single delayed flight with all five causes null from cause analyses | <<o_cause_null_rows>> null cells are by design (81 %); **<<o_cause_all_null_delayed>>** row excluded from cause analyses | Cause is only reported for delayed arrivals |
| 13 | On-Time | Extreme delays: keep; headline metrics are median, p95 and % delayed 15+ min. Any mean is also reported with arrival delay capped at 600 min | <<o_gt600>> in-scope flights (>600 min) affected by the capped mean; 0 removed | Real events, but they distort means |
| 14 | On-Time | ANC and FAI: mark delay/congestion metrics `low_coverage` (roughly 43-59 % and 19-33 % of passenger departures); decision needed whether they enter the congestion score, are given a neutral value, or are reported as "n/a" | 0 rows; scoring decision | Reporting-carrier sample is not representative |
| 15 | On-Time | LAX/SFO/BOS (about 75-80 % coverage): keep, add a `coverage_pct` field per airport-year from T-100 | 0 rows; 1 field | Transparency |
| 16 | Fares | Keep all 480 rows; use nominal for current pricing-power comparison and inflation-adjusted for trends; compute "vs benchmark" from the latest 4 quarters (2025Q3-2026Q2) to dampen seasonality and small samples; treat 2026Q2 as provisional | 0 removed | Smooths ANC/FAI noise |
| 17 | Fares | **Decision needed:** national benchmark. Options: (a) median of the 16 airports (available now, biased to California), (b) add an external national average fare series (new source) | 0 rows; adds a source if (b) | File has no national figure |
| 18 | TAF | Total enplanements = `aac+aat+commuter+us_flag+frgn_flag`; correct `docs/data-sources.md` (server/client/shared/prisma untouched). Keep the scenario flag (0 actual, 1 forecast) | 0 rows; documentation fix | Reconciles with T-100 |
| 19 | TAF | Use TAF for forward growth only (ratios such as FY2030 / FY2025), not for levels; use T-100 for actuals including 2025 and YTD 2026. Commercial ops = `itn_Ac+itn_at` | 0 rows | Fiscal vs calendar year; FY2025 is a forecast; GA noise |
| 20 | TAF / all | Strip whitespace from `APORT_NAME` and use OurAirports names (or a fixed lookup of 16 display names) for display | 16 rows | Padded names; OAK name mismatch |
| 21 | OurAirports | Count runways with `closed=0`; longest open runway; keep `type` and `scheduled_service` | <<oa_closed_rows>> runway rows excluded (<<oa_closed_airports>>); 50 -> 46 | Closed runways |
| 22 | NAS | Parse JSON (ISO times) as the primary source; XML as fallback; parse the NOTAM text to separate curfews/GA restrictions from true closures; cache snapshots with a timestamp | 0 rows; NAS is live only | No history |
| 23 | All | Outputs: write only to `data/clean/` (parquet or csv), one table per source plus a `data_quality_flags` table; never edit `data/raw/` | n/a | Keeps raw read-only |

**Decisions I need from you:**
1. **Long-haul definition for ANC** (rule 2/6 feed it): which distance cut-off (1,000 / 1,500 / 2,000 / 2,500 mi) and whether to count freight? The answer ranges from <<anc_lh2500>> to <<anc_lh1000>> on the passenger-only basis alone.
2. **ANC/FAI in the congestion component** (rule 14): include with a low-confidence flag, neutral score, or exclude?
3. **Fare benchmark** (rule 17): use the 16-airport median, or add an external national series?
4. **Growth baseline** (rules 8, 19): growth vs 2019, vs 2023-2025 run-rate, or both?
5. **Approve correcting `docs/data-sources.md`** for the TAF total definition (rule 18)?
