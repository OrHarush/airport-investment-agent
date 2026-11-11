# Data sources – verification report

Verified 2026-11-10. Scope: BOS BDL PVD MHT PWM BTV LAX SNA BUR LGB ONT ANC FAI SFO OAK SJC, 2019 → latest month.
All raw files are in `data/raw/<source>/` (about 340 MB total, mostly On-Time).

## Summary

| # | Source | Access method | Worked? | Coverage | Gaps / gotchas |
|---|---|---|---|---|---|
| 1 | OurAirports | Direct CSV (davidmegginson.github.io/ourairports-data) | Yes | 16/16 airports, 50 runway rows | Runway count must exclude `closed=1`. No traffic data. |
| 2 | BTS T-100 Segment (All Carriers, dom + intl) | ASP.NET form POST on transtats (`DL_SelectFields.aspx?gnoyr_VQ=FMG`), scripted | Yes | 2019-01 → 2026-07, 652,065 rows | Whole-year national download then filter. Freight must be filtered by `CLASS`. Month lag about 3.5 months. |
| 3 | BTS On-Time Performance | Direct monthly zips (`PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_YYYY_M.zip`) | Yes | 2019-01 → 2026-08, 10,165,946 flights | Passenger carriers only (18 reporting carriers). Delay causes only on flights ≥15 min late. Small commuter and Alaska bush carriers are absent. |
| 4 | BTS Average Domestic Fares by airport | Form POST on `transtats.bts.gov/AverageFare/`, returns SpreadsheetML `.xls` | Yes | 16/16 airports × 30 quarters, 2019 Q1 → 2026 Q2, 480 rows | Origin-airport average only, domestic itineraries, no carrier or route split. XML is slightly malformed, so use regex parsing. |
| 5 | FAA TAF | Direct zip (taf.faa.gov/Downloads/APO100_TAF_Final_2025.zip) | Yes | 16/16 airports, FY1976–FY2055, actuals and forecast | It is the 2025 TAF (published 2026-02). Annual only, no monthly. Pad-trimmed `locid`. |
| 6 | FAA NAS Status API | `GET https://nasstatus.faa.gov/api/airport-status-information` (XML) and `/api/airport-events` (JSON) | Yes, no API key | Live snapshot only | No history. Snapshot lists only airports with an active event. |

## 1. OurAirports
- **URL:** https://davidmegginson.github.io/ourairports-data/airports.csv and `runways.csv`.
- **Files:** `data/raw/ourairports/airports.csv` (16 rows, 19 columns) and `runways.csv` (50 rows, 20 columns). Full files were 12.7 MB and 4 MB and were filtered, then deleted.
- **Fields we need:** `iata_code`, `name`, `iso_region` (state), `latitude_deg`, `longitude_deg`, `type`, `municipality`, `scheduled_service`. All present.
- **Runways:** count rows in `runways.csv` per `airport_ident`, excluding `closed=1`. Example: LGB has 5 rows, 2 closed. SJC and BDL each have 1 closed.
- **Gotchas:** join on `ident` (for example `KBOS`) and not on IATA. OAK is named "Oakland San Francisco Bay Airport" here. Runway rows say nothing about gates or terminals.
- **Not available:** gates, terminals and terminal square footage. Terminal-expansion questions have to be inferred from traffic data.

## 2. BTS T-100 Segment
- **Access:** the form has no API. The scripted flow is GET the form, copy `__VIEWSTATE` and `__EVENTVALIDATION`, then POST with `cboYear`, `cboPeriod=All`, `cboGeography=All`, the field checkboxes set to `on`, and `btnDownload=Download`. It returns a zip of about 10–15 MB per year. Each request took 45–110 s.
- **Manual fallback:** transtats.bts.gov → Aviation → Air Carrier Statistics (Form 41 Traffic) → "T-100 Segment (All Carriers)" → Download. Select the fields below, choose year and period, tick "Prezipped file", and download. It has to be repeated for each year.
- **Files:** `data/raw/t100/t100_segment_<year>.csv.gz` (31 columns). Rows kept (origin or dest in scope): 2019 85,748; 2020 61,359; 2021 79,108; 2022 89,683; 2023 91,637; 2024 96,213; 2025 95,173; 2026 53,144.
- **Fields present:** `DEPARTURES_SCHEDULED`, `DEPARTURES_PERFORMED`, `SEATS`, `PASSENGERS`, `FREIGHT`, `MAIL`, `PAYLOAD`, `DISTANCE`, `AIR_TIME`, `RAMP_TO_RAMP`, carrier, origin and dest (with country and state), aircraft group, type and config, `DISTANCE_GROUP`, `CLASS`, `DATA_SOURCE`, year, quarter, month.
- **Latest month:** July 2026. The form states "Latest Available Data: July 2026".
- **Passenger vs freight:**
  - `CLASS` F = scheduled passenger/cargo, G = scheduled all-cargo, L = non-scheduled civilian passenger/cargo, P = non-scheduled all-cargo.
  - Keep F and L for passengers. G and P are freight-only.
  - ANC 2024 shows the effect: 79,898 F departures and 71,650 G plus 28,945 P freight departures. FedEx, UPS, Atlas, Kalitta and Cathay are cargo carriers.
  - Belly freight on class F flights is still counted in `FREIGHT`.
  - `PASSENGERS` is near zero on G and P, so `PASSENGERS > 0` is a second safeguard.
- **Domestic vs international:** `DATA_SOURCE` DU/DF = domestic, IU/IF = international. `ORIGIN_COUNTRY` and `DEST_COUNTRY` also work. About 18k international rows per year.
- **Gotchas:**
  - Rows are aggregated per carrier, route, aircraft type and month, and not per flight.
  - Both directions appear, so airport totals are the sum over `ORIGIN` for departures. Do not double count.
  - `ORIGIN_STATE_ABR` and `DEST_STATE_ABR` are null for foreign airports.
  - The July 2026 data is the latest month. Segment-level seats and passengers give load factor, which is the main unmet-demand signal.
- **Long-haul definition:** use `DISTANCE_GROUP` (1–20, 500-mile bins) or `DISTANCE`. A 1,500+ mile cutoff is about group 4 and above. The threshold has to be a stated assumption.

## 3. BTS On-Time Performance
- **URL pattern:** `https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{YYYY}_{M}.zip`. About 27–33 MB per month, national. 2026-09 returns 404, so the latest month is **August 2026**.
- **Files:** `data/raw/ontime/ontime_<year>.csv.gz`, 35 columns, **10,165,946 rows** total (flights with origin or dest in scope). Per year: 2019 1,588,475; 2020 871,304; 2021 1,111,267; 2022 1,405,865; 2023 1,414,381; 2024 1,419,055; 2025 1,414,305; 2026 (Jan–Aug) 941,294. 92 national zips (about 2.9 GB) were downloaded, filtered and deleted.
- **Columns kept (35):** date, reporting airline, flight number, origin/dest (code, city, state), scheduled and actual times, `DepDelay`, `ArrDelay`, `DepDel15`, `ArrDel15`, `TaxiOut`, `TaxiIn`, `Cancelled`, `CancellationCode`, `Diverted`, elapsed and air time, `Distance`, `CarrierDelay`, `WeatherDelay`, `NASDelay`, `SecurityDelay`, `LateAircraftDelay`.
- **Delay causes:** populated only when a flight arrives ≥15 min late (`ArrDel15=1`). Among those flights coverage is 100%. Non-delayed flights are null, so about 80% of all rows are null for the cause columns. This is correct and not a data loss. NAS vs carrier delay comparisons must be averaged over delayed flights, or summed as minutes per airport.
- **Quick check (2024 departures, mean over rows with a cause):** LAX NASDelay 13.9 and CarrierDelay 24.9 minutes. SNA NASDelay 16.6 and CarrierDelay 23.2 minutes.
- **Overall cancel rate in scope:** 1.9%.
- **Gotchas:**
  - Only 18 large reporting carriers (AA, AS, B6, DL, F9, G4, HA, NK, UA, WN, regionals such as OO, MQ, 9E, YX, OH, YV, QX, EV). There is no freight, which is why ANC freight carriers do not appear. Small Alaska carriers (Grant, Kenai and so on) are absent. ANC has about 37k flights per year here against about 80k F-class departures in T-100.
  - 2020 is a COVID outlier. The 2019 baseline is complete.
  - Times are local, in hhmm form.
  - There is no gate or terminal info, and no per-airport capacity.
- **Manual fallback:** transtats.bts.gov → "Airline On-Time Performance Data" → "Reporting Carrier On-Time Performance (1987-present)" → pick fields, filter Origin Airport, and download month by month.

## 4. BTS Average Domestic Airline Itinerary Fares
- **URL:** https://www.transtats.bts.gov/AverageFare/. ASP.NET form with `dlstYear` (2019 → 2026) and `dlstQuarter` (0 = year to date, 1–4). The "Download Data" button (`Button1`) returns `AverageFare_Q#_YYYY.xls`, which is really SpreadsheetML XML.
- **File:** `data/raw/fares/average_fares_scope.csv`, 480 rows. 16 airports × 30 quarters (2019 Q1 → 2026 Q2). Columns: year, quarter, rank_2025, airport_code, airport_name, city, state, avg_fare_usd, inflation_adj_fare_usd (base Q2-2026), pax_2025_10pct_sample.
- **Gotchas:**
  - It is the fare at the origin airport only, domestic, with no route, carrier or cabin split.
  - Ranked by 2025 passengers, so the airport list is fixed. All 16 are present in all 30 quarters.
  - The inflation-adjusted column uses a Q2-2026 base.
  - Passenger counts are a 10% sample for 2025 only.
  - The XML does not parse with a strict parser, so use regex on `<Row>` and `<Cell>`.
- **Manual fallback:** open the page, choose the year and quarter, and click "Download Data" (30 downloads).

## 5. FAA Terminal Area Forecast
- **URL:** https://taf.faa.gov/Downloads/APO100_TAF_Final_2025.zip (15.7 MB). It contains `Enplanements.xlsx`, `AirportsOperations.xlsx`, `Airports.xlsx`, `BasedAircraft.xlsx` and `Tracon.xlsx`. The FAA page is https://www.faa.gov/data_research/aviation/taf, last updated 2026-02-27.
- **Files kept:** `taf_enplanements_scope.csv` (1,280 rows), `taf_operations_scope.csv` (1,056 rows), `taf_airports_scope.csv` (16 rows), plus the original zip.
- **Fields:**
  - Enplanements: `locid`, `scenario`, `ayear`, `aac` (air carrier), `aat` (air taxi), `commuter`, `us_flag`, `frgn_flag`.
  - Operations: `itn_Ac`, `itn_at`, `itn_ga`, `itn_mil`, `loc_ga`, `loc_mil`, `tot_overs`.
  - Airports: hub size, facility class, state, lat/lon.
- **Coverage:** enplanements FY1976 → FY2055. `scenario=0` is actuals (1976–2024) and `scenario=1` is the forecast (2025–2055). Operations from 1990. Fiscal year, annual. FY2025+ are forecasts, so actuals end at FY2024.
- **Sample, total enplanements 2024:** LAX 26.3M, SFO 17.5M, BOS 16.8M, OAK 5.2M, SNA 5.3M, SJC 5.5M, ANC 2.7M, MHT 0.63M.
- **Gotchas:**
  - `locid` in the data sheets has trailing spaces (for example `'BOS '`). Strip it before joining.
  - Fiscal year, not calendar year.
  - Total enplanements = `aac + aat + commuter + us_flag + frgn_flag`. `us_flag` and `frgn_flag` are international enplanements and are **not** included in the first three columns; leaving them out understates LAX, SFO and BOS by 17–31 % (corrected 2026-11-10 after reconciling with T-100, which matches the 5-column total within a few percent). The 2019 baseline is present for all 16 airports.
  - There is no capacity (gates, terminal size) in the TAF.
  - Enplanements are forecast. T-100 and the TAF will not match exactly.

## 6. FAA NAS Status API (live)
- **Endpoints, no key needed:**
  - `GET https://nasstatus.faa.gov/api/airport-status-information` returns XML.
  - `GET https://nasstatus.faa.gov/api/airport-events` returns JSON, one object per airport with an active event.
- **Samples saved:** `data/raw/nas/airport-status-information.xml` (1.3 KB) and `airport-events.json`.
- **XML sample:** an `AIRPORT_STATUS_INFORMATION` root with `Update_Time`, then `Delay_type` blocks (Airport Closures, and also ground stops and delays when active). In the snapshot, SNA showed a daily closure notice (`SNA AD AP CLSD DLY 0730-1415`) running Nov 10 – Nov 21, and LAX, SAN and LAS showed closures to non-scheduled GA.
- **JSON sample fields:** `airportId`, `airportLongName`, `latitude`, `longitude`, and nullable `groundStop`, `groundDelay`, `airportClosure`, `freeForm`, `arrivalDelay`, `departureDelay`, `airportConfig`, `deicing`.
- **Gotchas:**
  - Only airports with something active are listed, so absence means no reported event.
  - A "closure" can be a night curfew or a GA-only restriction, not a full closure. Parse the `Reason` text.
  - There is no history. Cache responses if you want any trend.
  - Not an official contract. The format may change, so wrap it with a timeout and a fallback.

## Impact on the four target questions

| Question | Data available | Blocker? |
|---|---|---|
| Which New England airports are strong candidates for terminal expansion? | T-100 (seats, passengers, load factor, 2019 vs now), TAF enplanement growth to 2055, On-Time delays (NAS and taxi), fares | **Partial.** No terminal capacity, gates or square footage in any source. Expansion strength must be a proxy score (growth, load factor, delay, fare pressure). Say so in the answer. |
| Compare LAX vs SNA congestion | On-Time (NAS delay, taxi-out, departure delay, cancellations), T-100 departures, TAF operations, NAS live | **No.** Fully answerable. |
| % of long-haul flights out of ANC | T-100 with `CLASS` F/L, `DISTANCE` or `DISTANCE_GROUP`, `DEPARTURES_PERFORMED` | **No, but needs a definition.** Pick a cutoff (for example ≥1,500 mi or ≥2,500 mi) and decide whether to count freight. For passenger flights, filter to `CLASS` in (F, L). On-Time is not suitable for ANC because it omits small carriers and all freight. |
| Unmet flight demand at SFO and why | T-100 seats vs passengers (load factor), scheduled vs performed departures, fares trend, On-Time delays and cancellations, TAF forecast | **Partial.** True unmet demand needs O&D or booking data (DB1B, not included here) and capacity limits. Proxies: load factor, fare rise, delay and cancellation rates. The "why" is inference. |

## Out of scope for this project
- BTS DB1B (O&D survey) for route-level fares or demand. It is large, so it is not used.
- Scheduled refresh. The data is a one-time snapshot; T-100 lags about 3.5 months and On-Time about 2.5 months, so a refresh would re-run the download scripts monthly.
