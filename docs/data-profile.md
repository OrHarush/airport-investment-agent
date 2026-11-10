# Data profile (Phase 1: read-only)

_Generated 2026-11-10 by `etl/profile/run_profile.py` from `data/raw/**` (read-only; nothing under `data/clean/` was produced)._  
_Scope: BOS BDL PVD MHT PWM BTV LAX SNA BUR LGB ONT ANC FAI SFO OAK SJC. Re-run: `python etl/profile/run_profile.py` (about 5 minutes; On-Time is 10.2 M rows)._


## Summary

| Source | Rows | Size on disk | Coverage | Biggest data-quality issue |
|---|---|---|---|---|
| OurAirports | 66 | 9.8 KB | 16/16 airports, 50 runway rows (static snapshot) | Runway rows include closed runways (4 rows: BDL (1), LGB (2), SJC (1)); must filter `closed=1`. No gates/terminal data at all. |
| BTS T-100 Segment | 652,065 | 16.6 MB | 2019-01 to 2026-07; 16/16 airports; 0 airport-month gaps | Freight and passenger mixed (18.5 % of rows are CLASS G/P); 2026 partial; 1,739 natural-key collisions (not exact duplicates); `DEPARTURES_SCHEDULED`=0 on 27.7 % of flown passenger rows. |
| BTS On-Time Performance | 10,165,946 | 306.6 MB | 2019-01 to 2026-08; 16/16 airports; 0 airport-month gaps | Only 18 reporting carriers: covers roughly half of ANC (43-59 % by year) and a quarter of FAI (19-33 %) passenger departures, 75-80 % at BOS/LAX/SFO. Extreme delays up to 3,240 min. |
| BTS Average Domestic Fares | 480 | 49.2 KB | 2019Q1 to 2026Q2; 16 x 30 quarters, 0 gaps | No national benchmark and no carrier/route split; small-airport quarters are noisy (10 % sample). No missing quarters. |
| FAA TAF 2025 | 2,352 | 102.4 KB | FY1976 to FY2055 (actual to FY2024); 16/16 | `docs/data-sources.md` defines total enplanements wrongly: international (`us_flag`+`frgn_flag`) is separate and adds up to 40 % at gateways. FY2025 is still a forecast. |
| FAA NAS Status (live) | 9 | 5.3 KB | one live snapshot, no history | Live snapshot only, no history; "closure" entries are mostly NOTAM curfews / GA restrictions, and XML dates carry no year. |

**Headline findings (details below):**
1. **Coverage is complete.** All 16 airports are in every historical source and there are **no missing months/quarters** (T-100, On-Time, Fares) and no missing fiscal years (TAF).
2. **One documentation error that matters:** the TAF "total enplanements" in `docs/data-sources.md` omits international traffic. With the 5-column total, TAF reconciles with T-100 to within a few percent; with the 3-column total it understates LAX/SFO/BOS by 17-31 %.
3. **On-Time is a biased sample for ANC and FAI** (and moderately for BOS/LAX/SFO): congestion/delay scores there describe only the 18 large reporting carriers.
4. **T-100 "duplicates" are not duplicates:** 1,739 key collisions carry different measures (mostly Kalitta cargo and United), so they should be summed, not dropped.
5. **`DEPARTURES_SCHEDULED` is unusable** as a cancellation/capacity proxy (zero on 27.7 % of flown passenger rows; performed exceeds scheduled at SFO).
6. **The 2026 year is partial** in every monthly source (T-100 through July, On-Time through August, Fares through Q2). Annual totals must not mix 2026 with full years.

## Reading guide

- **DATA ERROR** = very likely wrong/artefact; **REAL EXTREME** = real-world event; **LIKELY ARTEFACT** = a quirk of how the source is built. Nothing was dropped, altered or saved.
- 'Scope' always means the 16 airports; 'passenger-class' means T-100 `CLASS` F or L.


## 1. OurAirports

**airports.csv**

**Shape:** 16 rows x 19 columns | files: `airports.csv` (3.9 KB) | total 3.9 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| id | int64 | 0 | 0 | 16 | 3396=1, 3422=1, 3430=1, 3432=1, 3632=1, 3644=1, 3684=1, 3744=1, 3752=1, 3795=1, 3796=1, 3878=1, 3883=1, 3894=1, 5360=1, 5388=1 |
| ident | str | 0 | 0 | 16 | KBDL=1, KBOS=1, KBTV=1, KBUR=1, KLAX=1, KLGB=1, KMHT=1, KOAK=1, KONT=1, KPVD=1, KPWM=1, KSFO=1, KSJC=1, KSNA=1, PAFA=1, PANC=1 |
| type | str | 0 | 0 | 2 | large_airport=13, medium_airport=3 |
| name | str | 0 | 0 | 16 | Bradley International Airport=1, Boston Logan International Airport=1, Patrick Leahy Burlington International Airport=1, Hollywood Burbank/Bob Hope Airport=1, Los Angeles International Airport=1, Long Beach International Airport=1, Manchester-Boston Regional Airport=1, Oakland San Francisco Bay Airport=1, Ontario International Airport=1, Rhode Island T. F. Green International Airport=1, Portland International Jetport=1, San Francisco International Airport=1, Mineta San Jose International Airport=1, John Wayne Orange County International Airport=1, Fairbanks International Airport=1, Ted Stevens Anchorage International Airport=1 |
| latitude_deg | float64 | 0 | 0 | 16 | 41.938555=1, 42.36197=1, 44.471901=1, 34.202834=1, 33.942501=1, 33.816523=1, 42.932598=1, 37.720085=1, 34.056=1, 41.725038=1, 43.646198=1, 37.619806=1, 37.362452=1, 33.675063=1, 64.815102=1, 61.179004=1 |
| longitude_deg | float64 | 0 | 0 | 16 | -72.688016=1, -71.0079=1, -73.153297=1, -118.35805=1, -118.407997=1, -118.149891=1, -71.435699=1, -122.221184=1, -117.600998=1, -71.425668=1, -70.309303=1, -122.374821=1, -121.929188=1, -117.869281=1, -147.856003=1, -149.992561=1 |
| elevation_ft | int64 | 0 | 0 | 16 | 173=1, 20=1, 335=1, 778=1, 125=1, 60=1, 266=1, 9=1, 944=1, 55=1, 76=1, 13=1, 62=1, 56=1, 439=1, 152=1 |
| continent | float64 | 16 | 100.0 | 0 | <NA>=16 |
| iso_country | str | 0 | 0 | 1 | US=16 |
| iso_region | str | 0 | 0 | 8 | US-CA=8, US-AK=2, US-CT=1, US-MA=1, US-VT=1, US-NH=1, US-RI=1, US-ME=1 |
| municipality | str | 0 | 0 | 16 | Hartford=1, Boston=1, Burlington=1, Burbank=1, Los Angeles=1, Long Beach=1, Manchester=1, Oakland=1, Ontario=1, Providence/Warwick=1, Portland=1, San Francisco=1, San Jose=1, Santa Ana=1, Fairbanks=1, Anchorage=1 |
| scheduled_service | str | 0 | 0 | 1 | yes=16 |
| icao_code | str | 0 | 0 | 16 | KBDL=1, KBOS=1, KBTV=1, KBUR=1, KLAX=1, KLGB=1, KMHT=1, KOAK=1, KONT=1, KPVD=1, KPWM=1, KSFO=1, KSJC=1, KSNA=1, PAFA=1, PANC=1 |
| iata_code | string | 0 | 0 | 16 | BDL=1, BOS=1, BTV=1, BUR=1, LAX=1, LGB=1, MHT=1, OAK=1, ONT=1, PVD=1, PWM=1, SFO=1, SJC=1, SNA=1, FAI=1, ANC=1 |
| gps_code | str | 0 | 0 | 16 | KBDL=1, KBOS=1, KBTV=1, KBUR=1, KLAX=1, KLGB=1, KMHT=1, KOAK=1, KONT=1, KPVD=1, KPWM=1, KSFO=1, KSJC=1, KSNA=1, PAFA=1, PANC=1 |
| local_code | str | 0 | 0 | 16 | BDL=1, BOS=1, BTV=1, BUR=1, LAX=1, LGB=1, MHT=1, OAK=1, ONT=1, PVD=1, PWM=1, SFO=1, SJC=1, SNA=1, FAI=1, ANC=1 |
| home_link | str | 1 | 6.25 | 15 | http://www.bradleyairport.com/=1, http://www.massport.com/logan/=1, http://www.vermontairports.com/btv.html=1, https://www.hollywoodburbankairport.com/=1, https://www.flylax.com/=1, http://www.lgb.org/=1, https://flymanchester.com=1, https://www.iflyoak.com/=1, https://www.flyontario.com/=1, https://flyri.com/=1, https://portlandjetport.org/=1, http://www.flysfo.com/=1, https://www.flysanjose.com/=1, http://www.ocair.com/=1, <NA>=1, https://dot.alaska.gov/anc/=1 |
| wikipedia_link | str | 0 | 0 | 16 | https://en.wikipedia.org/wiki/Bradley_International_Airport=1, https://en.wikipedia.org/wiki/Logan_International_Airport=1, https://en.wikipedia.org/wiki/Burlington_International_Airport=1, https://en.wikipedia.org/wiki/Hollywood_Burbank_Airport=1, https://en.wikipedia.org/wiki/Los_Angeles_International_Airport=1, https://en.wikipedia.org/wiki/Long_Beach_Airport=1, https://en.wikipedia.org/wiki/Manchester-Boston_Regional_Airport=1, https://en.wikipedia.org/wiki/Oakland_International_Airport=1, https://en.wikipedia.org/wiki/LA/Ontario_International_Airport=1, https://en.wikipedia.org/wiki/T._F._Green_Airport=1, https://en.wikipedia.org/wiki/Portland_International_Jetport=1, https://en.wikipedia.org/wiki/San_Francisco_International_Airport=1, https://en.wikipedia.org/wiki/San_Jose_International_Airport=1, https://en.wikipedia.org/wiki/John_Wayne_Airport=1, https://en.wikipedia.org/wiki/Fairbanks_International_Airport=1, https://en.wikipedia.org/wiki/Ted_Stevens_Anchorage_International_Airport=1 |
| keywords | str | 6 | 37.5 | 10 | <NA>=6, HFD, Hartford=1, General Edward Lawrence Logan International Airport=1, United Airport, Union Air Terminal, Lockheed Air Terminal, Burbank–Glendale–Pasadena=1, Tom Bradley=1, Daugherty Field=1, Manchester Airport=1, Metro Oakland International=1, QSF, QBA=1, Disney, Disneyland, Orange County=1, Anchorage=1 |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| id | 3,396 | 3,416 | 3,748 | 5,367 | 5,388 | 3,883 | 606.4 |  |
| latitude_deg | 33.7 | 33.8 | 39.7 | 62.1 | 64.8 | 41.6 | 9.24 |  |
| longitude_deg | -150.0 | -148.4 | -118.0 | -70.8 | -70.3 | -105.3 | 28.6 |  |
| elevation_ft | 9 | 12.0 | 100.5 | 819.5 | 944.0 | 222.7 | 279.0 |  |


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `ident`: **0** extra rows (0 rows in duplicated-key groups)


**runways.csv**

**Shape:** 50 rows x 20 columns | files: `runways.csv` (5.9 KB) | total 5.9 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| id | int64 | 0 | 0 | 50 |  |
| airport_ref | int64 | 0 | 0 | 16 | 3422=6, 3644=5, 3632=4, 3744=4, 3878=4, 5360=4, 3396=3, 3883=3, 5388=3, 3430=2, 3432=2, 3684=2, 3752=2, 3795=2, 3796=2, 3894=2 |
| airport_ident | str | 0 | 0 | 16 | KBOS=6, KLGB=5, KLAX=4, KOAK=4, KSFO=4, PAFA=4, KBDL=3, KSJC=3, PANC=3, KBTV=2, KBUR=2, KMHT=2, KONT=2, KPVD=2, KPWM=2, KSNA=2 |
| length_ft | int64 | 0 | 0 | 49 |  |
| width_ft | int64 | 0 | 0 | 4 | 150=28, 200=9, 75=7, 100=6 |
| surface | str | 0 | 0 | 5 | ASP=37, CON=8, ASPH-G=3, GRVL=1, WATER=1 |
| lighted | int64 | 0 | 0 | 2 | 1=43, 0=7 |
| closed | int64 | 0 | 0 | 2 | 0=46, 1=4 |
| le_ident | string | 0 | 0 | 37 |  |
| le_latitude_deg | float64 | 0 | 0 | 49 |  |
| le_longitude_deg | float64 | 0 | 0 | 50 |  |
| le_elevation_ft | int64 | 0 | 0 | 40 |  |
| le_heading_degT | float64 | 0 | 0 | 29 |  |
| le_displaced_threshold_ft | float64 | 31 | 62.0 | 19 | <NA>=31, 1154.0=1, 880.0=1, 225.0=1, 909.0=1, 530.0=1, 830.0=1, 1305.0=1, 1350.0=1, 415.0=1, 310.0=1, 442.0=1, 336.0=1, 998.0=1, 565.0=1, 645.0=1, 560.0=1, 1307.0=1, 1302.0=1, 200.0=1 |
| he_ident | string | 0 | 0 | 34 |  |
| he_latitude_deg | float64 | 0 | 0 | 50 |  |
| he_longitude_deg | float64 | 0 | 0 | 50 |  |
| he_elevation_ft | int64 | 0 | 0 | 44 |  |
| he_heading_degT | float64 | 0 | 0 | 29 |  |
| he_displaced_threshold_ft | float64 | 34 | 68.0 | 14 | <NA>=34, 500.0=2, 300.0=2, 825.0=1, 1200.0=1, 350.0=1, 800.0=1, 950.0=1, 532.0=1, 2000.0=1, 292.0=1, 850.0=1, 2537.0=1, 2542.0=1, 565.0=1 |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| id | 240,221 | 240,223 | 243,002 | 250,001 | 576,813 | 256,756 | 66,055 |  |
| airport_ref | 3,396 | 3,408 | 3,744 | 5,375 | 5,388 | 3,896 | 624.0 |  |
| length_ft | 2,557 | 3,114 | 7,650 | 12,050 | 12,894 | 7,758 | 2,937 |  |
| width_ft | 75.0 | 75.0 | 150.0 | 200.0 | 200.0 | 142.5 | 38.9 |  |
| lighted | 0 | 0 | 1 | 1 | 1 | 0.86 | 0.351 |  |
| closed | 0 | 0 | 0 | 1 | 1 | 0.08 | 0.274 |  |
| le_latitude_deg | 33.7 | 33.8 | 37.7 | 64.8 | 64.8 | 41.8 | 9.47 |  |
| le_longitude_deg | -150.0 | -149.1 | -118.2 | -71.0 | -70.3 | -107.5 | 27.8 |  |
| le_elevation_ft | 2 | 6 | 53.0 | 749.5 | 943.0 | 168.0 | 236.7 |  |
| le_heading_degT | 20.0 | 28.0 | 93.0 | 180.1 | 359.0 | 107.8 | 69.6 |  |
| le_displaced_threshold_ft | 200.0 | 222.5 | 645.0 | 1,311 | 1,350 | 750.7 | 396.9 |  |
| he_latitude_deg | 33.7 | 33.8 | 37.7 | 64.8 | 64.8 | 41.8 | 9.48 |  |
| he_longitude_deg | -150.0 | -149.0 | -118.2 | -71.0 | -70.3 | -107.5 | 27.8 |  |
| he_elevation_ft | 4 | 8.45 | 49.5 | 697.5 | 930.0 | 162.4 | 232.6 |  |
| he_heading_degT | 0.2 | 188.4 | 270.0 | 345.0 | 359.9 | 266.2 | 63.0 |  |
| he_displaced_threshold_ft | 292.0 | 298.0 | 682.5 | 2,538 | 2,542 | 940.2 | 758.5 |  |


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `id`: **0** extra rows (0 rows in duplicated-key groups)


#### Scope check: runways per airport (open = `closed`≠1)


| iata_norm | ident | type | name | iso_region | scheduled_service | runway_rows | closed_rows | open_runways | longest_open_ft | longest_any_ft |
|---|---|---|---|---|---|---|---|---|---|---|
| BOS | KBOS | large_airport | Boston Logan International Airport | US-MA | yes | 6 | 0 | 6 | 10,083 | 10,083 |
| BDL | KBDL | large_airport | Bradley International Airport | US-CT | yes | 3 | 1 | 2 | 9,510 | 9,510 |
| PVD | KPVD | large_airport | Rhode Island T. F. Green International Airport | US-RI | yes | 2 | 0 | 2 | 8,700 | 8,700 |
| MHT | KMHT | medium_airport | Manchester-Boston Regional Airport | US-NH | yes | 2 | 0 | 2 | 9,250 | 9,250 |
| PWM | KPWM | large_airport | Portland International Jetport | US-ME | yes | 2 | 0 | 2 | 7,200 | 7,200 |
| BTV | KBTV | medium_airport | Patrick Leahy Burlington International Airport | US-VT | yes | 2 | 0 | 2 | 8,319 | 8,319 |
| LAX | KLAX | large_airport | Los Angeles International Airport | US-CA | yes | 4 | 0 | 4 | 12,894 | 12,894 |
| SNA | KSNA | large_airport | John Wayne Orange County International Airport | US-CA | yes | 2 | 0 | 2 | 5,700 | 5,700 |
| BUR | KBUR | large_airport | Hollywood Burbank/Bob Hope Airport | US-CA | yes | 2 | 0 | 2 | 6,886 | 6,886 |
| LGB | KLGB | large_airport | Long Beach International Airport | US-CA | yes | 5 | 2 | 3 | 10,000 | 10,000 |
| ONT | KONT | large_airport | Ontario International Airport | US-CA | yes | 2 | 0 | 2 | 12,197 | 12,197 |
| ANC | PANC | large_airport | Ted Stevens Anchorage International Airport | US-AK | yes | 3 | 0 | 3 | 12,400 | 12,400 |
| FAI | PAFA | medium_airport | Fairbanks International Airport | US-AK | yes | 4 | 0 | 4 | 11,800 | 11,800 |
| SFO | KSFO | large_airport | San Francisco International Airport | US-CA | yes | 4 | 0 | 4 | 11,870 | 11,870 |
| OAK | KOAK | large_airport | Oakland San Francisco Bay Airport | US-CA | yes | 4 | 0 | 4 | 10,520 | 10,520 |
| SJC | KSJC | large_airport | Mineta San Jose International Airport | US-CA | yes | 3 | 1 | 2 | 11,000 | 11,000 |


**Scope findings**

- Missing from airports.csv: none
- IATA codes appearing >1 time: none
- IATA codes with case/whitespace issues: 0
- Airports.csv rows not in scope: 0
- Runway rows whose `airport_ident` is not in airports.csv: 0
- Scope airports with zero runway rows: none

- Ambiguous names: OAK listed as `Oakland San Francisco Bay Airport`; surface/length nulls: 0 rows.


### Anything surprising (OurAirports)

- Clean and complete; the only trap is the join key (`ident` such as `KBOS`, not IATA) and `closed=1` runways.
- OAK is named "Oakland San Francisco Bay Airport" (display name differs from TAF/fares: "Oakland International"). Join on code, never on name.
- Runway length cannot be used as a capacity proxy for SNA vs LAX in any simple way (SNA longest runway 5,700 ft vs LAX 12,894 ft), but it is a structural constraint worth mentioning in the answer.

## 2. BTS T-100 Segment

**Shape:** 652,065 rows x 31 columns | files: `t100_segment_2019.csv.gz` (2.2 MB), `t100_segment_2020.csv.gz` (1.6 MB), `t100_segment_2021.csv.gz` (2.0 MB), `t100_segment_2022.csv.gz` (2.3 MB), `t100_segment_2023.csv.gz` (2.3 MB), `t100_segment_2024.csv.gz` (2.4 MB), `t100_segment_2025.csv.gz` (2.4 MB), `t100_segment_2026.csv.gz` (1.4 MB) | total 16.6 MB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| DEPARTURES_SCHEDULED | float64 | 0 | 0 | 571 |  |
| DEPARTURES_PERFORMED | float64 | 0 | 0 | 538 |  |
| PAYLOAD | float64 | 0 | 0 | 202,720 |  |
| SEATS | float64 | 0 | 0 | 20,023 |  |
| PASSENGERS | float64 | 0 | 0 | 23,650 |  |
| FREIGHT | float64 | 0 | 0 | 153,685 |  |
| MAIL | float64 | 0 | 0 | 37,466 |  |
| DISTANCE | float64 | 0 | 0 | 3,584 |  |
| RAMP_TO_RAMP | float64 | 0 | 0 | 32,005 |  |
| AIR_TIME | float64 | 0 | 0 | 29,520 |  |
| UNIQUE_CARRIER | str | 0 | 0 | 292 |  |
| UNIQUE_CARRIER_NAME | str | 0 | 0 | 292 |  |
| CARRIER | str | 0 | 0 | 296 |  |
| CARRIER_NAME | str | 0 | 0 | 307 |  |
| ORIGIN | str | 0 | 0 | 1,464 |  |
| ORIGIN_CITY_NAME | str | 0 | 0 | 1,338 |  |
| ORIGIN_STATE_ABR | str | 54,250 | 8.32 | 65 |  |
| ORIGIN_COUNTRY | str | 0 | 0 | 121 |  |
| DEST | str | 0 | 0 | 1,477 |  |
| DEST_CITY_NAME | str | 0 | 0 | 1,354 |  |
| DEST_STATE_ABR | str | 52,721 | 8.09 | 66 |  |
| DEST_COUNTRY | str | 0 | 0 | 121 |  |
| AIRCRAFT_GROUP | int64 | 0 | 0 | 9 | 6=548,106, 4=41,551, 8=35,579, 7=10,184, 1=9,321, 5=3,098, 0=2,433, 2=1,711, 3=82 |
| AIRCRAFT_TYPE | int64 | 0 | 0 | 171 |  |
| AIRCRAFT_CONFIG | int64 | 0 | 0 | 4 | 1=524,748, 2=117,446, 3=9,866, 4=5 |
| YEAR | int64 | 0 | 0 | 8 | 2024=96,213, 2025=95,173, 2023=91,637, 2022=89,683, 2019=85,748, 2021=79,108, 2020=61,359, 2026=53,144 |
| QUARTER | int64 | 0 | 0 | 4 | 1=170,259, 2=167,638, 3=160,126, 4=154,042 |
| MONTH | int64 | 0 | 0 | 12 | 6=58,861, 7=58,578, 1=58,081, 3=57,614, 5=55,461, 2=54,564, 12=53,549, 4=53,316, 8=51,495, 11=50,884, 9=50,053, 10=49,609 |
| DISTANCE_GROUP | int64 | 0 | 0 | 20 | 1=176,815, 2=139,707, 3=81,473, 4=76,549, 5=66,473, 6=30,743, 7=17,238, 11=14,592, 12=12,810, 8=7,994, 9=6,368, 14=5,619, 13=5,135, 15=4,273, 10=3,220, 16=1,421, 17=1,238, 18=389, 19=6, 20=2 |
| CLASS | str | 0 | 0 | 4 | F=466,470, G=83,474, L=64,779, P=37,342 |
| DATA_SOURCE | str | 0 | 0 | 4 | DU=519,891, IF=69,386, IU=52,558, DF=10,230 |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| DEPARTURES_SCHEDULED | 0 | 0 | 4 | 81.0 | 1,460 | 19.1 | 36.0 | FLAG |
| DEPARTURES_PERFORMED | 0 | 1 | 10.0 | 82.0 | 1,460 | 22.1 | 34.8 | FLAG |
| PAYLOAD | 0 | 4,340 | 434,000 | 4,598,000 | 79,852,024 | 1,170,554 | 2,137,636 | FLAG |
| SEATS | 0 | 0 | 700.0 | 11,874 | 77,074 | 2,871 | 4,971 |  |
| PASSENGERS | 0 | 0 | 476.0 | 9,591 | 68,650 | 2,249 | 4,070 |  |
| FREIGHT | 0 | 0 | 136.0 | 1,267,991 | 43,475,435 | 238,878 | 1,138,483 | FLAG |
| MAIL | 0 | 0 | 0 | 10,881 | 6,530,776 | 5,960 | 64,961 | FLAG |
| DISTANCE | 0 | 166.0 | 1,081 | 5,473 | 9,770 | 1,576 | 1,574 |  |
| RAMP_TO_RAMP | 0 | 0 | 1,023 | 14,510 | 391,773 | 3,520 | 6,501 | FLAG |
| AIR_TIME | 0 | 0 | 847.0 | 12,473 | 345,376 | 3,035 | 5,796 | FLAG |
| AIRCRAFT_GROUP | 0 | 4 | 6 | 8 | 8 | 5.89 | 1.01 |  |
| AIRCRAFT_TYPE | 10.0 | 416.0 | 673.0 | 888.0 | 894.0 | 669.7 | 133.4 |  |
| AIRCRAFT_CONFIG | 1 | 1 | 1 | 2 | 4 | 1.21 | 0.443 |  |
| YEAR | 2,019 | 2,019 | 2,023 | 2,026 | 2,026 | 2,022 | 2.19 |  |
| QUARTER | 1 | 1 | 2 | 4 | 4 | 2.46 | 1.11 |  |
| MONTH | 1 | 1 | 6 | 12.0 | 12.0 | 6.37 | 3.44 |  |
| DISTANCE_GROUP | 1 | 1 | 3 | 11.0 | 20.0 | 3.64 | 3.14 |  |


**Flagged (max > 10x p95):** `DEPARTURES_SCHEDULED`, `DEPARTURES_PERFORMED`, `PAYLOAD`, `FREIGHT`, `MAIL`, `RAMP_TO_RAMP`, `AIR_TIME`


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `YEAR, MONTH, UNIQUE_CARRIER, ORIGIN, DEST, AIRCRAFT_TYPE, AIRCRAFT_CONFIG, CLASS`: **1,739** extra rows (3,472 rows in duplicated-key groups)

- Key + DATA_SOURCE: 1,739 extra rows (so duplicates are not an artefact of DU/DF/IU/IF splitting)


#### Natural-key collisions (deep dive)


- Groups: 1,733 (sizes {2: 1727, 3: 6}); none are exact duplicates, but share carrier/route/aircraft/class/month.
- Measure columns that differ inside a group (groups): {'DEPARTURES_SCHEDULED': 223, 'DEPARTURES_PERFORMED': 1654, 'PAYLOAD': 1687, 'SEATS': 213, 'PASSENGERS': 238, 'FREIGHT': 1686, 'MAIL': 230, 'RAMP_TO_RAMP': 1730, 'AIR_TIME': 1722, 'DISTANCE': 0} -> they look like separate partial records for the same key (summing is the conventional treatment; dropping would lose passengers).
- Carriers involved: {'KAQ': 2896, 'UA': 472, 'N8': 46, 'L2': 32, 'WN': 12, 'NC': 8}; CLASS: {'P': 2978, 'F': 484, 'L': 10}
- Collision rows touching scope: 3,472; passenger-class (F/L) scope rows: 494; passengers in them: 2,513,808


Example colliding passenger rows in scope:

| YEAR | MONTH | UNIQUE_CARRIER | ORIGIN | DEST | AIRCRAFT_TYPE | AIRCRAFT_CONFIG | CLASS | DEPARTURES_PERFORMED | SEATS | PASSENGERS |
|---|---|---|---|---|---|---|---|---|---|---|
| 2019 | 1 | UA | SFO | EWR | 627 | 1 | F | 1 | 267.0 | 211.0 |
| 2019 | 1 | UA | SFO | EWR | 627 | 1 | F | 33.0 | 11,456 | 9,860 |
| 2019 | 1 | UA | SFO | IAD | 637 | 1 | F | 1 | 350.0 | 193.0 |
| 2019 | 1 | UA | SFO | IAD | 637 | 1 | F | 1 | 350.0 | 246.0 |
| 2019 | 1 | UA | SFO | IAH | 627 | 1 | F | 2 | 534.0 | 420.0 |
| 2019 | 1 | UA | SFO | IAH | 627 | 1 | F | 2 | 536.0 | 400.0 |


#### Rows per year


| 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| 85,748 | 61,359 | 79,108 | 89,683 | 91,637 | 96,213 | 95,173 | 53,144 |


- ORIGIN/DEST case/whitespace issues: {'ORIGIN': 0, 'DEST': 0}; distinct ORIGIN=1464, DEST=1477


#### Date coverage


- First month: 201901, latest month: **202607**; months present: 91; missing months in range: none

- Latest year **2026 is PARTIAL** (months [np.int64(1), np.int64(2), np.int64(3), np.int64(4), np.int64(5), np.int64(6), np.int64(7)]).

- Rows in last 6 months vs same months a year earlier: 202602: 7,358 (vs 7,477), 202603: 7,623 (vs 8,134), 202604: 7,275 (vs 7,577), 202605: 7,572 (vs 7,945), 202606: 7,719 (vs 8,199), 202607: 7,804 (vs 8,317)


#### CLASS breakdown per airport (origin basis, all years 2019-latest)


CLASS: F = scheduled pax/cargo, L = non-scheduled pax/cargo, G = scheduled all-cargo, P = non-scheduled all-cargo.


| ORIGIN | CLASS | rows | departures | seats | passengers | freight_lbs |
|---|---|---|---|---|---|---|
| BOS | F | 40,275 | 1,232,564 | 163,993,907 | 129,493,068 | 577,529,035 |
| BOS | G | 1,744 | 23,166 | 3,372 | 0 | 1,132,178,915 |
| BOS | L | 3,027 | 3,970 | 248,297 | 93,670 | 1,151,085 |
| BOS | P | 136 | 1,090 | 21.0 | 0 | 63,226,680 |
| BDL | F | 10,216 | 187,618 | 26,354,208 | 21,164,860 | 9,860,832 |
| BDL | G | 1,612 | 18,997 | 0 | 0 | 672,928,166 |
| BDL | L | 909 | 1,301 | 123,544 | 34,937 | 2,366,016 |
| BDL | P | 588 | 10,018 | 0 | 0 | 445,355,429 |
| PVD | F | 6,440 | 128,742 | 15,662,483 | 12,330,824 | 2,754,503 |
| PVD | G | 675 | 10,397 | 0 | 0 | 89,999,924 |
| PVD | L | 1,126 | 1,265 | 130,835 | 45,110 | 1,353,387 |
| PVD | P | 8 | 13.0 | 18.0 | 0 | 119,953 |
| MHT | F | 2,523 | 58,413 | 6,156,755 | 4,620,835 | 1,456,160 |
| MHT | G | 998 | 13,430 | 0 | 0 | 621,624,490 |
| MHT | L | 184 | 198.0 | 19,420 | 6,581 | 0 |
| MHT | P | 85 | 994.0 | 1,729 | 0 | 29,891,200 |
| PWM | F | 4,699 | 92,506 | 9,448,173 | 7,626,840 | 99,486 |
| PWM | G | 404 | 8,021 | 0 | 0 | 65,368,279 |
| PWM | L | 349 | 401.0 | 17,888 | 6,984 | 59.0 |
| PWM | P | 8 | 9 | 0 | 0 | 19,807 |
| BTV | F | 3,345 | 66,595 | 5,437,246 | 4,297,942 | 68,818 |
| BTV | G | 153 | 1,930 | 0 | 0 | 25,421,802 |
| BTV | L | 376 | 453.0 | 7,347 | 2,646 | 40.0 |
| BTV | P | 14 | 19.0 | 0 | 0 | 15,409 |
| LAX | F | 64,917 | 1,821,099 | 306,237,042 | 246,647,136 | 4,958,924,181 |
| LAX | G | 6,750 | 103,355 | 995,227 | 0 | 7,860,045,582 |
| LAX | L | 5,972 | 14,514 | 912,546 | 361,808 | 19,353,189 |
| LAX | P | 4,739 | 38,274 | 26,478 | 84.0 | 3,337,920,411 |
| SNA | F | 8,377 | 322,664 | 46,008,605 | 35,994,040 | 9,657,812 |
| SNA | G | 207 | 3,431 | 0 | 0 | 178,320,357 |
| SNA | L | 1,768 | 18,853 | 548,684 | 361,514 | 131,704 |
| BUR | F | 5,667 | 212,267 | 29,010,011 | 20,226,010 | 7,362,318 |
| BUR | G | 392 | 6,002 | 0 | 0 | 322,952,905 |
| BUR | L | 1,517 | 39,159 | 1,192,742 | 819,189 | 589,793 |
| BUR | P | 1 | 1 | 8 | 0 | 27.0 |
| LGB | F | 4,013 | 110,739 | 16,475,522 | 11,900,846 | 10,320 |
| LGB | G | 207 | 2,738 | 0 | 0 | 161,250,574 |
| LGB | L | 767 | 843.0 | 98,638 | 33,306 | 1,009,604 |
| LGB | P | 11 | 11.0 | 102.0 | 0 | 94,638 |
| ONT | F | 8,719 | 182,634 | 28,231,086 | 21,450,484 | 29,864,809 |
| ONT | G | 7,293 | 107,549 | 0 | 0 | 5,269,809,054 |
| ONT | L | 379 | 806.0 | 78,479 | 13,698 | 6,768,046 |
| ONT | P | 1,409 | 21,476 | 13,273 | 0 | 1,455,272,904 |
| ANC | F | 9,113 | 250,375 | 24,748,257 | 17,800,832 | 98,540,103 |
| ANC | G | 16,441 | 270,114 | 44,814 | 813.0 | 26,149,705,226 |
| ANC | L | 4,593 | 20,971 | 887,409 | 514,699 | 42,251,604 |
| ANC | P | 10,178 | 92,608 | 13,283 | 457.0 | 15,272,683,871 |
| FAI | F | 6,476 | 96,287 | 5,363,507 | 3,733,862 | 39,488,392 |
| FAI | G | 1,491 | 8,659 | 9,248 | 23.0 | 23,816,586 |
| FAI | L | 5,251 | 16,807 | 173,553 | 81,038 | 3,317,339 |
| FAI | P | 1,481 | 3,873 | 8,244 | 4 | 45,942,949 |
| SFO | F | 46,573 | 1,222,226 | 200,197,487 | 159,250,433 | 2,327,365,174 |
| SFO | G | 1,026 | 13,991 | 89,434 | 0 | 1,194,076,107 |
| SFO | L | 2,498 | 3,357 | 223,998 | 76,167 | 1,763,562 |
| SFO | P | 935 | 8,918 | 48.0 | 2 | 510,687,111 |
| OAK | F | 10,975 | 325,007 | 49,800,874 | 36,136,006 | 51,349,166 |
| OAK | G | 4,874 | 76,045 | 0 | 0 | 4,498,351,546 |
| OAK | L | 2,231 | 25,901 | 894,843 | 544,640 | 1,253,054 |
| OAK | P | 253 | 373.0 | 102.0 | 73.0 | 5,662,519 |
| SJC | F | 13,383 | 387,007 | 54,516,246 | 39,443,870 | 37,760,996 |
| SJC | G | 379 | 4,969 | 0 | 0 | 265,983,047 |
| SJC | L | 2,849 | 3,529 | 234,333 | 86,577 | 3,378,424 |
| SJC | P | 3 | 3 | 290.0 | 157.0 | 45,363 |


All rows by CLASS:

| CLASS | rows | departures | seats | passengers |
|---|---|---|---|---|
| F | 466,470 | 12,519,950 | 1,858,955,773 | 1,461,142,501 |
| G | 83,474 | 1,258,510 | 2,287,664 | 1,692 |
| L | 64,779 | 272,536 | 10,397,704 | 5,489,919 |
| P | 37,342 | 339,729 | 123,646 | 1,311 |


#### ANC: passenger vs cargo split (origin = ANC)


| YEAR | kind | rows | departures | passengers | freight_lbs |
|---|---|---|---|---|---|
| 2019 | cargo (G+P) | 3,261 | 39,690 | 30.0 | 4,437,505,048 |
| 2019 | passenger (F+L) | 1,693 | 37,674 | 2,702,781 | 18,714,300 |
| 2020 | cargo (G+P) | 3,544 | 48,692 | 98.0 | 5,487,000,537 |
| 2020 | passenger (F+L) | 1,328 | 21,580 | 1,132,206 | 14,199,017 |
| 2021 | cargo (G+P) | 3,405 | 51,267 | 46.0 | 6,125,038,621 |
| 2021 | passenger (F+L) | 1,685 | 32,874 | 2,165,844 | 17,472,075 |
| 2022 | cargo (G+P) | 3,446 | 49,468 | 285.0 | 5,518,823,707 |
| 2022 | passenger (F+L) | 1,841 | 35,702 | 2,565,471 | 26,027,182 |
| 2023 | cargo (G+P) | 3,438 | 46,594 | 101.0 | 5,176,965,498 |
| 2023 | passenger (F+L) | 2043 | 38,647 | 2,664,558 | 15,809,666 |
| 2024 | cargo (G+P) | 3,713 | 51,145 | 599.0 | 5,745,656,836 |
| 2024 | passenger (F+L) | 2093 | 42,816 | 2,736,915 | 26,676,297 |
| 2025 | cargo (G+P) | 3,821 | 49,820 | 108.0 | 5,800,390,314 |
| 2025 | passenger (F+L) | 1,894 | 38,168 | 2,714,251 | 13,614,817 |
| 2026 | cargo (G+P) | 1991 | 26,046 | 3 | 3,131,008,536 |
| 2026 | passenger (F+L) | 1,129 | 23,885 | 1,633,505 | 8,278,353 |


- Cargo share of ANC departures by year: {2019: 0.513, 2020: 0.693, 2021: 0.609, 2022: 0.581, 2023: 0.547, 2024: 0.544, 2025: 0.566, 2026: 0.522}

- Cargo-class ANC rows with passengers>0: 165 (passengers total 1,270) -> `CLASS` is the reliable filter; `PASSENGERS>0` alone is not enough.

- Passenger-class (F/L) ANC rows with 0 passengers: 1,570 of 13,706 (carry belly cargo / positioning or were scheduled-only; departures 2,697)

- Top ANC passenger-class carriers by departures (all years): Alaska Airlines Inc. (106,235), Grant Aviation (47,076), NEW PACIFIC AIRLINES (30,980), Horizon Air (18,160), Delta Air Lines Inc. (17,552), United Air Lines Inc. (8,090), KENAI AVIATION OPERATIONS, LLC (6,669), Iliamna Air Taxi (5,238)

- CLASS=F carriers at ANC with 0 passengers ever (cargo operators filed as F): Hageland Aviation Service (238 dep), Bidzy Ta Hot Aana, Inc. d/b/a Tanana Air Service (1 dep)


#### Row-level anomaly checks (all rows, and scope-touching passenger-class rows)


| check | rows (all) | pax in those rows (all) | rows (scope, F+L) | pax (scope, F+L) |
|---|---|---|---|---|
| seats=0 & passengers>0 | 178 | 354.0 | 0 | 0 |
| passengers > seats (seats>0) | 61 | 5,179 | 61 | 5,179 |
| passengers > 1.05×seats (seats>0) | 47 | 440.0 | 47 | 440.0 |
| departures_performed=0 & passengers>0 | 0 | 0 | 0 | 0 |
| departures_performed=0 & seats>0 | 0 | 0 | 0 | 0 |
| departures_performed=0 (all zero row, sched only) | 1,224 | 0 | 980 | 0 |
| departures_scheduled=0 & performed>0 | 210,029 | 211,318,599 | 146,965 | 211,317,198 |
| performed > scheduled (scheduled>0) | 21,831 | 71,204,302 | 19,317 | 71,204,302 |
| distance = 0 | 1938 | 11,085 | 1,057 | 11,085 |
| distance null | 0 | 0 | 0 | 0 |
| air_time=0 & performed>0 | 80,069 | 197,966,587 | 59,452 | 197,966,587 |
| seats/performed > 600 (implausible) | 0 | 0 | 0 | 0 |
| negative numerics | 0 | 0 | 0 | 0 |


Scope passenger-class rows total: 531,249


Worst passengers>seats rows in scope:

| YEAR | MONTH | UNIQUE_CARRIER | ORIGIN | DEST | AIRCRAFT_TYPE | DEPARTURES_PERFORMED | SEATS | PASSENGERS | lf |
|---|---|---|---|---|---|---|---|---|---|
| 2026 | 1 | Q5 | FAI | TKJ | 194 | 9 | 3 | 12.0 | 4 |
| 2025 | 10 | Q5 | FAI | TKJ | 194 | 7 | 3 | 7 | 2.33 |
| 2026 | 7 | Q5 | ORT | ANC | 194 | 1 | 3 | 4 | 1.33 |
| 2022 | 9 | 4W | FAI | HUS | 194 | 1 | 3 | 4 | 1.33 |
| 2019 | 9 | 8V | RBY | FAI | 194 | 1 | 3 | 4 | 1.33 |
| 2020 | 9 | 8V | RBY | FAI | 194 | 1 | 5 | 6 | 1.2 |
| 2026 | 5 | RVQ | VDZ | ANC | 406 | 1 | 6 | 7 | 1.17 |
| 2025 | 6 | 3EQ | LAS | SNA | 639 | 1 | 6 | 7 | 1.17 |
| 2025 | 11 | 3EQ | SJC | C01 | 639 | 1 | 6 | 7 | 1.17 |
| 2022 | 10 | 8V | RBY | FAI | 194 | 2 | 6 | 7 | 1.17 |


Distance=0 rows: carriers {'OO': 385, '5Y': 271, '4W': 192, '8V': 147, '7S': 130}; CLASS {'F': 757, 'P': 613, 'L': 300, 'G': 268}; pairs e.g. {('ANC', 'ANC'): 786, ('FAI', 'FAI'): 393, ('LAX', 'LAX'): 259, ('SFO', 'SFO'): 113, ('ONT', 'ONT'): 94}


#### Load factor (passengers/seats), passenger-class F+L, origin basis, rows with seats>0 & departures>0


Row-level LF quantiles (rows are carrier x route x aircraft x month, unweighted) plus seat-weighted aggregate.


| ORIGIN | count | min | 5% | 50% | 95% | max | agg LF (all yrs) | rows LF>1 | rows LF<0.2 |
|---|---|---|---|---|---|---|---|---|---|
| BOS | 43,059 | 0 | 0.21 | 0.807 | 0.963 | 1 | 0.789 | 0 | 2056 |
| BDL | 11,064 | 0 | 0.134 | 0.821 | 0.968 | 1.01 | 0.801 | 1 | 651 |
| PVD | 7,529 | 0 | 0 | 0.79 | 0.959 | 1 | 0.784 | 0 | 669 |
| MHT | 2,702 | 0 | 0.136 | 0.777 | 0.954 | 1.12 | 0.749 | 1 | 155 |
| PWM | 5,015 | 0 | 0.211 | 0.825 | 0.97 | 1 | 0.806 | 0 | 238 |
| BTV | 3,712 | 0 | 0.125 | 0.804 | 0.97 | 1 | 0.79 | 0 | 262 |
| LAX | 70,455 | 0 | 0.18 | 0.821 | 0.961 | 1.08 | 0.804 | 6 | 3,766 |
| SNA | 10,118 | 0 | 0.077 | 0.793 | 0.953 | 1.17 | 0.781 | 2 | 775 |
| BUR | 7,160 | 0 | 0 | 0.727 | 0.944 | 1 | 0.697 | 0 | 756 |
| LGB | 4,776 | 0 | 0 | 0.734 | 0.949 | 1 | 0.72 | 0 | 395 |
| ONT | 9,059 | 0 | 0.203 | 0.8 | 0.961 | 1 | 0.758 | 0 | 448 |
| ANC | 13,485 | 0 | 0 | 0.583 | 0.935 | 1.11 | 0.714 | 1 | 2,204 |
| FAI | 11,527 | 0 | 0 | 0.395 | 0.889 | 4 | 0.689 | 10.0 | 2,980 |
| SFO | 48,987 | 0 | 0.2 | 0.813 | 0.961 | 1.17 | 0.795 | 3 | 2,444 |
| OAK | 13,176 | 0 | 0.077 | 0.735 | 0.947 | 1.12 | 0.724 | 1 | 985 |
| SJC | 16,178 | 0 | 0.047 | 0.726 | 0.949 | 1.17 | 0.722 | 4 | 1,532 |


Seat-weighted annual LF (origin basis):

| ORIGIN | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 0.819 | 0.52 | 0.751 | 0.785 | 0.833 | 0.831 | 0.816 | 0.801 |
| BDL | 0.825 | 0.557 | 0.822 | 0.817 | 0.85 | 0.825 | 0.8 | 0.808 |
| PVD | 0.833 | 0.548 | 0.821 | 0.794 | 0.824 | 0.799 | 0.778 | 0.772 |
| MHT | 0.807 | 0.51 | 0.774 | 0.753 | 0.803 | 0.783 | 0.76 | 0.726 |
| PWM | 0.858 | 0.585 | 0.778 | 0.819 | 0.843 | 0.833 | 0.824 | 0.794 |
| BTV | 0.812 | 0.56 | 0.794 | 0.778 | 0.852 | 0.798 | 0.813 | 0.792 |
| LAX | 0.848 | 0.585 | 0.73 | 0.833 | 0.839 | 0.842 | 0.816 | 0.828 |
| SNA | 0.845 | 0.553 | 0.711 | 0.797 | 0.831 | 0.801 | 0.797 | 0.792 |
| BUR | 0.748 | 0.479 | 0.683 | 0.686 | 0.718 | 0.732 | 0.713 | 0.713 |
| LGB | 0.794 | 0.45 | 0.651 | 0.766 | 0.76 | 0.729 | 0.714 | 0.762 |
| ONT | 0.821 | 0.566 | 0.759 | 0.795 | 0.782 | 0.779 | 0.748 | 0.735 |
| ANC | 0.752 | 0.528 | 0.671 | 0.734 | 0.752 | 0.742 | 0.736 | 0.725 |
| FAI | 0.682 | 0.513 | 0.651 | 0.733 | 0.75 | 0.731 | 0.695 | 0.69 |
| SFO | 0.821 | 0.536 | 0.714 | 0.821 | 0.832 | 0.832 | 0.823 | 0.819 |
| OAK | 0.788 | 0.483 | 0.724 | 0.752 | 0.743 | 0.75 | 0.731 | 0.729 |
| SJC | 0.777 | 0.475 | 0.693 | 0.748 | 0.753 | 0.757 | 0.741 | 0.713 |


Monthly LF extremes (min/max month) for SFO/LAX/ANC: ANC: min 202004 = 0.25, max 201908 = 0.82; LAX: min 202004 = 0.19, max 202206 = 0.91; SFO: min 202004 = 0.14, max 202406 = 0.91


- In-scope origin passenger rows with LF>1: 29 of 278,002 (0.01 %); LF>1.5: 2


#### Scope membership of rows (origin in scope / dest in scope / both)


| scope_side | rows | departures | seats | passengers | rows % | pax % |
|---|---|---|---|---|---|---|
| both | 32,139 | 996,416 | 118,202,420 | 85,739,495 | 4.9 | 5.8 |
| dest only | 308,063 | 6,691,180 | 877,125,131 | 691,433,358 | 47.2 | 47.1 |
| origin only | 311,863 | 6,703,129 | 876,437,236 | 689,462,570 | 47.8 | 47.0 |


- Rows where neither end is in scope: 0 (should be 0).

- Both-in-scope rows would be counted twice if summing passengers over `ORIGIN in scope` + `DEST in scope`: 32,139 rows, 85,739,495 passengers (5.8 % of scope pax). Pairs: {('LAX', 'SFO'): 9138774.0, ('SFO', 'LAX'): 9053169.0, ('LAX', 'BOS'): 4270002.0, ('SFO', 'BOS'): 4198328.0, ('BOS', 'LAX'): 4167412.0, ('BOS', 'SFO'): 4104667.0}

- Rule of thumb: define airport passengers as `ORIGIN`-basis (enplaned) OR `DEST`-basis (deplaned), never the sum of both. T-100 enplaned vs deplaned symmetry check follows.


Enplaned vs deplaned passengers, F+L, all years:

|  | enplaned (origin) | deplaned (dest) | dest/origin |
|---|---|---|---|
| BOS | 129,586,738 | 130,368,075 | 1.01 |
| BDL | 21,199,797 | 21,259,903 | 1 |
| PVD | 12,375,934 | 12,382,046 | 1 |
| MHT | 4,627,416 | 4,645,813 | 1 |
| PWM | 7,633,824 | 7,599,112 | 0.995 |
| BTV | 4,300,588 | 4,294,977 | 0.999 |
| LAX | 247,008,944 | 246,570,392 | 0.998 |
| SNA | 36,355,554 | 36,627,248 | 1.01 |
| BUR | 21,045,199 | 21,132,375 | 1 |
| LGB | 11,934,152 | 11,954,284 | 1 |
| ONT | 21,464,182 | 21,519,249 | 1 |
| ANC | 18,315,531 | 18,390,838 | 1 |
| FAI | 3,814,900 | 3,856,668 | 1.01 |
| SFO | 159,326,600 | 160,138,449 | 1 |
| OAK | 36,680,646 | 36,805,791 | 1 |
| SJC | 39,530,447 | 39,626,167 | 1 |


#### Enplaned passengers per airport per year (origin basis, F+L)


| ORIGIN | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 20,742,138 | 6,050,302 | 10,938,231 | 17,472,973 | 19,993,899 | 21,305,085 | 21,143,295 | 11,940,815 |
| BDL | 3,341,910 | 1,164,625 | 2,281,061 | 2,854,746 | 3,130,606 | 3,299,417 | 3,289,186 | 1,838,246 |
| PVD | 1,974,726 | 655,514 | 1,163,245 | 1,579,382 | 1,737,985 | 1,990,715 | 2,122,707 | 1,151,660 |
| MHT | 855,119 | 315,082 | 479,526 | 647,293 | 645,845 | 634,256 | 686,314 | 363,981 |
| PWM | 1,089,427 | 405,919 | 854,147 | 987,750 | 1,114,964 | 1,222,400 | 1,287,476 | 671,741 |
| BTV | 686,852 | 212,133 | 382,221 | 603,802 | 650,078 | 670,834 | 709,116 | 385,552 |
| LAX | 43,381,757 | 14,200,828 | 23,771,668 | 32,758,584 | 37,119,934 | 38,249,501 | 36,778,508 | 20,748,164 |
| SNA | 5,216,290 | 1,854,719 | 3,872,628 | 5,602,315 | 5,725,328 | 5,388,351 | 5,532,646 | 3,163,277 |
| BUR | 3,184,417 | 1,096,713 | 2,033,142 | 3,191,549 | 3,217,001 | 3,395,510 | 3,222,436 | 1,704,431 |
| LGB | 1,753,918 | 523,195 | 1,111,524 | 1,692,973 | 1,923,300 | 2,061,417 | 1,889,338 | 978,487 |
| ONT | 2,780,468 | 1,269,415 | 2,252,046 | 2,899,421 | 3,238,633 | 3,530,729 | 3,497,552 | 1,995,918 |
| ANC | 2,702,781 | 1,132,206 | 2,165,844 | 2,565,471 | 2,664,558 | 2,736,915 | 2,714,251 | 1,633,505 |
| FAI | 583,424 | 241,767 | 459,730 | 514,225 | 551,426 | 574,396 | 563,572 | 326,360 |
| SFO | 27,877,799 | 7,780,922 | 11,750,704 | 20,529,260 | 24,342,269 | 25,301,280 | 26,488,386 | 15,255,980 |
| OAK | 6,769,889 | 2,362,365 | 4,083,142 | 5,645,177 | 5,641,399 | 5,347,249 | 4,561,915 | 2,269,510 |
| SJC | 7,802,358 | 2,348,598 | 3,671,405 | 5,736,656 | 6,094,853 | 5,865,922 | 5,283,980 | 2,726,675 |


Same-window comparison (Jan-07 of each year, enplaned):

| ORIGIN | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 11,854,321 | 4,242,973 | 4,980,503 | 9,522,866 | 11,320,127 | 11,991,457 | 12,135,213 | 11,940,815 |
| BDL | 1,947,648 | 802,040 | 1,112,571 | 1,593,779 | 1,819,172 | 1,870,943 | 1,921,042 | 1,838,246 |
| PVD | 1,120,220 | 441,129 | 563,762 | 883,415 | 964,172 | 1,088,231 | 1,199,717 | 1,151,660 |
| MHT | 488,019 | 206,031 | 216,609 | 358,546 | 368,620 | 349,035 | 382,665 | 363,981 |
| PWM | 590,185 | 229,405 | 399,823 | 509,819 | 574,030 | 625,404 | 676,862 | 671,741 |
| BTV | 385,056 | 146,297 | 157,686 | 330,800 | 364,414 | 350,988 | 394,004 | 385,552 |
| LAX | 25,411,767 | 9,499,071 | 11,656,584 | 18,348,567 | 21,285,636 | 22,191,346 | 21,487,101 | 20,748,164 |
| SNA | 3,071,314 | 1,199,200 | 1,775,018 | 3,127,052 | 3,366,418 | 3,169,596 | 3,168,852 | 3,163,277 |
| BUR | 1,750,056 | 771,049 | 822,255 | 1,804,407 | 1,806,797 | 1,901,422 | 1,862,113 | 1,704,431 |
| LGB | 993,297 | 383,549 | 528,069 | 967,943 | 1,080,774 | 1,224,859 | 1,085,071 | 978,487 |
| ONT | 1,538,090 | 769,392 | 1,068,887 | 1,608,180 | 1,808,594 | 1,998,096 | 1,990,243 | 1,995,918 |
| ANC | 1,532,152 | 663,147 | 1,154,872 | 1,462,478 | 1,529,024 | 1,586,933 | 1,566,996 | 1,633,505 |
| FAI | 328,626 | 150,100 | 242,708 | 290,271 | 309,765 | 325,227 | 323,626 | 326,360 |
| SFO | 16,089,912 | 5,475,940 | 5,217,993 | 11,082,076 | 13,745,606 | 14,232,438 | 15,255,761 | 15,255,980 |
| OAK | 3,890,057 | 1,518,350 | 2,057,825 | 3,113,258 | 3,263,924 | 3,209,860 | 2,686,174 | 2,269,510 |
| SJC | 4,398,520 | 1,667,868 | 1,703,665 | 3,117,447 | 3,514,306 | 3,347,748 | 3,073,200 | 2,726,675 |


Recovery vs 2019 (same months):

| ORIGIN | Jan-Jul 2019 | Jan-Jul 2026 | vs 2019 % |
|---|---|---|---|
| BOS | 11,854,321 | 11,940,815 | 0.7 |
| BDL | 1,947,648 | 1,838,246 | -5.6 |
| PVD | 1,120,220 | 1,151,660 | 2.8 |
| MHT | 488,019 | 363,981 | -25.4 |
| PWM | 590,185 | 671,741 | 13.8 |
| BTV | 385,056 | 385,552 | 0.1 |
| LAX | 25,411,767 | 20,748,164 | -18.4 |
| SNA | 3,071,314 | 3,163,277 | 3 |
| BUR | 1,750,056 | 1,704,431 | -2.6 |
| LGB | 993,297 | 978,487 | -1.5 |
| ONT | 1,538,090 | 1,995,918 | 29.8 |
| ANC | 1,532,152 | 1,633,505 | 6.6 |
| FAI | 328,626 | 326,360 | -0.7 |
| SFO | 16,089,912 | 15,255,980 | -5.2 |
| OAK | 3,890,057 | 2,269,510 | -41.7 |
| SJC | 4,398,520 | 2,726,675 | -38.0 |


Latest month (202607) vs same month prior year:

| ORIGIN | 202607 pax | 202507 pax | YoY % |
|---|---|---|---|
| BOS | 2,013,353 | 2,029,229 | -0.8 |
| BDL | 292,187 | 302,368 | -3.4 |
| PVD | 187,502 | 197,685 | -5.2 |
| MHT | 57,974 | 65,354 | -11.3 |
| PWM | 158,989 | 154,620 | 2.8 |
| BTV | 68,612 | 71,828 | -4.5 |
| LAX | 3,304,845 | 3,533,343 | -6.5 |
| SNA | 486,619 | 512,450 | -5 |
| BUR | 256,355 | 284,996 | -10.0 |
| LGB | 147,448 | 168,727 | -12.6 |
| ONT | 320,946 | 332,396 | -3.4 |
| ANC | 393,566 | 371,245 | 6 |
| FAI | 61,987 | 62,860 | -1.4 |
| SFO | 2,444,332 | 2,510,801 | -2.6 |
| OAK | 351,437 | 405,884 | -13.4 |
| SJC | 457,914 | 491,331 | -6.8 |


#### Coverage grid: airport x year-month (origin, F+L, passengers>0)


Grid is 16 airports x 91 months = 1456 cells; cells with no rows: 0.


Gaps (every missing airport-month): none


Rows per airport per year (origin side, all classes):

| ORIGIN | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 5,894 | 3,749 | 4,676 | 6,251 | 6,483 | 7,147 | 7,009 | 3,973 |
| BDL | 1,766 | 1,237 | 1,551 | 1,864 | 1,875 | 1996 | 1964 | 1,072 |
| PVD | 1,056 | 662 | 874 | 1,154 | 1,151 | 1,217 | 1,346 | 789 |
| MHT | 473 | 393 | 439 | 525 | 520 | 525 | 594 | 321 |
| PWM | 748 | 467 | 716 | 691 | 704 | 829 | 845 | 460 |
| BTV | 589 | 300 | 416 | 550 | 513 | 595 | 612 | 313 |
| LAX | 11,155 | 7,823 | 10,400 | 11,321 | 11,546 | 11,903 | 11,752 | 6,478 |
| SNA | 1,087 | 742 | 1,449 | 1,695 | 1,518 | 1,440 | 1,486 | 935 |
| BUR | 954 | 584 | 1,057 | 1,125 | 1,005 | 1,147 | 1,107 | 598 |
| LGB | 420 | 306 | 641 | 700 | 783 | 895 | 834 | 419 |
| ONT | 1955 | 1,860 | 2,434 | 2,383 | 2,400 | 2,657 | 2,666 | 1,445 |
| ANC | 4,954 | 4,872 | 5,090 | 5,287 | 5,481 | 5,806 | 5,715 | 3,120 |
| FAI | 1944 | 1,673 | 2,115 | 2047 | 1,841 | 1907 | 1998 | 1,174 |
| SFO | 7,317 | 4,273 | 5,084 | 6,624 | 7,285 | 7,844 | 7,943 | 4,662 |
| OAK | 2,689 | 2005 | 2,650 | 2,730 | 2,556 | 2,368 | 2,223 | 1,112 |
| SJC | 2,474 | 1,389 | 1989 | 2,358 | 2,422 | 2,459 | 2,229 | 1,294 |


#### ANC long-haul sensitivity: share of passenger-class (F+L) departures by distance threshold


| threshold (mi) | dep share % | 2019 % | 2024 % | 2025 % |
|---|---|---|---|---|
| >= 500 | 48.8 | 46.9 | 46.1 | 50.8 |
| >= 1000 | 34.0 | 32.6 | 32.3 | 36.2 |
| >= 1500 | 14.3 | 13.0 | 13.9 | 17.7 |
| >= 2000 | 11.9 | 10.1 | 11.7 | 13.8 |
| >= 2500 | 8.2 | 6.9 | 8.2 | 9.8 |
| >= 3000 | 2.2 | 1.5 | 2.4 | 2.8 |


Departure share by DISTANCE_GROUP (1 = <500 mi, 500-mi bins): 1: 51.2 %, 2: 14.8 %, 3: 19.7 %, 4: 2.4 %, 5: 3.7 %, 6: 6.0 %, 7: 1.8 %, 8: 0.1 %, 9: 0.1 %, 10: 0.2 %, 11: 0.1 %, 12: 0.0 %, 13: 0.0 %, 14: 0.0 %, 15: 0.0 %


Top ANC destinations (F+L departures, all years): ENA (62,327, 59 mi), SEA (51,434, 1,448 mi), FAI (19,399, 261 mi), JNU (8,790, 571 mi), HOM (8,459, 117 mi), AKN (8,429, 288 mi), BET (7,191, 399 mi), SCC (7,148, 626 mi), ADQ (6,882, 253 mi), PDX (6,451, 1,542 mi)

- Route pairs with >1 distinct DISTANCE value: 333 (distance should be constant per pair)

- ANC pax departures by DATA_SOURCE: {'DF': 136.0, 'DU': 269200.0, 'IF': 1760.0, 'IU': 250.0} (international legs likely to Asia: long-haul)

- Rows where DISTANCE_GROUP != ceil(DISTANCE/500): 50 of 650,127


#### SFO (origin, F+L): scheduled vs performed departures and LF


| YEAR | sched | perf | seats | pax | perf/sched | LF |
|---|---|---|---|---|---|---|
| 2019 | 191,152 | 210,958 | 33,970,786 | 27,877,799 | 1.1 | 0.821 |
| 2020 | 98,251 | 100,243 | 14,516,929 | 7,780,922 | 1.02 | 0.536 |
| 2021 | 105,844 | 113,252 | 16,447,467 | 11,750,704 | 1.07 | 0.714 |
| 2022 | 141,636 | 156,305 | 25,009,553 | 20,529,260 | 1.1 | 0.821 |
| 2023 | 154,329 | 172,983 | 29,240,811 | 24,342,269 | 1.12 | 0.832 |
| 2024 | 154,752 | 175,220 | 30,403,268 | 25,301,280 | 1.13 | 0.832 |
| 2025 | 167,178 | 187,766 | 32,201,977 | 26,488,386 | 1.12 | 0.823 |
| 2026 | 98,723 | 108,856 | 18,630,694 | 15,255,980 | 1.1 | 0.819 |


- Scheduled/performed ratio (all years, F+L) by airport: {'BOS': 0.95, 'BDL': 0.99, 'PVD': 1.01, 'MHT': 1.02, 'PWM': 1.03, 'BTV': 1.02, 'LAX': 0.86, 'SNA': 0.95, 'BUR': 0.87, 'LGB': 1.0, 'ONT': 0.97, 'ANC': 0.77, 'FAI': 0.71, 'SFO': 0.91, 'OAK': 0.9, 'SJC': 0.98}; if scheduled is mostly 0 for some carriers/airports, `DEPARTURES_SCHEDULED` is not a usable cancellation proxy.

- Scope F+L rows with performed>0 and scheduled=0: 77,205 of 278,954 (27.7 %)


### Anything surprising (BTS T-100 Segment)

| Flag | Classification | Reasoning |
|---|---|---|
| Max/p95 > 10x on DEPARTURES, PAYLOAD, FREIGHT, MAIL, RAMP_TO_RAMP, AIR_TIME | **REAL EXTREME** | Rows are carrier x route x aircraft x month aggregates; cargo hubs (ANC, ONT, OAK, LAX) and big carriers legitimately dwarf the median thin route. Not an error. |
| April 2020 LF 0.14-0.25 at SFO/LAX/ANC; passengers -70 % | **REAL EXTREME** | COVID. Keep, but exclude 2020-21 from "normal" baselines. |
| Passengers > seats (61 rows in scope, 5,179 pax; worst LF 4.0 on a 3-seat air-taxi FAI-TKJ) | **likely DATA ERROR** (immaterial) | Tiny commuter aircraft (types 194/406/639) with 1-6 seats; LF>1 is impossible. Only 47 rows exceed 1.05. Flag, do not distort aggregates. |
| seats = 0 and passengers > 0 | **likely DATA ERROR** | 178 rows in the whole file (354 pax), **0 in passenger-class scope rows**. Immaterial. |
| Departures_performed = 0, all measures 0 | **LIKELY ARTEFACT** | 980 scope passenger-class rows are schedule-only placeholders (no seats, no pax). Harmless for sums, harmful for row-level averages. |
| Distance = 0 (1,938 rows, 1,938 with ORIGIN=DEST) | **REAL** but unusable for distance | All of them have ORIGIN=DEST: local/sightseeing or positioning flights (ANC-ANC, FAI-FAI, LAX-LAX). Must be excluded from long-haul calculations. |
| 333 route pairs with more than one DISTANCE value; 50 rows where DISTANCE_GROUP differs from ceil(DISTANCE/500) | **likely DATA ERROR** (minor) | Distance should be constant per pair; probably airport-code reuse/changes over time. Immaterial to shares. |
| Natural-key collisions (1,739 extra rows) | **LIKELY ARTEFACT** | Different measure values for same key, so they are separate partial records. Passenger-class collisions carry 2,513,808 passengers; dropping them would lose real traffic. |
| `DEPARTURES_SCHEDULED` = 0 while performed > 0 on 27.7 % of flown passenger rows; performed > scheduled | **LIKELY ARTEFACT** | Scheduled is only reported for some carriers/filing types. Not usable. |

Other surprises:
- ANC: cargo (G+P) is **57.2 % of all ANC departures**. Passenger-class ANC traffic is dominated by Alaska Airlines and small Alaska bush carriers (Grant, New Pacific, Kenai, Iliamna), and 51 % of passenger departures are under 500 miles.
- ANC passengers > 0 on 165 cargo-class rows (1,270 pax): `CLASS` is the reliable filter.
- The latest month (2026-07) is complete in row count (7,804 rows vs 8,317 a year earlier) but passenger counts are 1-13 % below July 2025 at 13 of 16 airports (OAK -13 %, LGB -13 %, MHT -11 %); treat as real softness, not missing data, but confirm with later revisions (BTS can restate recent months).
- OAK and SJC are structurally down: Jan-Jul 2026 enplanements are -42 % and -38 % vs Jan-Jul 2019; ONT is +30 %.

## 3. BTS On-Time Performance

**Shape:** 10,165,946 rows x 35 columns | 8 files, total 306.6 MB (gzip)


#### Schema (dtype, nulls, distinct, low-cardinality values)


|  | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| Year | int32 | 0 | 0 | 8 | 2019=1,588,475, 2024=1,419,055, 2023=1,414,381, 2025=1,414,305, 2022=1,405,865, 2021=1,111,267, 2026=941,294, 2020=871,304 |
| Month | int32 | 0 | 0 | 12 | 7=960,506, 8=958,942, 3=916,251, 6=894,126, 5=861,150, 1=849,806, 4=840,796, 10=800,898, 2=791,822, 9=768,729, 12=765,756, 11=757,164 |
| FlightDate | category | 0 | 0 | 2,800 |  |
| Reporting_Airline | category | 0 | 0 | 18 | WN=2,258,464, UA=1,344,839, OO=1,270,188, DL=1,225,086, AA=1,165,359, B6=869,410, AS=755,375, YX=429,410, NK=266,497, F9=150,413, OH=113,231, 9E=75,930, HA=74,757, G4=46,048, QX=42,822, MQ=42,749, YV=29,708, EV=5,660 |
| Flight_Number_Reporting_Airline | int32 | 0 | 0 | 7,026 |  |
| Origin | category | 0 | 0 | 188 |  |
| OriginCityName | category | 0 | 0 | 182 |  |
| OriginState | category | 0 | 0 | 50 |  |
| Dest | category | 0 | 0 | 187 |  |
| DestCityName | category | 0 | 0 | 181 |  |
| DestState | category | 0 | 0 | 50 |  |
| CRSDepTime | category | 0 | 0 | 1,367 |  |
| DepTime | category | 188,800 | 1.86 | 1,440 |  |
| DepDelay | float32 | 188,897 | 1.86 | 1,810 |  |
| DepDel15 | float32 | 188,897 | 1.86 | 2 | 0.0=8,024,240, 1.0=1,952,809, <NA>=188,897 |
| TaxiOut | float32 | 192,453 | 1.89 | 201 |  |
| WheelsOff | category | 192,453 | 1.89 | 1,440 |  |
| WheelsOn | category | 196,774 | 1.94 | 1,440 |  |
| TaxiIn | float32 | 196,774 | 1.94 | 229 |  |
| CRSArrTime | category | 0 | 0 | 1,438 |  |
| ArrTime | category | 196,761 | 1.94 | 1,440 |  |
| ArrDelay | float32 | 214,883 | 2.11 | 1,832 |  |
| ArrDel15 | float32 | 214,883 | 2.11 | 2 | 0.0=8,041,522, 1.0=1,909,541, <NA>=214,883 |
| Cancelled | float32 | 0 | 0 | 2 | 0.0=9,972,395, 1.0=193,551 |
| CancellationCode | category | 9,972,395 | 98.1 | 4 | <NA>=9,972,395, A=66,978, B=63,205, D=43,832, C=19,536 |
| Diverted | float32 | 0 | 0 | 2 | 0.0=10,144,615, 1.0=21,331 |
| CRSElapsedTime | float32 | 6 | 0 | 498 |  |
| ActualElapsedTime | float32 | 214,883 | 2.11 | 718 |  |
| AirTime | float32 | 214,883 | 2.11 | 658 |  |
| Distance | float32 | 0 | 0 | 679 |  |
| CarrierDelay | float32 | 8,256,406 | 81.2 | 1,605 |  |
| WeatherDelay | float32 | 8,256,406 | 81.2 | 1,034 |  |
| NASDelay | float32 | 8,256,406 | 81.2 | 879 |  |
| SecurityDelay | float32 | 8,256,406 | 81.2 | 240 |  |
| LateAircraftDelay | float32 | 8,256,406 | 81.2 | 1,266 |  |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| DepDelay | -115.0 | -10.0 | -2 | 74.0 | 3,239 | 10.8 | 49.1 | FLAG |
| DepDel15 | 0 | 0 | 0 | 1 | 1 | 0.196 | 0.397 |  |
| TaxiOut | 1 | 8 | 15.0 | 33.0 | 256.0 | 17.4 | 9.12 |  |
| TaxiIn | 1 | 3 | 6 | 19.0 | 380.0 | 7.85 | 6.55 | FLAG |
| ArrDelay | -128.0 | -29.0 | -7 | 72.0 | 3,240 | 4.14 | 51.0 | FLAG |
| ArrDel15 | 0 | 0 | 0 | 1 | 1 | 0.192 | 0.394 |  |
| Cancelled | 0 | 0 | 0 | 0 | 1 | 0.019 | 0.137 |  |
| Diverted | 0 | 0 | 0 | 0 | 1 | 0.0021 | 0.0458 |  |
| CRSElapsedTime | -99.0 | 72.0 | 144.0 | 352.0 | 1,358 | 172.7 | 93.1 |  |
| ActualElapsedTime | 20.0 | 64.0 | 138.0 | 345.0 | 795.0 | 166.3 | 92.7 |  |
| AirTime | 13.0 | 43.0 | 113.0 | 315.0 | 727.0 | 141.1 | 90.2 |  |
| Distance | 18.0 | 223.0 | 834.0 | 2,537 | 5,812 | 1,054 | 771.4 |  |
| CarrierDelay | 0 | 0 | 3 | 100.0 | 3,239 | 23.6 | 69.9 | FLAG |
| WeatherDelay | 0 | 0 | 0 | 0 | 1,765 | 2.52 | 25.4 | FLAG |
| NASDelay | 0 | 0 | 0 | 62.0 | 1,496 | 14.2 | 32.3 | FLAG |
| SecurityDelay | 0 | 0 | 0 | 0 | 1,185 | 0.136 | 3.43 | FLAG |
| LateAircraftDelay | 0 | 0 | 0 | 116.0 | 2,506 | 25.7 | 55.5 | FLAG |


**Flagged (max > 10x p95):** `DepDelay`, `TaxiIn`, `ArrDelay`, `CarrierDelay`, `WeatherDelay`, `NASDelay`, `SecurityDelay`, `LateAircraftDelay`


#### Date coverage


- Range: 2019-01-01 -> 2026-08-31; unparseable dates: 0; Year/Month vs FlightDate mismatches: 0
- Months present: 92; missing months in range: none; latest year 2026 is PARTIAL (through month 8).

- Months with fewer distinct flight dates than calendar days: none


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `FlightDate, Reporting_Airline, Flight_Number_Reporting_Airline, Origin, Dest, CRSDepTime`: **0** extra rows (0 rows in duplicated-key groups)

- Origin/Dest case/whitespace issues: {'Origin': 0, 'Dest': 0}


#### Scope membership of rows


|  | rows | % |
|---|---|---|
| origin only | 4,656,274 | 45.8 |
| dest only | 4,656,233 | 45.8 |
| both | 853,439 | 8.4 |


A flight with both ends in scope appears once in this file, but is relevant to two airports (a departure for one and an arrival for the other): count departures by `Origin`, arrivals by `Dest`.


#### Flights per airport per year


Departures (Origin = airport):

| Origin | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 150,564 | 74,276 | 90,118 | 136,476 | 140,517 | 143,490 | 142,859 | 97,297 |
| BDL | 28,700 | 16,320 | 19,928 | 23,490 | 21,658 | 22,302 | 23,108 | 14,707 |
| PVD | 18,159 | 9,449 | 10,549 | 15,282 | 14,373 | 14,850 | 15,528 | 10,264 |
| MHT | 8,142 | 5,270 | 4,904 | 6,701 | 6,275 | 5,650 | 5,979 | 3,956 |
| PWM | 11,151 | 6,705 | 9,603 | 10,772 | 10,972 | 11,674 | 10,750 | 7,247 |
| BTV | 9,637 | 4,231 | 4,908 | 8,216 | 7,812 | 8,122 | 6,551 | 4,149 |
| LAX | 219,952 | 124,168 | 174,318 | 191,156 | 194,353 | 194,053 | 190,472 | 127,251 |
| SNA | 40,754 | 23,706 | 36,832 | 47,132 | 44,898 | 43,519 | 44,997 | 30,008 |
| BUR | 31,905 | 17,782 | 19,539 | 31,170 | 29,757 | 30,636 | 30,685 | 19,569 |
| LGB | 15,818 | 8,723 | 12,140 | 15,634 | 16,502 | 17,650 | 16,724 | 9,476 |
| ONT | 22,608 | 16,051 | 20,141 | 23,571 | 24,324 | 26,175 | 26,162 | 17,033 |
| ANC | 18,988 | 12,208 | 19,333 | 20,424 | 17,850 | 18,543 | 18,860 | 14,352 |
| FAI | 4,723 | 2,543 | 4,678 | 4,634 | 3,049 | 3,452 | 3,759 | 2,981 |
| SFO | 170,918 | 89,394 | 98,791 | 129,949 | 135,705 | 134,978 | 144,495 | 99,931 |
| OAK | 53,069 | 31,211 | 35,256 | 47,660 | 45,955 | 41,369 | 34,591 | 20,498 |
| SJC | 62,946 | 33,566 | 38,148 | 53,309 | 52,028 | 50,392 | 45,902 | 28,290 |


Arrivals (Dest = airport):

| Dest | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 150,554 | 74,298 | 90,101 | 136,479 | 140,523 | 143,491 | 142,850 | 97,309 |
| BDL | 28,701 | 16,324 | 19,931 | 23,486 | 21,655 | 22,304 | 23,111 | 14,708 |
| PVD | 18,156 | 9,453 | 10,552 | 15,285 | 14,373 | 14,850 | 15,529 | 10,263 |
| MHT | 8,136 | 5,273 | 4,904 | 6,704 | 6,273 | 5,650 | 5,981 | 3,957 |
| PWM | 11,144 | 6,706 | 9,604 | 10,774 | 10,969 | 11,676 | 10,746 | 7,253 |
| BTV | 9,639 | 4,229 | 4,913 | 8,216 | 7,814 | 8,121 | 6,552 | 4,149 |
| LAX | 219,996 | 124,197 | 174,235 | 191,163 | 194,374 | 194,044 | 190,499 | 127,228 |
| SNA | 40,802 | 23,722 | 36,831 | 47,131 | 44,903 | 43,520 | 44,995 | 30,010 |
| BUR | 31,907 | 17,775 | 19,550 | 31,177 | 29,756 | 30,636 | 30,685 | 19,573 |
| LGB | 15,817 | 8,725 | 12,143 | 15,635 | 16,503 | 17,652 | 16,724 | 9,475 |
| ONT | 22,613 | 16,052 | 20,143 | 23,574 | 24,324 | 26,172 | 26,167 | 17,031 |
| ANC | 18,990 | 12,205 | 19,331 | 20,427 | 17,850 | 18,545 | 18,867 | 14,356 |
| FAI | 4,724 | 2,541 | 4,680 | 4,634 | 3,051 | 3,453 | 3,759 | 2,981 |
| SFO | 170,966 | 89,423 | 98,781 | 129,964 | 135,710 | 135,075 | 144,519 | 100,072 |
| OAK | 53,023 | 31,207 | 35,263 | 47,656 | 45,937 | 41,347 | 34,584 | 20,479 |
| SJC | 62,777 | 33,560 | 38,147 | 53,315 | 52,004 | 50,302 | 45,874 | 28,165 |


#### Coverage grid: airport x year-month (departures)


Grid 16 x 92 = 1472 cells; empty cells: 0.

Gaps (airport: months with zero departures): none


Airport-months (excl. 2020-21) below 50 % of the same calendar month in other years: none


Distinct days with >=1 departure per airport-year (full year = 365/366; 2026 partial):

| Origin | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| BDL | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| PVD | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| MHT | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| PWM | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| BTV | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| LAX | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| SNA | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| BUR | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| LGB | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| ONT | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| ANC | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| FAI | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| SFO | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| OAK | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |
| SJC | 365 | 366 | 365 | 365 | 365 | 366 | 365 | 243 |


#### Cancelled / diverted share (departing flights, %)


| Origin | flights | cancelled | diverted |
|---|---|---|---|
| BOS | 975,597 | 2.46 | 0.27 |
| BDL | 170,213 | 2.41 | 0.29 |
| PVD | 108,454 | 2.93 | 0.27 |
| MHT | 46,877 | 2.97 | 0.31 |
| PWM | 78,874 | 3.1 | 0.25 |
| BTV | 53,626 | 3.25 | 0.27 |
| LAX | 1,415,723 | 1.41 | 0.28 |
| SNA | 311,846 | 1.88 | 0.33 |
| BUR | 211,043 | 2.8 | 0.24 |
| LGB | 112,667 | 1.32 | 0.16 |
| ONT | 176,065 | 1.7 | 0.18 |
| ANC | 140,558 | 1.51 | 0.27 |
| FAI | 29,819 | 1.38 | 0.1 |
| SFO | 1,004,161 | 1.7 | 0.27 |
| OAK | 309,609 | 1.96 | 0.13 |
| SJC | 364,581 | 1.86 | 0.16 |


Cancellation % by year:

| Origin | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 2.06 | 6.31 | 1.32 | 3.3 | 1.8 | 1.45 | 1.68 | 3.64 |
| BDL | 1.88 | 6.29 | 1.75 | 3.46 | 1.24 | 1.35 | 1.48 | 3.19 |
| PVD | 2.29 | 7.97 | 2.27 | 4.14 | 1.61 | 1.16 | 1.96 | 4.15 |
| MHT | 2.26 | 6.76 | 1.98 | 4.21 | 2.22 | 1.1 | 2.53 | 3.03 |
| PWM | 2.58 | 5.38 | 2.01 | 5.17 | 2.56 | 2.16 | 2.25 | 3.7 |
| BTV | 2.5 | 7.87 | 1.2 | 4.19 | 2.68 | 2.01 | 3.13 | 4.58 |
| LAX | 1.29 | 5.09 | 1.25 | 1.48 | 0.81 | 0.81 | 0.69 | 1.04 |
| SNA | 1.2 | 6.94 | 2.12 | 2.52 | 1.23 | 0.93 | 1.05 | 1.1 |
| BUR | 3.41 | 9.55 | 3.08 | 3.21 | 1.73 | 1.16 | 1.38 | 1.18 |
| LGB | 0.51 | 6.21 | 1.69 | 2.07 | 0.83 | 0.52 | 0.47 | 0.32 |
| ONT | 1.47 | 6.22 | 1.48 | 2.03 | 1.13 | 0.89 | 0.91 | 0.84 |
| ANC | 0.84 | 2.14 | 1.87 | 2.47 | 1.13 | 1.49 | 1.11 | 1.01 |
| FAI | 0.72 | 1.1 | 2.2 | 2.81 | 0.59 | 1.16 | 0.88 | 0.87 |
| SFO | 2.13 | 5.47 | 1.16 | 1.56 | 1.08 | 1.33 | 0.75 | 1.06 |
| OAK | 1.96 | 8.04 | 1.51 | 2.02 | 0.87 | 0.69 | 0.64 | 0.52 |
| SJC | 1.84 | 8.12 | 1.39 | 2.11 | 0.8 | 0.67 | 0.62 | 0.65 |


- Overall cancel rate in file 1.90 %, diverted 0.21 %.

- CancellationCode counts: {<NA>: 9972395, 'A': 66978, 'B': 63205, 'D': 43832, 'C': 19536}; cancelled rows with null code: 0; non-cancelled with code: 0

- Airport-months with cancel rate >15 % (top 12): [('OAK', 202004, 53.9), ('SJC', 202004, 53.6), ('BUR', 202004, 53.3), ('SNA', 202004, 51.7), ('BTV', 202004, 51.6), ('LGB', 202004, 47.5), ('ONT', 202004, 47.3), ('PWM', 202004, 47.1), ('PVD', 202004, 44.6), ('BOS', 202004, 41.9), ('BDL', 202004, 40.6), ('LAX', 202004, 37.6)]


#### Delay distribution (flown flights = not cancelled, not diverted)


- Flown flights with null ArrDelay: 1; null DepDelay: 0; cancelled/diverted rows with a non-null ArrDelay: 0


Arrival delay minutes by destination airport (all years):

| Dest | count | min | 50% | 95% | 99% | max | mean | % >=15 |
|---|---|---|---|---|---|---|---|---|
| BOS | 949,999 | -117.0 | -7 | 96.0 | 225.0 | 2,512 | 7.8 | 22.5 |
| BDL | 166,052 | -61.0 | -5 | 83.0 | 193.0 | 1,380 | 7.8 | 22.0 |
| PVD | 105,348 | -79.0 | -5 | 81.0 | 189.0 | 1,261 | 7.1 | 21.5 |
| MHT | 45,443 | -53.0 | -6 | 75.0 | 175.6 | 1,176 | 5.4 | 20.8 |
| PWM | 76,381 | -57.0 | -7 | 78.0 | 187.0 | 1,259 | 5.4 | 20.2 |
| BTV | 51,896 | -59.0 | -7 | 82.0 | 199.0 | 1,417 | 6 | 20.1 |
| LAX | 1,393,272 | -107.0 | -7 | 67.0 | 190.0 | 2,919 | 3 | 18.2 |
| SNA | 305,590 | -92.0 | -6 | 53.0 | 131.0 | 1,475 | 1.9 | 17.4 |
| BUR | 204,858 | -79.0 | -6 | 62.0 | 146.0 | 1,252 | 3.3 | 18.6 |
| LGB | 111,055 | -73.0 | -6 | 50.0 | 124.0 | 1,756 | 1.5 | 16.8 |
| ONT | 173,031 | -85.0 | -5 | 67.0 | 156.7 | 1,248 | 4.8 | 19.9 |
| ANC | 137,914 | -98.0 | -5 | 56.0 | 145.0 | 1,411 | 2.7 | 20.3 |
| FAI | 29,419 | -79.0 | -5 | 50.0 | 123.0 | 1,150 | 1.7 | 18.2 |
| SFO | 984,958 | -121.0 | -6 | 89.0 | 211.0 | 1,909 | 7.1 | 23.4 |
| OAK | 303,070 | -83.0 | -6 | 55.0 | 135.0 | 1,209 | 2.2 | 17.9 |
| SJC | 357,149 | -90.0 | -7 | 55.0 | 135.0 | 1,328 | 1.6 | 16.9 |


Departure delay minutes by origin airport:

| Origin | count | min | 50% | 95% | 99% | max |
|---|---|---|---|---|---|---|
| BOS | 948,907 | -78.0 | -3 | 90.0 | 216.0 | 2,810 |
| BDL | 165,614 | -37.0 | -3 | 75.0 | 220.0 | 3,239 |
| PVD | 104,983 | -35.0 | -3 | 76.0 | 225.0 | 2,869 |
| MHT | 45,341 | -38.0 | -4 | 66.0 | 215.0 | 1,841 |
| PWM | 76,238 | -49.0 | -4 | 82.1 | 265.0 | 2,923 |
| BTV | 51,736 | -35.0 | -5 | 95.0 | 286.0 | 1,831 |
| LAX | 1,391,857 | -115.0 | -2 | 67.0 | 182.0 | 2,640 |
| SNA | 304,968 | -40.0 | -2 | 63.0 | 175.0 | 3,095 |
| BUR | 204,620 | -31.0 | -3 | 63.0 | 157.0 | 2,228 |
| LGB | 111,000 | -26.0 | -2 | 55.0 | 146.0 | 1,172 |
| ONT | 172,759 | -34.0 | -2 | 61.0 | 175.0 | 2,159 |
| ANC | 138,055 | -79.0 | -5 | 47.0 | 139.0 | 2,994 |
| FAI | 29,376 | -40.0 | -6 | 47.0 | 149.0 | 1,227 |
| SFO | 984,383 | -92.0 | -2 | 77.0 | 189.0 | 2,983 |
| OAK | 303,140 | -30.0 | -1 | 57.0 | 134.0 | 1,639 |
| SJC | 357,239 | -38.0 | -3 | 52.0 | 135.0 | 2,087 |


- Flown in-scope flights with ArrDelay > 600 min (10 h): 10,456; > 1,440 min: 437. Top 8:

| FlightDate | Reporting_Airline | Origin | Dest | ArrDelay | DepDelay | CarrierDelay | WeatherDelay | NASDelay | LateAircraftDelay |
|---|---|---|---|---|---|---|---|---|---|
| 2025-10-16 | AA | BDL | ORD | 3,240 | 3,239 | 3,239 | 0 | 1 | 0 |
| 2021-03-29 | AA | SNA | DFW | 3,089 | 3,095 | 3,089 | 0 | 0 | 0 |
| 2022-06-05 | AA | ANC | ORD | 2,977 | 2,994 | 2,977 | 0 | 0 | 0 |
| 2024-06-16 | AA | SFO | JFK | 2,972 | 2,983 | 2,972 | 0 | 0 | 0 |
| 2023-06-13 | AA | ANC | ORD | 2,941 | 2,940 | 2,940 | 0 | 1 | 0 |
| 2026-02-24 | AA | HNL | LAX | 2,919 | 2,937 | 2,919 | 0 | 0 | 0 |
| 2023-06-10 | AA | PVD | CLT | 2,913 | 2,869 | 2,869 | 0 | 44.0 | 0 |
| 2024-01-24 | AA | PWM | CLT | 2,901 | 2,923 | 2,901 | 0 | 0 | 0 |


Arrival delay by year (all in-scope arrivals): 

| Year | median | p95 | mean |
|---|---|---|---|
| 2019 | -6 | 81.0 | 5.9 |
| 2020 | -13.0 | 30.0 | -7.9 |
| 2021 | -7 | 61.0 | 2.1 |
| 2022 | -6 | 71.0 | 5.1 |
| 2023 | -5 | 76.0 | 6.4 |
| 2024 | -6 | 79.0 | 6.6 |
| 2025 | -6 | 82.0 | 6.1 |
| 2026 | -5 | 89.0 | 8.9 |


Interpretation: negative delays (early arrivals) are real; delays up to ~1-2 days are real extreme events (storms, overnight aircraft problems) because BTS records delay vs schedule. Nothing was dropped.


#### Delay-cause columns: nulls overall vs among flights delayed 15+ min


| column | null % overall (all rows) | null % among flown flights | null % among ArrDel15=1 | non-null % among ArrDel15=0 |
|---|---|---|---|---|
| CarrierDelay | 81.2 | 80.8 | 0 | 0 |
| WeatherDelay | 81.2 | 80.8 | 0 | 0 |
| NASDelay | 81.2 | 80.8 | 0 | 0 |
| SecurityDelay | 81.2 | 80.8 | 0 | 0 |
| LateAircraftDelay | 81.2 | 80.8 | 0 | 0 |


Flown flights ArrDel15=1: 1,909,541 (19.2 %).

- Among delayed flights with all five causes present, |sum(causes) - ArrDelay| > 1 min: 20 of 1,909,540

- Consistency: ArrDelay>=15 but ArrDel15=0: 0; ArrDelay<15 but ArrDel15=1: 0

- Delayed flights where ALL five cause columns are null: 1 (0.00 %); those with null in some but not all: 0


Delay-cause null % among ArrDel15=1 flights, by airport (dep = flights leaving it, arr = flights arriving):

| Origin | delayed (dep) | nasdelay_null (dep) | carrier_null (dep) | delayed (arr) | nasdelay_null (arr) | carrier_null (arr) |
|---|---|---|---|---|---|---|
| BOS | 197,780 | 0 | 0 | 213,483 | 0 | 0 |
| BDL | 30,724 | 0 | 0 | 36,540 | 0 | 0 |
| PVD | 19,201 | 0 | 0 | 22,694 | 0 | 0 |
| MHT | 7,507 | 0 | 0 | 9,432 | 0 | 0 |
| PWM | 14,230 | 0 | 0 | 15,426 | 0 | 0 |
| BTV | 9,986 | 0 | 0 | 10,408 | 0 | 0 |
| LAX | 241,482 | 0 | 0 | 253,883 | 0 | 0 |
| SNA | 52,150 | 0 | 0 | 53,262 | 0 | 0 |
| BUR | 34,503 | 0 | 0 | 38,058 | 0 | 0 |
| LGB | 16,759 | 0 | 0 | 18,653 | 0 | 0 |
| ONT | 27,397 | 0 | 0 | 34,455 | 0 | 0 |
| ANC | 20,944 | 0 | 0 | 27,980 | 0 | 0 |
| FAI | 4,359 | 0 | 0 | 5,361 | 0 | 0 |
| SFO | 187,949 | 0 | 0 | 230,475 | 0 | 0 |
| OAK | 52,582 | 0 | 0 | 54,238 | 0 | 0 |
| SJC | 53,265 | 0 | 0 | 60,369 | 0 | 0 |


Cause null % among delayed flights by year (a jump would signal a schema change):

| Year | CarrierDelay | WeatherDelay | NASDelay | SecurityDelay | LateAircraftDelay |
|---|---|---|---|---|---|
| 2019 | 0 | 0 | 0 | 0 | 0 |
| 2020 | 0 | 0 | 0 | 0 | 0 |
| 2021 | 0 | 0 | 0 | 0 | 0 |
| 2022 | 0 | 0 | 0 | 0 | 0 |
| 2023 | 0 | 0 | 0 | 0 | 0 |
| 2024 | 0 | 0 | 0 | 0 | 0 |
| 2025 | 0 | 0 | 0 | 0 | 0 |
| 2026 | 0 | 0 | 0 | 0 | 0 |


#### Coverage quality: On-Time departures as % of T-100 passenger-class performed departures


(100 % = On-Time sees every passenger-class departure; <100 % = carriers missing. Compared only for months <= 202607 so 2026 is like-for-like.)

| Origin | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| BOS | 77.2 | 80.7 | 77.6 | 80.5 | 78.4 | 76.3 | 75.6 | 78.1 |
| BDL | 93.6 | 101.0 | 94.2 | 96.6 | 84.9 | 82.1 | 81.4 | 82.7 |
| PVD | 89.7 | 94.4 | 82.6 | 89.2 | 82.7 | 75.1 | 74.1 | 75.7 |
| MHT | 74.8 | 88.1 | 77.9 | 90.5 | 86.9 | 74.1 | 70.5 | 72.7 |
| PWM | 75.2 | 83.2 | 82.2 | 94.1 | 91.9 | 88.6 | 76.6 | 76.6 |
| BTV | 81.6 | 76.0 | 68.2 | 89.7 | 89.7 | 87.5 | 67.6 | 62.4 |
| LAX | 70.0 | 79.9 | 82.9 | 80.0 | 76.5 | 75.2 | 73.4 | 76.2 |
| SNA | 85.8 | 92.1 | 93.1 | 93.9 | 90.4 | 89.6 | 88.5 | 88.6 |
| BUR | 85.9 | 90.6 | 80.0 | 83.3 | 81.3 | 80.5 | 81.6 | 82.7 |
| LGB | 98.6 | 103.2 | 100.3 | 101.0 | 98.8 | 99.8 | 99.4 | 99.4 |
| ONT | 94.6 | 99.3 | 97.5 | 97.8 | 94.4 | 93.7 | 91.9 | 89.9 |
| ANC | 50.4 | 56.6 | 58.8 | 57.2 | 46.2 | 43.3 | 49.4 | 50.1 |
| FAI | 29.5 | 25.2 | 33.3 | 31.3 | 19.1 | 21.2 | 22.8 | 27.3 |
| SFO | 81.0 | 89.2 | 87.2 | 83.1 | 78.4 | 77.0 | 77.0 | 79.3 |
| OAK | 85.7 | 90.8 | 88.2 | 90.2 | 90.3 | 87.6 | 82.3 | 82.1 |
| SJC | 85.4 | 92.1 | 96.0 | 97.6 | 93.4 | 93.7 | 91.9 | 92.5 |


Why: T-100 passenger departures in 2024 flown by carriers that are not among the 18 On-Time reporting carriers:

| airport | T-100 dep 2024 | not in On-Time % | largest missing carriers (departures) |
|---|---|---|---|
| BOS | 188,168 | 19.6 | Hyannis Air Service, Inc. dba Cape Air (16,657); Porter Airlines Inc. (PAI) (1,960); Jazz Aviation LP (1,737) |
| BDL | 27,167 | 15.6 | Breeze Aviation Group DBA  Breeze (2,780); Piedmont Airlines (530); Jazz Aviation LP (270) |
| PVD | 19,785 | 23.7 | Breeze Aviation Group DBA  Breeze (2,877); GoJet Airlines LLC d/b/a United Express (1,088); CommuteAir LLC dba CommuteAir (300) |
| MHT | 7,622 | 26.5 | Piedmont Airlines (953); GoJet Airlines LLC d/b/a United Express (638); TEM Enterprises dba  Avelo Airlines (235) |
| PWM | 13,169 | 10.1 | Breeze Aviation Group DBA  Breeze (619); GoJet Airlines LLC d/b/a United Express (295); Piedmont Airlines (274) |
| BTV | 9,279 | 12.0 | Breeze Aviation Group DBA  Breeze (277); GoJet Airlines LLC d/b/a United Express (269); Air Wisconsin Airlines Corp (193) |
| LAX | 258,212 | 17.3 | Air Canada (3,943); Concesionaria Vuela Compania De Aviacion SA de CV (Volaris) (3,323); Westjet (2,562) |
| SNA | 48,563 | 8.4 | Delux Public Charters d/b/a JSX (2,206); Breeze Aviation Group DBA  Breeze (1,063); Air Canada (364) |
| BUR | 38,060 | 19.6 | Delux Public Charters d/b/a JSX (5,617); TEM Enterprises dba  Avelo Airlines (1,750); Jet Aviation Flight Services, Inc. (62) |
| LGB | 17,690 | 0.5 | ADVANCED AIR, LLC (23); Sun Country Airlines d/b/a MN Airlines (20); VistaJet Limited (11) |
| ONT | 27,924 | 4.1 | Concesionaria Vuela Compania De Aviacion SA de CV (Volaris) (439); China Airlines Ltd. (359); Taca International Airlines (215) |
| ANC | 42,816 | 46.4 | Grant Aviation (8,868); KENAI AVIATION OPERATIONS, LLC (4,050); NEW PACIFIC AIRLINES (2,080) |
| FAI | 16,269 | 67.4 | Wright Air Service (5,680); Tatonduk Outfitters Limited d/b/a Everts Air Alaska and Everts Air Cargo (2,686); Warbelow (2,255) |
| SFO | 175,220 | 13.2 | Air Canada (3,020); Aeromexico (1,169); Eva Airways Corporation (1,098) |
| OAK | 47,208 | 10.3 | Delux Public Charters d/b/a JSX (2,264); Concesionaria Vuela Compania De Aviacion SA de CV (Volaris) (1,611); ADVANCED AIR, LLC (305) |
| SJC | 53,784 | 3.2 | Concesionaria Vuela Compania De Aviacion SA de CV (Volaris) (1,109); ZIPAIR Tokyo Inc. (247); Sun Country Airlines d/b/a MN Airlines (69) |


Reporting carriers seen per departing airport: BOS=17, BDL=14, PVD=14, MHT=12, PWM=13, BTV=13, LAX=13, SNA=10, BUR=13, LGB=8, ONT=12, ANC=10, FAI=6, SFO=11, OAK=12, SJC=13

- ANC departures by carrier (all years): {'AS': 105182, 'DL': 17939, 'UA': 8442, 'QX': 4990, 'AA': 3366, 'WN': 218, 'B6': 190, 'HA': 162, 'G4': 35, 'F9': 34}

- FAI departures by carrier (all years): {'AS': 20753, 'DL': 4281, 'QX': 2983, 'UA': 1377, 'AA': 272, 'OO': 153}

- All national carriers: 9E, AA, AS, B6, DL, EV, F9, G4, HA, MQ, NK, OH, OO, QX, UA, WN, YV, YX

- Airports where On-Time covers <85 % of T-100 passenger departures (mean of 2019,2023-25): **['BOS', 'PVD', 'MHT', 'PWM', 'BTV', 'LAX', 'BUR', 'ANC', 'FAI', 'SFO']**


#### Other sanity checks


- Distance == 0: 0; Distance null: 0
- TaxiOut > 180 min (flown): 27; TaxiOut < 0: 0; TaxiIn > 120: 800
- Cancelled flights with non-null DepTime: 4,751
- Not cancelled & DepTime null: 0
- Diverted flights: ArrDelay null 21,331 of 21,331


TaxiOut minutes by origin airport (flown flights; proxy for ground congestion):

| Origin | count | min | 50% | 95% | max |
|---|---|---|---|---|---|
| BOS | 948,907 | 1 | 18.0 | 37.0 | 184.0 |
| BDL | 165,614 | 1 | 12.0 | 28.0 | 206.0 |
| PVD | 104,983 | 1 | 12.0 | 28.0 | 175.0 |
| MHT | 45,341 | 1 | 12.0 | 28.0 | 149.0 |
| PWM | 76,238 | 2 | 12.0 | 33.0 | 156.0 |
| BTV | 51,736 | 1 | 15.0 | 42.0 | 169.0 |
| LAX | 1,391,857 | 1 | 15.0 | 31.0 | 171.0 |
| SNA | 304,968 | 1 | 13.0 | 28.0 | 155.0 |
| BUR | 204,620 | 1 | 14.0 | 30.0 | 164.0 |
| LGB | 111,000 | 1 | 11.0 | 21.0 | 129.0 |
| ONT | 172,759 | 1 | 12.0 | 24.0 | 160.0 |
| ANC | 138,055 | 1 | 13.0 | 28.0 | 153.0 |
| FAI | 29,376 | 1 | 12.0 | 29.0 | 196.0 |
| SFO | 984,383 | 1 | 18.0 | 36.0 | 169.0 |
| OAK | 303,140 | 1 | 11.0 | 20.0 | 139.0 |
| SJC | 357,239 | 1 | 12.0 | 24.0 | 143.0 |


Median TaxiOut LAX vs SNA by year:

| Origin | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| LAX | 16.0 | 13.0 | 15.0 | 15.0 | 16.0 | 17.0 | 16.0 | 16.0 |
| SNA | 12.0 | 11.0 | 11.0 | 13.0 | 13.0 | 13.0 | 14.0 | 14.0 |


### Anything surprising (BTS On-Time Performance)

| Flag | Classification | Reasoning |
|---|---|---|
| ArrDelay/DepDelay up to 3,240 min (54 h); 10,456 in-scope flights above 600 min, 437 above 1,440 min | **REAL EXTREME** (mean-distorting) | The top rows are American Airlines flights where CarrierDelay equals ArrDelay (aircraft out of service overnight/multi-day). BTS measures delay against the original schedule. Real, but they inflate means; use medians, p95 and share of flights delayed 15+ min. |
| 2020 mean arrival delay -7.9 min, median -13 | **REAL EXTREME** | COVID-emptied schedules. |
| April 2020 cancellation 38-54 % at all airports | **REAL EXTREME** | COVID. |
| TaxiIn max 380 min (800 flights above 120 min); TaxiOut above 180 min (27) | **likely REAL, some DATA ERROR** | Extended tarmac/gate waits and diversions are real but values above 3 h are suspicious; they affect only means. |
| Delay-cause columns null on 81.2 % of rows (8,256,406) | **LIKELY ARTEFACT (by design)** | Populated only for ArrDel15=1. Among delayed flights, null = 0.00 % for every cause, every year, every scope airport. Exactly one delayed flight has all five causes null. |
| Cancelled flights with a non-null DepTime (4,751) | **LIKELY ARTEFACT** | Cancelled after pushback/return to gate. Keep as cancelled. |
| 20 delayed flights where the cause minutes do not sum to ArrDelay (tolerance 1 min) | **likely DATA ERROR** (immaterial) | Out of 1.9 M delayed flights. |

Other surprises:
- **No duplicates, no missing months, no missing days** for any airport (every airport has a departure on all 365/366 days of every year).
- **Coverage vs T-100 (On-Time departures as % of T-100 passenger-class departures, 2024): ANC 43 %, FAI 21 %, BOS 76 %, LAX 75 %, SFO 77 %, SNA 90 %, LGB 100 %.** Missing carriers: bush carriers at ANC/FAI (Grant, Kenai, New Pacific, Wright, Everts, Warbelow), Cape Air/Porter at BOS, foreign airlines at LAX/SFO (Air Canada, Volaris, EVA), Breeze/Avelo/JSX on the low-cost side. On-Time also counts cancelled flights while T-100 counts performed ones, so true coverage of flown flights is slightly lower than the ratios.
- BTV coverage falls to 62-68 % in 2025-26 (Breeze, GoJet and Air Wisconsin are not reporting carriers) while BTV departures in On-Time drop 19 % in 2025: carrier mix, not demand.
- Scope membership: 8.4 % of rows have both ends in scope (LAX-SFO etc.). Each flight appears once, so count departures by `Origin` and arrivals by `Dest`.
- The cause columns are attached to the flight's arrival, so "NAS delay at LAX" is delay on flights that arrived delayed with an NAS cause, wherever it arose.

## 4. BTS Average Domestic Fares

**Shape:** 480 rows x 10 columns | files: `average_fares_scope.csv` (49.2 KB) | total 49.2 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| year | int64 | 0 | 0 | 8 | 2019=64, 2020=64, 2021=64, 2022=64, 2023=64, 2024=64, 2025=64, 2026=32 |
| quarter | int64 | 0 | 0 | 4 | 1=128, 2=128, 3=112, 4=112 |
| rank_2025 | int64 | 0 | 0 | 16 | 1=30, 5=30, 10=30, 36=30, 42=30, 47=30, 51=30, 52=30, 54=30, 64=30, 69=30, 73=30, 93=30, 119=30, 120=30, 137=30 |
| airport_code | string | 0 | 0 | 16 | LAX=30, BOS=30, SFO=30, SJC=30, OAK=30, SNA=30, BDL=30, ONT=30, BUR=30, PVD=30, ANC=30, LGB=30, PWM=30, MHT=30, BTV=30, FAI=30 |
| airport_name | str | 0 | 0 | 16 | Los Angeles International=30, Logan International=30, San Francisco International=30, Norman Y. Mineta San Jose International=30, Oakland International=30, John Wayne Airport-Orange County=30, Bradley International=30, Ontario International=30, Bob Hope=30, Rhode Island Tf Green International=30, Ted Stevens Anchorage International=30, Long Beach Airport=30, Portland International Jetport=30, Manchester Boston Regional=30, Patrick Leahy Burlington International=30, Fairbanks International=30 |
| city | str | 0 | 0 | 16 | Los Angeles=30, Boston=30, San Francisco=30, San Jose=30, Oakland=30, Santa Ana=30, Hartford=30, Ontario=30, Burbank=30, Providence=30, Anchorage=30, Long Beach=30, Portland=30, Manchester=30, Burlington=30, Fairbanks=30 |
| state | str | 0 | 0 | 8 | CA=240, AK=60, MA=30, CT=30, RI=30, ME=30, NH=30, VT=30 |
| avg_fare_usd | float64 | 0 | 0 | 480 |  |
| inflation_adj_fare_usd_base_Q2_2026 | float64 | 0 | 0 | 480 |  |
| pax_2025_10pct_sample | float64 | 0 | 0 | 16 | 1284083.0=30, 986868.0=30, 844286.0=30, 305263.0=30, 268902.0=30, 254126.0=30, 210677.0=30, 198746.0=30, 183243.0=30, 123931.0=30, 113291.0=30, 102848.0=30, 65280.0=30, 37031.0=30, 36575.0=30, 27618.0=30 |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| year | 2,019 | 2,019 | 2,022 | 2,026 | 2,026 | 2,022 | 2.18 |  |
| quarter | 1 | 1 | 2 | 4 | 4 | 2.43 | 1.12 |  |
| rank_2025 | 1 | 1 | 53.0 | 137.0 | 137.0 | 60.8 | 39.3 |  |
| avg_fare_usd | 180.5 | 242.0 | 368.4 | 515.6 | 595.1 | 368.8 | 79.7 |  |
| inflation_adj_fare_usd_base_Q2_2026 | 234.8 | 306.5 | 416.9 | 565.0 | 642.5 | 422.4 | 80.6 |  |
| pax_2025_10pct_sample | 27,618 | 27,618 | 190,994 | 1,284,083 | 1,284,083 | 315,173 | 366,125 |  |


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `year, quarter, airport_code`: **0** extra rows (0 rows in duplicated-key groups)


#### Coverage


- Date range: 2019Q1 → 2026Q2; quarters present: 30; airports: 16; IATA values with case/space issues: 0

- Missing quarters (whole dataset): none
- Per-airport gaps vs 2019Q1..2026Q2: none

- Nulls/zero/negative fares: null=0, ≤0=0


#### Fare distribution per airport (avg_fare_usd, 30 quarters)


| airport_code | count | min | 5% | 50% | 95% | max | mean | std | max/median | min/median |
|---|---|---|---|---|---|---|---|---|---|---|
| BOS | 30.0 | 233.6 | 243.4 | 356.8 | 413.0 | 443.0 | 352.9 | 53.1 | 1.2 | 0.7 |
| BDL | 30.0 | 253.0 | 256.0 | 368.7 | 402.4 | 438.7 | 358.1 | 46.2 | 1.2 | 0.7 |
| PVD | 30.0 | 227.6 | 234.2 | 340.5 | 384.0 | 399.9 | 331.2 | 44.5 | 1.2 | 0.7 |
| MHT | 30.0 | 233.4 | 271.3 | 381.6 | 423.8 | 450.7 | 370.7 | 49.3 | 1.2 | 0.6 |
| PWM | 30.0 | 252.2 | 255.5 | 392.9 | 450.8 | 453.7 | 382.7 | 61.3 | 1.2 | 0.6 |
| BTV | 30.0 | 312.0 | 330.8 | 447.1 | 529.6 | 537.8 | 441.8 | 59.9 | 1.2 | 0.7 |
| LAX | 30.0 | 246.2 | 258.2 | 388.4 | 456.8 | 499.6 | 377.3 | 64.1 | 1.3 | 0.6 |
| SNA | 30.0 | 271.2 | 273.8 | 391.9 | 448.3 | 485.1 | 380.3 | 57.1 | 1.2 | 0.7 |
| BUR | 30.0 | 219.1 | 224.2 | 287.4 | 357.8 | 393.4 | 289.9 | 41.2 | 1.4 | 0.8 |
| LGB | 30.0 | 180.5 | 202.0 | 286.4 | 353.0 | 391.9 | 282.6 | 57.2 | 1.4 | 0.6 |
| ONT | 30.0 | 249.9 | 259.8 | 362.5 | 406.7 | 449.0 | 348.1 | 47.9 | 1.2 | 0.7 |
| ANC | 30.0 | 372.2 | 384.4 | 499.9 | 566.3 | 595.1 | 486.2 | 60.9 | 1.2 | 0.7 |
| FAI | 30.0 | 312.7 | 350.7 | 483.8 | 549.5 | 589.5 | 469.6 | 67.2 | 1.2 | 0.6 |
| SFO | 30.0 | 287.4 | 303.8 | 422.5 | 495.1 | 521.1 | 417.5 | 60.6 | 1.2 | 0.7 |
| OAK | 30.0 | 202.8 | 214.9 | 300.4 | 363.3 | 393.0 | 295.8 | 42.8 | 1.3 | 0.7 |
| SJC | 30.0 | 222.7 | 238.5 | 320.2 | 386.0 | 414.1 | 316.0 | 43.9 | 1.3 | 0.7 |


#### Fare distribution per quarter (across the 16 airports)


| yq | count | min | median | mean | max |
|---|---|---|---|---|---|
| 2019Q1 | 16 | 215.9 | 340.6 | 342.3 | 477.5 |
| 2019Q2 | 16 | 230.6 | 370.7 | 357.3 | 436.0 |
| 2019Q3 | 16 | 235.3 | 363.0 | 348.0 | 414.3 |
| 2019Q4 | 16 | 242.1 | 370.4 | 365.6 | 494.7 |
| 2020Q1 | 16 | 213.9 | 338.3 | 340.6 | 458.7 |
| 2020Q2 | 16 | 180.5 | 253.2 | 267.2 | 384.8 |
| 2020Q3 | 16 | 201.4 | 252.8 | 261.8 | 372.2 |
| 2020Q4 | 16 | 209.9 | 272.8 | 291.9 | 491.4 |
| 2021Q1 | 16 | 202.7 | 258.8 | 279.6 | 425.5 |
| 2021Q2 | 16 | 252.1 | 319.9 | 324.7 | 413.6 |
| 2021Q3 | 16 | 252.5 | 332.4 | 335.6 | 440.0 |
| 2021Q4 | 16 | 256.4 | 348.0 | 350.9 | 464.4 |
| 2022Q1 | 16 | 226.4 | 329.0 | 332.9 | 455.9 |
| 2022Q2 | 16 | 284.0 | 401.9 | 398.5 | 498.5 |
| 2022Q3 | 16 | 279.4 | 377.2 | 385.0 | 540.1 |
| 2022Q4 | 16 | 295.3 | 389.8 | 405.8 | 551.6 |
| 2023Q1 | 16 | 275.9 | 377.5 | 381.4 | 508.8 |
| 2023Q2 | 16 | 303.8 | 401.3 | 407.0 | 525.6 |
| 2023Q3 | 16 | 297.8 | 377.5 | 382.1 | 516.9 |
| 2023Q4 | 16 | 310.3 | 404.8 | 408.3 | 547.2 |
| 2024Q1 | 16 | 302.0 | 395.7 | 402.4 | 543.5 |
| 2024Q2 | 16 | 316.6 | 400.6 | 410.0 | 515.5 |
| 2024Q3 | 16 | 308.6 | 370.1 | 380.4 | 502.7 |
| 2024Q4 | 16 | 336.2 | 400.3 | 418.5 | 595.1 |
| 2025Q1 | 16 | 312.5 | 381.2 | 399.2 | 576.6 |
| 2025Q2 | 16 | 316.7 | 376.5 | 396.0 | 520.9 |
| 2025Q3 | 16 | 312.9 | 360.5 | 379.6 | 497.5 |
| 2025Q4 | 16 | 348.7 | 404.7 | 423.2 | 546.6 |
| 2026Q1 | 16 | 352.6 | 417.6 | 430.9 | 553.8 |
| 2026Q2 | 16 | 391.9 | 449.8 | 457.2 | 537.8 |


#### Outliers vs each airport's own median (ratio >1.3 or <0.7, or |robust z|>3.5)


| yq | airport_code | avg_fare_usd | ratio | rz |
|---|---|---|---|---|
| 2020Q2 | MHT | 233.4 | 0.61 | -5.01 |
| 2020Q2 | LGB | 180.5 | 0.63 | -1.44 |
| 2021Q1 | LAX | 246.2 | 0.63 | -2.38 |
| 2020Q2 | PWM | 252.2 | 0.64 | -2.12 |
| 2020Q3 | PWM | 252.6 | 0.64 | -2.12 |
| 2020Q3 | LAX | 250.2 | 0.64 | -2.31 |
| 2021Q3 | FAI | 312.7 | 0.65 | -2.68 |
| 2020Q3 | BOS | 233.6 | 0.65 | -2.78 |
| 2021Q1 | PWM | 259.1 | 0.66 | -2.02 |
| 2020Q3 | MHT | 255.0 | 0.67 | -4.28 |
| 2020Q3 | PVD | 227.6 | 0.67 | -3.62 |
| 2020Q3 | OAK | 202.8 | 0.68 | -3.15 |
| 2020Q2 | PVD | 230.8 | 0.68 | -3.52 |
| 2020Q3 | SFO | 287.4 | 0.68 | -2.12 |
| 2021Q1 | BOS | 243.3 | 0.68 | -2.56 |
| 2020Q4 | BOS | 243.4 | 0.68 | -2.56 |
| 2020Q3 | BDL | 253.0 | 0.69 | -4.2 |
| 2020Q2 | BDL | 254.1 | 0.69 | -4.16 |
| 2020Q2 | ONT | 249.9 | 0.69 | -2.7 |
| 2020Q4 | LAX | 268.1 | 0.69 | -2.01 |
| 2020Q3 | SNA | 271.2 | 0.69 | -2.6 |
| 2020Q3 | SJC | 222.7 | 0.7 | -2.93 |
| 2021Q2 | FAI | 336.8 | 0.7 | -2.3 |
| 2021Q1 | SNA | 272.9 | 0.7 | -2.57 |
| 2020Q3 | BTV | 312.0 | 0.7 | -2.55 |
| 2020Q4 | PVD | 238.3 | 0.7 | -3.28 |
| 2021Q1 | BDL | 258.4 | 0.7 | -4.01 |
| 2020Q4 | BDL | 265.9 | 0.72 | -3.73 |
| 2026Q2 | OAK | 393.0 | 1.31 | 2.99 |
| 2026Q2 | LGB | 391.9 | 1.37 | 1.43 |
| 2026Q2 | BUR | 393.4 | 1.37 | 2.71 |


Interpretation: fares trend up (2022–23 post-COVID rebound, inflation); a high ratio late in the series is a real trend, not an error. Q2 2020 low-traffic quarter can show odd mix effects (real).


#### Quarter-over-quarter jumps >15 %


| yq | airport_code | avg_fare_usd | qoq |
|---|---|---|---|
| 2019Q4 | ANC | 494.7 | 19.4 |
| 2020Q2 | ANC | 384.8 | -16.1 |
| 2020Q4 | ANC | 443.9 | 19.3 |
| 2021Q4 | ANC | 446.6 | 16.3 |
| 2022Q3 | ANC | 540.1 | 15.1 |
| 2024Q4 | ANC | 595.1 | 18.4 |
| 2020Q2 | BDL | 254.1 | -28.8 |
| 2021Q2 | BDL | 328.3 | 27.1 |
| 2022Q2 | BDL | 398.9 | 20.4 |
| 2020Q2 | BOS | 254.7 | -21.6 |
| 2021Q2 | BOS | 322.4 | 32.5 |
| 2022Q2 | BOS | 404.8 | 19.2 |
| 2024Q3 | BOS | 331.2 | -15.1 |
| 2020Q2 | BTV | 335.0 | -19.1 |
| 2021Q2 | BTV | 413.6 | 18.0 |
| 2020Q2 | BUR | 219.1 | -18.3 |
| 2022Q2 | BUR | 284.0 | 17.3 |
| 2019Q4 | FAI | 456.4 | 15.5 |
| 2020Q4 | FAI | 491.4 | 33.6 |
| 2021Q2 | FAI | 336.8 | -20.1 |
| 2021Q4 | FAI | 464.4 | 48.5 |
| 2024Q4 | FAI | 589.5 | 21.7 |
| 2025Q4 | FAI | 529.1 | 15.7 |
| 2020Q2 | LAX | 278.1 | -15.3 |
| 2021Q2 | LAX | 314.7 | 27.8 |
| 2022Q2 | LAX | 447.5 | 34.9 |
| 2020Q2 | LGB | 180.5 | -15.6 |
| 2021Q2 | LGB | 252.1 | 24.3 |
| 2022Q2 | LGB | 288.0 | 27.2 |
| 2020Q2 | MHT | 233.4 | -37.3 |
| 2020Q4 | MHT | 296.4 | 16.2 |
| 2021Q2 | MHT | 360.5 | 23.8 |
| 2022Q2 | MHT | 382.8 | 21.9 |
| 2020Q2 | OAK | 211.3 | -24.7 |
| 2021Q2 | OAK | 273.6 | 24.7 |
| 2022Q2 | OAK | 303.1 | 15.7 |
| 2020Q2 | ONT | 249.9 | -21.6 |
| 2021Q2 | ONT | 303.2 | 16.4 |
| 2022Q2 | ONT | 385.5 | 23.5 |
| 2020Q2 | PVD | 230.8 | -28.4 |
| 2021Q2 | PVD | 317.3 | 31.4 |
| 2022Q2 | PVD | 376.0 | 22.0 |
| 2020Q2 | PWM | 252.2 | -27.6 |
| 2021Q2 | PWM | 324.5 | 25.2 |
| 2022Q2 | PWM | 437.6 | 25.7 |
| 2024Q3 | PWM | 379.7 | -15.4 |
| 2020Q2 | SFO | 312.7 | -15.9 |
| 2021Q2 | SFO | 389.5 | 28.9 |
| 2022Q2 | SFO | 498.5 | 36.9 |
| 2025Q4 | SFO | 490.8 | 16.3 |
| 2020Q2 | SJC | 230.5 | -15.4 |
| 2021Q2 | SJC | 306.5 | 23.4 |
| 2022Q2 | SJC | 349.9 | 22.2 |
| 2020Q2 | SNA | 274.9 | -27.4 |
| 2022Q2 | SNA | 405.2 | 24.0 |


#### Inflation factor (inflation_adj / nominal) by quarter – should be constant within a quarter


- Factor range overall: 1.000–1.321; quarters where min≠max (±0.001): none

- Latest quarter factor: [1.0] (≈1.0 expected for base Q2-2026)

- Static metadata varying within an airport (should all be 1): none

- **No national average fare column exists** in this file: 'pricing power vs national' must be computed vs the mean/median of these 16 airports (sample is not national) or an external benchmark. Flag for decision.


### Anything surprising (BTS Average Domestic Fares)

| Flag | Classification | Reasoning |
|---|---|---|
| 2020Q2-2021Q1 fares 30-40 % below own median (MHT 0.61, LGB 0.63, LAX 0.63) | **REAL EXTREME** | COVID fare and mix collapse. |
| QoQ swings of 15-48 % (FAI 2021Q4 +48 %, ANC 2019Q4 +19 %) | **real but noisy** | Alaska airports have small 10 % samples and a strong seasonal mix; ANC and FAI jump in most Q4s (2019, 2020, 2021, 2024). |
| 2026Q2 BUR 1.37x, LGB 1.37x, OAK 1.31x own median | **plausibly real** | Latest fares are at the top of the distribution everywhere (2026Q2 cross-airport median is the highest in the series, 449.8). Keep, but treat the last quarter as provisional. |

Other surprises:
- **There is no national average in the file.** "Fare vs national" cannot be computed from this source alone; the only available benchmark is the 16-airport median (not national, and 8 of 16 are California). A decision is needed (see plan).
- The inflation-adjusted column is a constant factor per quarter (1.000 in 2026Q2, 1.32 in 2019Q1). On the 16-airport mean, nominal fares rose about 34 % from 2019Q1 (342) to 2026Q2 (457) while the inflation-adjusted series is flat (452 to 457): the 'growth' in fares is inflation.
- `pax_2025_10pct_sample` is a single 2025 value repeated over all quarters; do not use it as a time series.
- Latest-4-quarter fare relative to the 16-airport median: SFO 1.18, ANC 1.31, BTV 1.25, BUR 0.88.

## 5. FAA TAF 2025


**taf_enplanements_scope.csv**

**Shape:** 1,280 rows x 8 columns | files: `taf_enplanements_scope.csv` (49.1 KB) | total 49.1 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| locid | string | 0 | 0 | 16 | ANC=80, BDL=80, BOS=80, BTV=80, BUR=80, FAI=80, LAX=80, LGB=80, MHT=80, OAK=80, ONT=80, PVD=80, PWM=80, SFO=80, SJC=80, SNA=80 |
| scenario | int64 | 0 | 0 | 2 | 0=784, 1=496 |
| ayear | int64 | 0 | 0 | 80 |  |
| aac | int64 | 0 | 0 | 1,280 |  |
| aat | int64 | 0 | 0 | 433 |  |
| commuter | int64 | 0 | 0 | 1,269 |  |
| us_flag | int64 | 0 | 0 | 671 |  |
| frgn_flag | int64 | 0 | 0 | 736 |  |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| scenario | 0 | 0 | 0 | 1 | 1 | 0.388 | 0.487 |  |
| ayear | 1,976 | 1,980 | 2,016 | 2,051 | 2,055 | 2,016 | 23.1 |  |
| aac | 72.0 | 225,041 | 2,362,026 | 22,657,021 | 38,791,094 | 5,240,783 | 7,190,325 |  |
| aat | 0 | 0 | 159.0 | 2,981 | 142,518 | 1,043 | 5,719 | FLAG |
| commuter | 0 | 11,364 | 279,719 | 3,243,254 | 5,332,772 | 622,227 | 967,046 |  |
| us_flag | 0 | 0 | 165.0 | 3,050,202 | 9,593,548 | 444,964 | 1,313,406 |  |
| frgn_flag | 0 | 0 | 4,614 | 6,136,472 | 22,752,648 | 970,686 | 2,777,134 |  |


**Flagged (max > 10x p95):** `aat`


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `locid, scenario, ayear`: **0** extra rows (0 rows in duplicated-key groups)


**taf_operations_scope.csv**

**Shape:** 1,056 rows x 10 columns | files: `taf_operations_scope.csv` (49.6 KB) | total 49.6 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| locid | string | 0 | 0 | 16 | ANC=66, BDL=66, BOS=66, BTV=66, BUR=66, FAI=66, LAX=66, LGB=66, MHT=66, OAK=66, ONT=66, PVD=66, PWM=66, SFO=66, SJC=66, SNA=66 |
| scenario | int64 | 0 | 0 | 2 | 0=560, 1=496 |
| ayear | int64 | 0 | 0 | 66 |  |
| itn_Ac | int64 | 0 | 0 | 1,053 |  |
| itn_at | int64 | 0 | 0 | 1,044 |  |
| itn_ga | int64 | 0 | 0 | 997 |  |
| itn_mil | int64 | 0 | 0 | 519 |  |
| loc_ga | int64 | 0 | 0 | 835 |  |
| loc_mil | int64 | 0 | 0 | 267 |  |
| tot_overs | int64 | 0 | 0 | 917 |  |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| scenario | 0 | 0 | 0 | 1 | 1 | 0.47 | 0.499 |  |
| ayear | 1,990 | 1,993 | 2,022 | 2,052 | 2,055 | 2,022 | 19.1 |  |
| itn_Ac | 5,300 | 12,397 | 82,130 | 575,050 | 1,003,069 | 144,775 | 182,080 |  |
| itn_at | 590.0 | 8,566 | 26,278 | 96,966 | 237,928 | 37,581 | 38,877 |  |
| itn_ga | 6,195 | 9,465 | 30,306 | 117,822 | 280,535 | 44,656 | 45,308 |  |
| itn_mil | 58.0 | 162.0 | 708.0 | 4,369 | 16,696 | 1,476 | 1,739 |  |
| loc_ga | 0 | 0 | 9,006 | 165,994 | 256,131 | 34,479 | 57,192 |  |
| loc_mil | 0 | 0 | 26.0 | 1,119 | 7,087 | 287.0 | 815.7 |  |
| tot_overs | 0 | 0 | 9,871 | 50,630 | 82,881 | 13,871 | 15,244 |  |


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `locid, scenario, ayear`: **0** extra rows (0 rows in duplicated-key groups)


**taf_airports_scope.csv**

**Shape:** 16 rows x 27 columns | files: `taf_airports_scope.csv` (3.6 KB) | total 3.6 KB


#### Schema (dtype, nulls, distinct, low-cardinality values)


| column | dtype | nulls | null % | distinct | values (value=count) |
|---|---|---|---|---|---|
| LOCID | string | 0 | 0 | 16 | ANC=1, BDL=1, BOS=1, BTV=1, BUR=1, FAI=1, LAX=1, LGB=1, MHT=1, OAK=1, ONT=1, PVD=1, PWM=1, SFO=1, SJC=1, SNA=1 |
| REGION | str | 0 | 0 | 3 | AWP=8, ANE=6, AAL=2 |
| APORT_NAME | str | 0 | 0 | 16 | Ted Stevens Anchorage International                                                                 =1, Bradley International                                                                               =1, General Edward Lawrence Logan International                                                         =1, Patrick Leahy Burlington International                                                              =1, Bob Hope                                                                                            =1, Fairbanks International                                                                             =1, Los Angeles International                                                                           =1, Long Beach (Daugherty Field)                                                                        =1, Manchester Boston Regional                                                                          =1, San Francisco Bay Oakland International                                                             =1, Ontario International                                                                               =1, Rhode Island Tf Green International                                                                 =1, Portland International Jetport                                                                      =1, San Francisco International                                                                         =1, Norman Y Mineta San Jose International                                                              =1, John Wayne/Orange County                                                                            =1 |
| CITY | str | 0 | 0 | 16 | ANCHORAGE=1, WINDSOR LOCKS=1, BOSTON=1, BURLINGTON=1, BURBANK=1, FAIRBANKS=1, LOS ANGELES=1, LONG BEACH=1, MANCHESTER=1, OAKLAND=1, ONTARIO=1, PROVIDENCE=1, PORTLAND=1, SAN FRANCISCO=1, SAN JOSE=1, SANTA ANA=1 |
| STATE | str | 0 | 0 | 8 | CA=8, AK=2, CT=1, MA=1, VT=1, NH=1, RI=1, ME=1 |
| SITE | str | 0 | 0 | 16 | 50034.*A   =1, 02946.*A   =1, 08778.*A   =1, 25385.*A   =1, 01353.*A   =1, 50219.*A   =1, 01818.*A   =1, 01794.*A   =1, 13332.*A   =1, 01971.*A   =1, 01986.*A   =1, 22024.*A   =1, 08215.*A   =1, 02187.*A   =1, 02204.*A   =1, 02230.*A   =1 |
| NASPNO | float64 | 0 | 0 | 16 | 20016.0=1, 90022.0=1, 250010.0=1, 500005.0=1, 60031.0=1, 20096.0=1, 60139.0=1, 60127.0=1, 330011.0=1, 60170.0=1, 60175.0=1, 440003.0=1, 230038.0=1, 60221.0=1, 60226.0=1, 60233.0=1 |
| LATITUDE | str | 0 | 0 | 16 | 61-10-26.7050N=1, 41-56-20.5160N=1, 42-21-46.6000N=1, 44-28-19.0380N=1, 34-12-02.5000N=1, 64-48-55.2800N=1, 33-56-32.9870N=1, 33-49-04.5470N=1, 42-55-58.1000N=1, 37-43-16.5410N=1, 34-03-21.6510N=1, 41-43-20.4000N=1, 43-38-44.3166N=1, 37-37-07.7000N=1, 37-21-46.7810N=1, 33-40-32.3830N=1 |
| LONGITUDE | str | 0 | 0 | 16 | 149-59-53.2950W=1, 72-41-03.5370W=1, 71-00-23.0000W=1, 73-09-11.7940W=1, 118-21-31.2000W=1, 147-51-24.0000W=1, 118-24-28.9750W=1, 118-09-06.8060W=1, 71-26-08.7000W=1, 122-13-16.1420W=1, 117-36-04.2750W=1, 71-25-39.8000W=1, 70-18-31.0189W=1, 122-22-31.5000W=1, 121-55-43.0340W=1, 117-52-05.6390W=1 |
| FAC_CLASS | int64 | 0 | 0 | 2 | 7=12, 3=4 |
| FAC_LEVEL | int64 | 0 | 0 | 1 | 0=16 |
| ATCT_FLAG | int64 | 0 | 0 | 1 | 1=16 |
| PUBLISHED | int64 | 0 | 0 | 1 | 1=16 |
| SER_VOL | int64 | 0 | 0 | 15 | 355000=2, 307000=1, 300000=1, 412000=1, 208000=1, 230000=1, 285000=1, 675000=1, 370000=1, 185000=1, 625000=1, 330000=1, 256000=1, 393000=1, 385000=1 |
| HUB_SIZE | int64 | 0 | 0 | 3 | 2=7, 1=6, 3=3 |
| HUB_LOCID | str | 6 | 37.5 | 3 | <NA>=6, LAX=5, SFO=3, BOS=2 |
| RELIVER | int64 | 0 | 0 | 1 | 0=16 |
| RE_ARPT_ID | float64 | 16 | 100.0 | 0 | <NA>=16 |
| CENTER_ID | str | 0 | 0 | 4 | ZBW=6, ZLA=5, ZOA=3, ZAN=2 |
| IOPS_ID | str | 0 | 0 | 9 | SCT=5, NCT=3, A90=2, A11=1, Y90=1, BTV=1, FAI=1, PVD=1, PWM=1 |
| TR_PRIMARY | int64 | 0 | 0 | 2 | 0=11, 1=5 |
| OPS_FLAG | int64 | 0 | 0 | 1 | 1=16 |
| IOPS_NOADD | int64 | 0 | 0 | 2 | 1=12, 0=4 |
| REG_INPUT | int64 | 0 | 0 | 1 | 0=16 |
| REG_SYEAR | float64 | 14 | 87.5 | 1 | <NA>=14, 2005.0=2 |
| REG_EYEAR | float64 | 14 | 87.5 | 1 | <NA>=14, 2007.0=2 |
| OEP35 | int64 | 0 | 0 | 2 | 0=13, 1=3 |


#### Numeric columns


| column | min | p5 | median | p95 | max | mean | std | max>10×p95 |
|---|---|---|---|---|---|---|---|---|
| NASPNO | 20,016 | 20,076 | 60,224 | 455,004 | 500,005 | 147,595 | 154,328 |  |
| FAC_CLASS | 3 | 3 | 7 | 7 | 7 | 6 | 1.79 |  |
| FAC_LEVEL | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| ATCT_FLAG | 1 | 1 | 1 | 1 | 1 | 1 | 0 |  |
| PUBLISHED | 1 | 1 | 1 | 1 | 1 | 1 | 0 |  |
| SER_VOL | 185,000 | 202,250 | 342,500 | 637,500 | 675,000 | 354,438 | 133,642 |  |
| HUB_SIZE | 1 | 1 | 2 | 3 | 3 | 1.81 | 0.75 |  |
| RELIVER | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| TR_PRIMARY | 0 | 0 | 0 | 1 | 1 | 0.312 | 0.479 |  |
| OPS_FLAG | 1 | 1 | 1 | 1 | 1 | 1 | 0 |  |
| IOPS_NOADD | 0 | 0 | 1 | 1 | 1 | 0.75 | 0.447 |  |
| REG_INPUT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| REG_SYEAR | 2,005 | 2,005 | 2,005 | 2,005 | 2,005 | 2,005 | 0 |  |
| REG_EYEAR | 2,007 | 2,007 | 2,007 | 2,007 | 2,007 | 2,007 | 0 |  |
| OEP35 | 0 | 0 | 0 | 1 | 1 | 0.188 | 0.403 |  |


#### Duplicates


- Exact duplicate rows: **0**
- Natural key `LOCID`: **0** extra rows (0 rows in duplicated-key groups)


#### ID hygiene


- `enplanements.locid`: 0 values with leading/trailing whitespace, 0 not upper-case; distinct raw=16, distinct stripped=16
- `operations.locid`: 0 values with leading/trailing whitespace, 0 not upper-case; distinct raw=16, distinct stripped=16
- `airports.LOCID`: 0 values with leading/trailing whitespace, 0 not upper-case; distinct raw=16, distinct stripped=16

- `APORT_NAME` is space-padded (max len 100); strip before display.


#### Actual vs forecast boundary (scenario 0 = actual, 1 = forecast)


Enplanements:

| scenario | min | max | count |
|---|---|---|---|
| 0 | 1976 | 2024 | 784 |
| 1 | 2025 | 2055 | 496 |

Operations:

| scenario | min | max | count |
|---|---|---|---|
| 0 | 1990 | 2024 | 560 |
| 1 | 2025 | 2055 | 496 |


- Last actual year: **FY2024**; (locid, year) pairs present as both actual and forecast: 0

- Scenario values: {0: 784, 1: 496}


#### Coverage (enplanements: year range per airport)


| locid | min | max | count |
|---|---|---|---|
| BOS | 1976 | 2055 | 80 |
| BDL | 1976 | 2055 | 80 |
| PVD | 1976 | 2055 | 80 |
| MHT | 1976 | 2055 | 80 |
| PWM | 1976 | 2055 | 80 |
| BTV | 1976 | 2055 | 80 |
| LAX | 1976 | 2055 | 80 |
| SNA | 1976 | 2055 | 80 |
| BUR | 1976 | 2055 | 80 |
| LGB | 1976 | 2055 | 80 |
| ONT | 1976 | 2055 | 80 |
| ANC | 1976 | 2055 | 80 |
| FAI | 1976 | 2055 | 80 |
| SFO | 1976 | 2055 | 80 |
| OAK | 1976 | 2055 | 80 |
| SJC | 1976 | 2055 | 80 |


**Gaps inside range:** none


Operations year range per airport:

| locid | min | max | count |
|---|---|---|---|
| BOS | 1990 | 2055 | 66 |
| BDL | 1990 | 2055 | 66 |
| PVD | 1990 | 2055 | 66 |
| MHT | 1990 | 2055 | 66 |
| PWM | 1990 | 2055 | 66 |
| BTV | 1990 | 2055 | 66 |
| LAX | 1990 | 2055 | 66 |
| SNA | 1990 | 2055 | 66 |
| BUR | 1990 | 2055 | 66 |
| LGB | 1990 | 2055 | 66 |
| ONT | 1990 | 2055 | 66 |
| ANC | 1990 | 2055 | 66 |
| FAI | 1990 | 2055 | 66 |
| SFO | 1990 | 2055 | 66 |
| OAK | 1990 | 2055 | 66 |
| SJC | 1990 | 2055 | 66 |


#### Total enplanements (aac+aat+commuter+us_flag+frgn_flag) – 2019, 2024, 2025, 2030, 2040, 2055


**Definition finding:** `docs/data-sources.md` says total = aac+aat+commuter. That omits international (`us_flag`, `frgn_flag`) and understates gateways (LAX, SFO, BOS, OAK, ANC) by up to ~30 %. The 5-column sum reconciles with T-100 (see Cross-source). Domestic-only shown below for comparison.


| locid | 2019 | 2024 | 2025 | 2030 | 2040 | 2055 |
|---|---|---|---|---|---|---|
| BOS | 20,564,417 | 20,871,588 | 21,200,148 | 23,896,939 | 30,068,319 | 41,342,766 |
| BDL | 3,324,206 | 3,211,540 | 3,327,536 | 3,581,500 | 4,153,914 | 5,158,213 |
| PVD | 1,979,208 | 1,902,797 | 2,113,790 | 2,384,380 | 2,543,844 | 2,804,115 |
| MHT | 854,439 | 630,278 | 672,741 | 770,455 | 804,685 | 856,727 |
| PWM | 1,100,109 | 1,195,118 | 1,285,737 | 1,438,367 | 1,702,783 | 2,179,317 |
| BTV | 684,951 | 647,634 | 713,971 | 824,816 | 934,661 | 1,118,740 |
| LAX | 42,843,858 | 37,806,366 | 36,855,152 | 42,032,013 | 53,119,304 | 73,628,035 |
| SNA | 5,153,073 | 5,424,464 | 5,452,720 | 5,984,146 | 7,107,811 | 9,066,485 |
| BUR | 2,886,254 | 3,313,970 | 3,329,148 | 3,608,875 | 4,144,460 | 5,058,761 |
| LGB | 1,731,868 | 2,034,910 | 1,883,821 | 1,937,352 | 2,398,041 | 3,265,546 |
| ONT | 2,640,652 | 3,441,965 | 3,485,239 | 3,791,656 | 4,842,328 | 6,844,514 |
| ANC | 2,665,124 | 2,729,138 | 2,691,637 | 2,997,722 | 3,751,684 | 5,217,978 |
| FAI | 556,057 | 568,707 | 567,403 | 596,943 | 732,358 | 996,892 |
| SFO | 27,654,594 | 24,765,642 | 26,106,891 | 30,516,426 | 39,121,362 | 54,505,267 |
| OAK | 6,585,522 | 5,449,160 | 4,685,564 | 5,205,296 | 7,162,037 | 11,240,983 |
| SJC | 7,511,903 | 5,811,337 | 5,466,921 | 6,241,452 | 8,125,012 | 11,756,485 |


International share of total (%), i.e. what the 3-column sum would miss:

| locid | 2019 | 2024 | 2025 | 2030 | 2040 | 2055 |
|---|---|---|---|---|---|---|
| BOS | 17.3 | 19.3 | 20.3 | 21.1 | 21.3 | 20.4 |
| BDL | 1.4 | 1.1 | 1.9 | 1.8 | 2.3 | 3.1 |
| PVD | 1.8 | 0 | 0 | 0.1 | 0.2 | 0.7 |
| MHT | 0 | 0 | 0 | 0 | 0 | 0 |
| PWM | 0 | 0 | 0 | 0 | 0 | 0 |
| BTV | 0 | 0 | 0 | 0 | 0 | 0 |
| LAX | 28.6 | 30.4 | 31.1 | 32.2 | 35.9 | 40.1 |
| SNA | 2.2 | 3.2 | 2.8 | 2.8 | 3.3 | 3.5 |
| BUR | 0 | 0 | 0 | 0 | 0 | 0 |
| LGB | 0 | 0 | 0 | 0 | 0 | 0 |
| ONT | 4.6 | 6.6 | 7 | 7.7 | 8.1 | 8.1 |
| ANC | 1.6 | 1 | 0.5 | 0.3 | 0.3 | 0.4 |
| FAI | 0.1 | 0.1 | 0 | 0 | 0 | 0 |
| SFO | 25.5 | 29.4 | 28.1 | 29.3 | 32.4 | 35.3 |
| OAK | 5.8 | 5.3 | 8.4 | 11.0 | 13.4 | 16.3 |
| SJC | 5 | 5.5 | 5.5 | 5.5 | 6.3 | 6.6 |


#### Total operations (all itinerant + local) – same years


| locid | 2019 | 2024 | 2025 | 2030 | 2040 | 2055 |
|---|---|---|---|---|---|---|
| BOS | 432,722 | 410,503 | 423,459 | 472,311 | 580,249 | 776,910 |
| BDL | 92,414 | 81,833 | 85,686 | 93,832 | 104,423 | 123,060 |
| PVD | 69,357 | 69,541 | 75,131 | 83,641 | 89,699 | 100,390 |
| MHT | 50,503 | 44,399 | 44,104 | 46,788 | 48,913 | 52,602 |
| PWM | 58,465 | 56,280 | 61,283 | 67,372 | 73,115 | 82,775 |
| BTV | 73,529 | 95,875 | 85,693 | 90,441 | 94,821 | 102,060 |
| LAX | 694,975 | 580,514 | 582,638 | 662,069 | 801,680 | 1,049,486 |
| SNA | 328,013 | 330,417 | 366,336 | 398,540 | 424,695 | 468,096 |
| BUR | 141,765 | 151,683 | 167,430 | 180,808 | 199,501 | 230,916 |
| LGB | 293,587 | 389,031 | 386,486 | 398,096 | 417,154 | 449,121 |
| ONT | 99,102 | 105,532 | 112,145 | 121,394 | 144,706 | 188,512 |
| ANC | 270,975 | 289,509 | 297,559 | 322,360 | 363,441 | 439,870 |
| FAI | 109,084 | 108,955 | 116,077 | 120,690 | 127,080 | 138,380 |
| SFO | 460,720 | 381,304 | 415,726 | 474,924 | 584,059 | 773,743 |
| OAK | 244,441 | 205,347 | 205,524 | 224,220 | 263,188 | 340,182 |
| SJC | 204,503 | 163,983 | 159,387 | 176,811 | 210,106 | 271,052 |


Commercial ops (itn_Ac + itn_at):

| locid | 2019 | 2024 | 2025 | 2030 | 2040 | 2055 |
|---|---|---|---|---|---|---|
| BOS | 416,066 | 401,340 | 414,977 | 462,869 | 570,717 | 767,240 |
| BDL | 76,929 | 66,168 | 70,888 | 77,582 | 88,173 | 106,810 |
| PVD | 46,562 | 45,229 | 50,365 | 58,480 | 63,728 | 73,152 |
| MHT | 34,496 | 28,306 | 29,701 | 30,985 | 32,555 | 35,368 |
| PWM | 35,773 | 33,235 | 34,527 | 40,218 | 45,143 | 53,517 |
| BTV | 28,219 | 24,157 | 25,939 | 30,241 | 33,717 | 39,571 |
| LAX | 676,608 | 567,181 | 569,902 | 647,279 | 786,051 | 1,032,508 |
| SNA | 113,134 | 122,269 | 126,451 | 138,497 | 158,366 | 192,022 |
| BUR | 84,616 | 90,319 | 93,204 | 102,075 | 114,146 | 134,462 |
| LGB | 40,563 | 51,513 | 52,070 | 54,333 | 61,270 | 74,208 |
| ONT | 84,887 | 91,892 | 95,046 | 103,150 | 125,584 | 167,989 |
| ANC | 186,970 | 214,389 | 223,501 | 237,860 | 277,187 | 350,903 |
| FAI | 37,858 | 34,355 | 34,516 | 36,096 | 39,709 | 46,662 |
| SFO | 446,912 | 371,876 | 406,220 | 463,268 | 571,925 | 760,846 |
| OAK | 163,166 | 134,405 | 123,778 | 136,986 | 175,126 | 250,855 |
| SJC | 167,987 | 131,929 | 128,150 | 141,719 | 174,001 | 233,363 |


#### Forecast sanity: CAGR by airport


| airport | enpl 2019→2024 CAGR % | 2024→2030 % | 2024→2040 % | 2024→2055 % | 2055/2024 × | 2025/2024 YoY % | 2024 vs 2019 % |
|---|---|---|---|---|---|---|---|
| BOS | 0.3 | 2.28 | 2.31 | 2.23 | 1.98 | 1.57 | 1.49 |
| BDL | -0.69 | 1.83 | 1.62 | 1.54 | 1.61 | 3.61 | -3.39 |
| PVD | -0.78 | 3.83 | 1.83 | 1.26 | 1.47 | 11.1 | -3.86 |
| MHT | -5.9 | 3.4 | 1.54 | 1 | 1.36 | 6.74 | -26.2 |
| PWM | 1.67 | 3.14 | 2.24 | 1.96 | 1.82 | 7.58 | 8.64 |
| BTV | -1.11 | 4.11 | 2.32 | 1.78 | 1.73 | 10.2 | -5.45 |
| LAX | -2.47 | 1.78 | 2.15 | 2.17 | 1.95 | -2.52 | -11.8 |
| SNA | 1.03 | 1.65 | 1.7 | 1.67 | 1.67 | 0.52 | 5.27 |
| BUR | 2.8 | 1.43 | 1.41 | 1.37 | 1.53 | 0.46 | 14.8 |
| LGB | 3.28 | -0.82 | 1.03 | 1.54 | 1.6 | -7.42 | 17.5 |
| ONT | 5.44 | 1.63 | 2.16 | 2.24 | 1.99 | 1.26 | 30.4 |
| ANC | 0.48 | 1.58 | 2.01 | 2.11 | 1.91 | -1.37 | 2.4 |
| FAI | 0.45 | 0.81 | 1.59 | 1.83 | 1.75 | -0.23 | 2.27 |
| SFO | -2.18 | 3.54 | 2.9 | 2.58 | 2.2 | 5.42 | -10.4 |
| OAK | -3.72 | -0.76 | 1.72 | 2.36 | 2.06 | -14.0 | -17.3 |
| SJC | -5 | 1.2 | 2.12 | 2.3 | 2.02 | -5.93 | -22.6 |


- Airports with long-run forecast CAGR >4 % or <-0.5 %, or |2025 YoY| >15 %: none

- Year-over-year changes >40 % in 2015–2030 (airport, FY, %): [('BOS', 2020, -51.3), ('BOS', 2022, 95.0), ('BDL', 2020, -47.1), ('BDL', 2022, 54.5), ('PVD', 2020, -48.5), ('PVD', 2022, 64.8), ('MHT', 2020, -45.6), ('MHT', 2022, 68.9), ('PWM', 2020, -48.7), ('BTV', 2020, -50.3), ('BTV', 2022, 106.2), ('LAX', 2020, -51.4), ('LAX', 2022, 62.6), ('SNA', 2020, -48.4), ('SNA', 2022, 82.5), ('BUR', 2020, -40.5), ('BUR', 2022, 114.4), ('LGB', 2020, -49.2), ('LGB', 2022, 105.0), ('ONT', 2022, 54.9), ('ANC', 2020, -45.6), ('FAI', 2020, -44.5), ('SFO', 2020, -52.8), ('SFO', 2022, 108.4), ('OAK', 2020, -47.8), ('OAK', 2022, 60.5), ('SJC', 2020, -50.4), ('SJC', 2022, 89.0)]

- Fiscal year (Oct–Sep), not calendar year; FY2020/FY2021 absorb COVID: real extreme, not error.

- 2019 baseline present for 16/16 airports; zero-valued rows in scope: 0


#### Airports table (selected)


| LOCID | APORT_NAME | STATE | FAC_CLASS | SER_VOL | HUB_SIZE | ATCT_FLAG | OEP35 |
|---|---|---|---|---|---|---|---|
| BOS | General Edward Lawrence Logan International | MA | 7 | 412,000 | 3 | 1 | 1 |
| BDL | Bradley International | CT | 7 | 300,000 | 2 | 1 | 0 |
| PVD | Rhode Island Tf Green International | RI | 3 | 330,000 | 1 | 1 | 0 |
| MHT | Manchester Boston Regional | NH | 7 | 185,000 | 1 | 1 | 0 |
| PWM | Portland International Jetport | ME | 3 | 256,000 | 1 | 1 | 0 |
| BTV | Patrick Leahy Burlington International | VT | 3 | 208,000 | 1 | 1 | 0 |
| LAX | Los Angeles International | CA | 7 | 675,000 | 3 | 1 | 1 |
| SNA | John Wayne/Orange County | CA | 7 | 355,000 | 2 | 1 | 0 |
| BUR | Bob Hope | CA | 7 | 230,000 | 2 | 1 | 0 |
| LGB | Long Beach (Daugherty Field) | CA | 7 | 370,000 | 1 | 1 | 0 |
| ONT | Ontario International | CA | 7 | 355,000 | 2 | 1 | 0 |
| ANC | Ted Stevens Anchorage International | AK | 7 | 307,000 | 2 | 1 | 0 |
| FAI | Fairbanks International | AK | 3 | 285,000 | 1 | 1 | 0 |
| SFO | San Francisco International | CA | 7 | 393,000 | 3 | 1 | 1 |
| OAK | San Francisco Bay Oakland International | CA | 7 | 625,000 | 2 | 1 | 0 |
| SJC | Norman Y Mineta San Jose International | CA | 7 | 385,000 | 2 | 1 | 0 |


### Anything surprising (FAA TAF 2025)

- **Definition error in `docs/data-sources.md`:** total enplanements = `aac+aat+commuter` excludes international. International (`us_flag`+`frgn_flag`) is 28-31 % of LAX, 25-29 % of SFO, 17-20 % of BOS in 2019-2025 (and will be 40 % at LAX by 2055). The 5-column sum matches T-100 (BOS 2019: 20.56 M vs 20.74 M; LAX 42.8 M vs 43.4 M).
- **`locid` whitespace:** the scoped CSVs are already trimmed (0 padded IDs); only `APORT_NAME` is space-padded. The warning in the docs applies to the original xlsx, not to these files.
- **FY2025 is still a forecast** in this release, although FY2025 has ended (T-100 has the actual): TAF forecasts OAK 4.69 M and SFO 26.1 M for FY2025, while T-100 shows 4.56 M and 26.5 M for calendar 2025 (within 3 %). Actuals end at FY2024.
- Forecast growth is not absurd (5-column totals): 2024-2055 CAGR is 1.0-2.6 % everywhere (MHT 1.0 %, SFO 2.6 %, BOS 2.2 %, LAX 2.2 %). Near-term CAGR 2024-2030 is 3.4-4.1 % at MHT, PVD, BTV and SFO (recovery rather than growth) and negative only for LGB (-0.8 %) and OAK (-0.8 %). One-year jumps: OAK FY2025 -14.0 % (real; T-100 shows -14.7 % for calendar 2025), PVD +11.1 %, BTV +10.2 %, PWM +7.6 % (plausible recovery). No flag exceeded the thresholds (long-run CAGR above 4 % or below -0.5 %, or a one-year move above 15 %).
- 2024 actuals are still below 2019 at 8 of 16 airports: MHT -26 %, SJC -23 %, OAK -17 %, LAX -12 %, SFO -10 %, BTV -5 %, PVD -4 %, BDL -3 %; ONT +30 %, LGB +18 %, BUR +15 %. A "growth vs 2019" score and a "forecast growth" score therefore mostly measure recovery, not underlying growth.
- **Operations totals are dominated by general aviation:** BTV total ops +30 % from 2019 to 2024 (73,529 to 95,875) while commercial ops fell 14 %; LGB total ops +33 %. Use `itn_Ac + itn_at` (commercial) for congestion, not the total.

## 6. FAA NAS Status (live)

**Files:** `airport-status-information.xml` (1.3 KB), `airport-events.json` (4.0 KB) · single live snapshot, no history, no date coverage beyond the capture time.


#### XML structure (element: count)


`AIRPORT_STATUS_INFORMATION`=1, `Update_Time`=1, `Dtd_File`=1, `Delay_type`=2, `Name`=2, `Airport_Closure_List`=2, `Airport`=4, `ARPT`=4, `Reason`=4, `Start`=4, `Reopen`=4


- Root `AIRPORT_STATUS_INFORMATION`, `Update_Time` = Tue Nov 10 16:09:15 2026 GMT; `Delay_type` blocks: 2 (names: ['Airport Closures', 'Airport Closures'])


#### XML events


| type | airport | start | reopen | reason |
|---|---|---|---|---|
| Airport Closures | SNA | Nov 10 at 07:30 UTC. | Nov 21 at 14:15 UTC. | !SNA 11/008 SNA AD AP CLSD DLY 0730-1415 2611100730-2611211415 |
| Airport Closures | LAX | May 27 at 18:26 UTC. | May 28 at 16:00 UTC. | !LAX 05/277 LAX AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR CTC ATLANTIC AVIATION 310-258-9884 OR SI |
| Airport Closures | SAN | Oct 01 at 16:33 UTC. | Jan 01 at 08:00 UTC. | !SAN 10/004 SAN AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC PPR 619-298-7704 2610011633-2701010800 |
| Airport Closures | LAS | Oct 28 at 19:26 UTC. | Jan 27 at 23:00 UTC. | !LAS 10/160 LAS AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR 702-261-7775 2610281926-2701272300 |


**Our airports in XML snapshot:** ['SNA', 'LAX'] · airports are 3-letter IATA codes in XML.


#### JSON structure


- Top-level type: `list` with 5 airport objects

- Fields (present count): `airportId`=5, `groundStop`=5, `groundDelay`=5, `airportClosure`=5, `freeForm`=5, `arrivalDelay`=5, `departureDelay`=5, `airportConfig`=5, `deicing`=5, `airportLongName`=5, `latitude`=5, `longitude`=5


#### JSON: airports and active event types


| airportId | name | active | in_scope |
|---|---|---|---|
| ABQ | Albuquerque International Sunport | deicing | 0 |
| LAS | Harry Reid International | freeForm, airportConfig | 0 |
| LAX | Los Angeles International | freeForm, airportConfig | 1 |
| SAN | San Diego-Lindbergh Field | freeForm, airportConfig | 0 |
| SNA | John Wayne Airport-Orange County | airportClosure, airportConfig | 1 |


- Null counts per event field (of 5): {'groundStop': 5, 'groundDelay': 5, 'airportClosure': 4, 'freeForm': 2, 'arrivalDelay': 5, 'departureDelay': 5, 'airportConfig': 1, 'deicing': 4}

- Airport IDs in JSON are 3-letter IATA-style: all match `^[A-Z]{3}$`: True


#### Current status of our 16 airports (from both files)


| airport | JSON | XML events | note |
|---|---|---|---|
| BOS | not listed (no active event) | 0 |  |
| BDL | not listed (no active event) | 0 |  |
| PVD | not listed (no active event) | 0 |  |
| MHT | not listed (no active event) | 0 |  |
| PWM | not listed (no active event) | 0 |  |
| BTV | not listed (no active event) | 0 |  |
| LAX | event: freeForm, airportConfig | 1 | !LAX 05/277 LAX AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR CTC ATLANTIC AVIATIO |
| SNA | event: airportClosure, airportConfig | 1 |  |
| BUR | not listed (no active event) | 0 |  |
| LGB | not listed (no active event) | 0 |  |
| ONT | not listed (no active event) | 0 |  |
| ANC | not listed (no active event) | 0 |  |
| FAI | not listed (no active event) | 0 |  |
| SFO | not listed (no active event) | 0 |  |
| OAK | not listed (no active event) | 0 |  |
| SJC | not listed (no active event) | 0 |  |


Note: SNA's XML entry is a daily curfew-type NOTAM closure (`AP CLSD DLY 0730-1415` UTC), and LAX's is GA-only; neither is a scheduled-service disruption. Parse `Reason` text before treating `Airport Closures` as an outage.

- Timestamp differences: XML uses free-text 'Nov 10 at 07:30 UTC.' strings (no year); JSON uses ISO-8601. Use JSON where possible.


### Anything surprising (FAA NAS Status (live))

- Two-airport hit rate for our scope: SNA and LAX. Neither is a service disruption: SNA's entry is a recurring night curfew NOTAM (`AP CLSD DLY 0730-1415` UTC = about 23:30-06:15 local); LAX's is a GA-only restriction. The XML window strings ("May 27 ... May 28") carry no year; the LAX NOTAM id `2605271826-2705281600` shows it actually runs May 2026 to May 2027.
- JSON (5 airports) and XML (4 airport entries over 2 Delay_type blocks) do not list the same airports (ABQ only in JSON, SAN/LAS/LAX/SNA in both). Do not assume either is complete.
- The snapshot has zero ground stops, ground delays or arrival/departure delays anywhere, so the schemas of those event types are unobserved.

## 7. Cross-source


#### Do all 16 airports appear in every source?


|  | OurAirports | T-100 | On-Time | Fares | TAF | NAS snapshot |
|---|---|---|---|---|---|---|
| BOS | yes | yes | yes | yes | yes | NO |
| BDL | yes | yes | yes | yes | yes | NO |
| PVD | yes | yes | yes | yes | yes | NO |
| MHT | yes | yes | yes | yes | yes | NO |
| PWM | yes | yes | yes | yes | yes | NO |
| BTV | yes | yes | yes | yes | yes | NO |
| LAX | yes | yes | yes | yes | yes | yes |
| SNA | yes | yes | yes | yes | yes | yes |
| BUR | yes | yes | yes | yes | yes | NO |
| LGB | yes | yes | yes | yes | yes | NO |
| ONT | yes | yes | yes | yes | yes | NO |
| ANC | yes | yes | yes | yes | yes | NO |
| FAI | yes | yes | yes | yes | yes | NO |
| SFO | yes | yes | yes | yes | yes | NO |
| OAK | yes | yes | yes | yes | yes | NO |
| SJC | yes | yes | yes | yes | yes | NO |


NAS is a live snapshot listing only airports with an active event, so absence is expected (not a gap).

- Missing per historical source: none


#### IATA code consistency (raw values, before any normalisation)


| source.column | values checked | case/whitespace problems | scope airports found | code length set |
|---|---|---|---|---|
| OurAirports.iata_code | 16 | 0 | 16/16 | 3 |
| T-100 ORIGIN | 652,065 | 0 | 16/16 | 3 |
| T-100 DEST | 652,065 | 0 | 16/16 | 3 |
| Fares.airport_code | 480 | 0 | 16/16 | 3 |
| TAF enplanements.locid | 1,280 | 0 | 16/16 | 3 |
| TAF operations.locid | 1,056 | 0 | 16/16 | 3 |
| TAF airports.LOCID | 16 | 0 | 16/16 | 3 |
| On-Time Origin | 188 | 0 | 16/16 | 3 |
| On-Time Dest | 187 | 0 | 16/16 | 3 |


All sources use 3-letter IATA codes for scope airports with no case/space issues in the scoped extracts. Only join key to avoid: OurAirports runways use ICAO `airport_ident` (KBOS), and the TAF airports table `APORT_NAME` is space-padded. The docs warn of padded `locid`; the scoped CSVs are already trimmed (a re-extract from the original xlsx would not be).


#### Period coverage and overlap


| source | grain | first | last | note |
|---|---|---|---|---|
| T-100 | month | 2019-01 | 2026-07 | 2026 partial (Jan-Jul) |
| On-Time | day | 2019-01 | 2026-08 | 2026 partial (Jan-Aug) |
| Fares | quarter | 2019Q1 | 2026Q2 | 2026 Q1-Q2 only |
| TAF | fiscal year | FY1976 | FY2055 | actual to FY2024, forecast FY2025-FY2055 |
| NAS | snapshot | Tue Nov 10 16:09:15 2026 GMT | Tue Nov 10 16:09:15 2026 GMT | no history |


- **Window where T-100, On-Time and Fares all have data:** 2019-01 -> 2026-06 (quarters 2019Q1-2026Q2). Months 2026-07 (T-100, On-Time) and 2026-08 (On-Time only) have no fares.
- **Complete calendar years in all three monthly sources:** 2019-2025. 2026 is partial everywhere.
- TAF actuals end FY2024: FY2025 (already finished) is still a forecast in the TAF, so for 2025 T-100 is the better 'actual'.


#### Reconciliation: T-100 enplaned passengers (F+L, calendar year) vs TAF enplanements (fiscal year)


|  | T-100 2019 | TAF total 2019 | T-100/TAF 2019 | T-100/TAF-domestic 2019 | T-100 2024 | TAF total 2024 | T-100/TAF 2024 | T-100/TAF-domestic 2024 | T-100 2025 | TAF total 2025 | T-100/TAF 2025 | T-100/TAF-domestic 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOS | 20,742,138 | 20,564,417 | 1.01 | 1.22 | 21,305,085 | 20,871,588 | 1.02 | 1.26 | 21,143,295 | 21,200,148 | 0.997 | 1.25 |
| BDL | 3,341,910 | 3,324,206 | 1 | 1.02 | 3,299,417 | 3,211,540 | 1.03 | 1.04 | 3,289,186 | 3,327,536 | 0.988 | 1.01 |
| PVD | 1,974,726 | 1,979,208 | 0.998 | 1.02 | 1,990,715 | 1,902,797 | 1.05 | 1.05 | 2,122,707 | 2,113,790 | 1 | 1 |
| MHT | 855,119 | 854,439 | 1 | 1 | 634,256 | 630,278 | 1.01 | 1.01 | 686,314 | 672,741 | 1.02 | 1.02 |
| PWM | 1,089,427 | 1,100,109 | 0.99 | 0.99 | 1,222,400 | 1,195,118 | 1.02 | 1.02 | 1,287,476 | 1,285,737 | 1 | 1 |
| BTV | 686,852 | 684,951 | 1 | 1 | 670,834 | 647,634 | 1.04 | 1.04 | 709,116 | 713,971 | 0.993 | 0.993 |
| LAX | 43,381,757 | 42,843,858 | 1.01 | 1.42 | 38,249,501 | 37,806,366 | 1.01 | 1.45 | 36,778,508 | 36,855,152 | 0.998 | 1.45 |
| SNA | 5,216,290 | 5,153,073 | 1.01 | 1.03 | 5,388,351 | 5,424,464 | 0.993 | 1.03 | 5,532,646 | 5,452,720 | 1.01 | 1.04 |
| BUR | 3,184,417 | 2,886,254 | 1.1 | 1.1 | 3,395,510 | 3,313,970 | 1.02 | 1.02 | 3,222,436 | 3,329,148 | 0.968 | 0.968 |
| LGB | 1,753,918 | 1,731,868 | 1.01 | 1.01 | 2,061,417 | 2,034,910 | 1.01 | 1.01 | 1,889,338 | 1,883,821 | 1 | 1 |
| ONT | 2,780,468 | 2,640,652 | 1.05 | 1.1 | 3,530,729 | 3,441,965 | 1.03 | 1.1 | 3,497,552 | 3,485,239 | 1 | 1.08 |
| ANC | 2,702,781 | 2,665,124 | 1.01 | 1.03 | 2,736,915 | 2,729,138 | 1 | 1.01 | 2,714,251 | 2,691,637 | 1.01 | 1.01 |
| FAI | 583,424 | 556,057 | 1.05 | 1.05 | 574,396 | 568,707 | 1.01 | 1.01 | 563,572 | 567,403 | 0.993 | 0.993 |
| SFO | 27,877,799 | 27,654,594 | 1.01 | 1.35 | 25,301,280 | 24,765,642 | 1.02 | 1.45 | 26,488,386 | 26,106,891 | 1.01 | 1.41 |
| OAK | 6,769,889 | 6,585,522 | 1.03 | 1.09 | 5,347,249 | 5,449,160 | 0.981 | 1.04 | 4,561,915 | 4,685,564 | 0.974 | 1.06 |
| SJC | 7,802,358 | 7,511,903 | 1.04 | 1.09 | 5,865,922 | 5,811,337 | 1.01 | 1.07 | 5,283,980 | 5,466,921 | 0.967 | 1.02 |


With the 5-column TAF total (incl. `us_flag`+`frgn_flag`) the ratio is ~1.0 (diff = calendar vs fiscal year, foreign-carrier segments, connecting-passenger handling). With the documented 3-column total it is 1.2-1.4x for gateway airports.

- Airports where T-100/TAF is outside 0.90-1.10 in 2019, 2024 or 2025 (TAF 2025 is a forecast): {'BUR': (1.103, 1.025, 0.968)}


#### Reconciliation: On-Time departures vs T-100 passenger departures


(on-time departures as % of T-100 F+L performed departures; see On-Time section)

| Origin | 2019 | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| BOS | 77.2 | 78.4 | 76.3 | 75.6 |
| BDL | 93.6 | 84.9 | 82.1 | 81.4 |
| PVD | 89.7 | 82.7 | 75.1 | 74.1 |
| MHT | 74.8 | 86.9 | 74.1 | 70.5 |
| PWM | 75.2 | 91.9 | 88.6 | 76.6 |
| BTV | 81.6 | 89.7 | 87.5 | 67.6 |
| LAX | 70.0 | 76.5 | 75.2 | 73.4 |
| SNA | 85.8 | 90.4 | 89.6 | 88.5 |
| BUR | 85.9 | 81.3 | 80.5 | 81.6 |
| LGB | 98.6 | 98.8 | 99.8 | 99.4 |
| ONT | 94.6 | 94.4 | 93.7 | 91.9 |
| ANC | 50.4 | 46.2 | 43.3 | 49.4 |
| FAI | 29.5 | 19.1 | 21.2 | 22.8 |
| SFO | 81.0 | 78.4 | 77.0 | 77.0 |
| OAK | 85.7 | 90.3 | 87.6 | 82.3 |
| SJC | 85.4 | 93.4 | 93.7 | 91.9 |


#### Fares 10 % sample vs T-100 2025


| airport_code | rank | pax10 | T-100 2025 pax | T-100 rank among 16 | fares rank among 16 | pax10 x10 / T-100 (enpl) |
|---|---|---|---|---|---|---|
| BOS | 5 | 986,868 | 21,143,295 | 3 | 2 | 0.47 |
| BDL | 51 | 210,677 | 3,289,186 | 8 | 7 | 0.64 |
| PVD | 64 | 123,931 | 2,122,707 | 11.0 | 10.0 | 0.58 |
| MHT | 119 | 37,031 | 686,314 | 15.0 | 14.0 | 0.54 |
| PWM | 93 | 65,280 | 1,287,476 | 13.0 | 13.0 | 0.51 |
| BTV | 120 | 36,575 | 709,116 | 14.0 | 15.0 | 0.52 |
| LAX | 1 | 1,284,083 | 36,778,508 | 1 | 1 | 0.35 |
| SNA | 47 | 254,126 | 5,532,646 | 4 | 6 | 0.46 |
| BUR | 54 | 183,243 | 3,222,436 | 9 | 9 | 0.57 |
| LGB | 73 | 102,848 | 1,889,338 | 12.0 | 12.0 | 0.54 |
| ONT | 52 | 198,746 | 3,497,552 | 7 | 8 | 0.57 |
| ANC | 69 | 113,291 | 2,714,251 | 10.0 | 11.0 | 0.42 |
| FAI | 137 | 27,618 | 563,572 | 16.0 | 16.0 | 0.49 |
| SFO | 10 | 844,286 | 26,488,386 | 2 | 3 | 0.32 |
| OAK | 42 | 268,902 | 4,561,915 | 6 | 5 | 0.59 |
| SJC | 36 | 305,263 | 5,283,980 | 5 | 4 | 0.58 |


The fares file's passenger sample counts itineraries/tickets (round trips and O&D), not segment enplanements, so exact agreement is not expected; rank order is the useful check.


### Anything surprising (cross-source)

- **T-100 vs TAF reconciles only with the 5-column TAF total**, and TAF is a fiscal year (Oct-Sep), T-100 a calendar year. Use T-100 for actuals through 2026-07 and TAF only for forward growth ratios (for example FY2030/FY2025), not for level comparisons.
- **On-Time and T-100 agree on direction but not on scale** (see coverage table): any per-flight metric from On-Time at ANC/FAI describes a minority of the traffic.
- The fares passenger sample ranks airports consistently with T-100 for the top (LAX, BOS, SFO) but is itinerary-based.
- Airports appear in the same code format in all sources: no case or whitespace issues were found in any scoped extract.

## 8. Risks for the four questions

### Q1. Which New England airports are strong expansion candidates?
**Uses:** T-100 (load factor, seats, enplanements 2019 vs latest), TAF (forward growth), On-Time (delay, cancel, taxi-out), Fares (pricing), OurAirports (runways) for BOS, BDL, PVD, MHT, PWM, BTV.

| What could go wrong | Impact |
|---|---|
| No capacity data (gates, terminal sqft) anywhere, so "strong candidate" is a demand-pressure proxy | High: must be stated in the answer |
| Growth vs 2019 mixes recovery and growth: MHT is -26 % vs 2019 but TAF forecasts +22 % by 2030; PWM is +9 % and BOS about 0 % | High: normalise growth to 2023-2025 run-rate, not only to 2019 |
| 2026 partial: using full-year 2025 vs Jan-Jul 2026 totals would show a fake ~40 % drop | High unless same-window comparisons are used |
| On-Time coverage falls at BTV (62-68 % since 2025), PVD, MHT (70-76 %) because Breeze/Avelo/GoJet are not reporting carriers: delay metrics drift with carrier mix | Medium |
| Fare "pricing power" has no national benchmark; BTV looks high (1.25 of the 16-airport median) partly because of thin competition and small 10 % samples | Medium |
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
| **The answer depends on the definition.** Passenger-class share of ANC departures at >= 1,000 mi is 34.0 %, >= 1,500 mi 14.3 %, >= 2,000 mi 11.9 %, >= 2,500 mi 8.2 %. ANC-SEA is 1,448 mi and is 19.0 % of passenger departures, so a 1,500 mi cut-off sits right on top of the biggest route | **Critical**: pick and state the threshold up front |
| Cargo: 57.2 % of ANC departures are G/P freighters. Including them gives >= 1,500 mi share 46.1 % of all departures, versus 14.3 % for passenger flights; the user's wording "flights" is ambiguous | **Critical** |
| Rows are carrier-route-aircraft-month aggregates: must weight by `DEPARTURES_PERFORMED`, never count rows | High |
| Same-airport rows (ANC-ANC, 786 rows) have distance 0; they count as short-haul flights unless excluded | Medium |
| On-Time cannot be used (covers 43-59 % of ANC passenger departures depending on year, no freight) | Info |
| 2026 partial: compute per full year (2019-2025) and report 2025 as latest | Low |

### Q4. Unmet demand at SFO, and why
**Uses:** T-100 (seats, passengers, load factor, departures), On-Time (delay, cancellations), Fares (SFO vs peers), TAF (forecast), plus OAK/SJC T-100 for Bay Area context.

| What could go wrong | Impact |
|---|---|
| True unmet demand needs O&D/booking data (not in scope); load factor 0.82 (2025) vs 0.82 (2019) with monthly peaks of 0.91 (2024-6) is only a proxy: high LF can mean efficient capacity, not unmet demand | **Critical**: must be framed as an inference |
| "Why" is not in the data: no slot, gate or airline-strategy information. Hypotheses from the data: SFO traffic is still about 5 % below 2019 in 2025 while OAK (-33 %) and SJC (-32 %) are far lower, so capacity moved or was cut; this is correlation | High |
| `DEPARTURES_SCHEDULED` cannot be used to show cancelled capacity (performed exceeds scheduled at SFO: 1.12x in 2025) | High |
| Seats are available seats: they include non-revenue and lag airline schedule changes; passengers exclude non-revenue | Low |
| On-Time covers about 77 % of SFO passenger departures (missing mostly foreign airlines) | Medium |
| Fare "pressure" needs a benchmark: SFO fares are 1.18 of the 16-airport median, a California-heavy set | Medium |
| TAF vs T-100 level differences if mixed (fiscal vs calendar year, definition issue above) | Medium |

## 9. Proposed cleaning plan (for approval)

Each rule says what it does, why, and the expected row impact **computed from the data** (counts are rows removed/changed/flagged; nothing is deleted from `data/raw/`). Please approve, change or reject each one.

| # | Source | Rule | Expected row impact | Why |
|---|---|---|---|---|
| 1 | All | Normalise airport codes with `strip().upper()`; join on IATA (TAF `locid`, fares `airport_code`, T-100/On-Time `ORIGIN`/`DEST`); OurAirports joins via `ident` | 0 rows (no problems found) | Cheap safeguard if files are re-extracted |
| 2 | T-100 | Passenger table: keep `CLASS` in (F, L) only. Cargo table: keep G, P separately for the ANC freight context | Passenger: **531,249** rows kept; **120,816** G/P rows moved to the cargo table (18.5 % of 652,065) | Freight must not enter load factor/long-haul passenger shares |
| 3 | T-100 | Sum the 1,739 natural-key collisions into one row per (year, month, carrier, origin, dest, aircraft type, config, class) | -1,739 rows total, of which -250 are passenger-class; passenger totals unchanged | They are separate partial records, not duplicates |
| 4 | T-100 | For load factor only: use rows with `SEATS>0` and `DEPARTURES_PERFORMED>0`; for passenger counts keep every F/L row | LF excludes 1,505 of 279,507 scope-origin passenger rows (all zero-seat or schedule-only placeholders; 980 rows are all-zero) | Schedule-only rows add nothing and distort row-level averages |
| 5 | T-100 | Rows with passengers > seats: keep, add `lf_anomaly` flag; compute airport LF as sum(pax)/sum(seats) (never average row LFs) | 61 rows flagged (5,179 pax; 47 above 1.05); 0 removed | Tiny air-taxi aircraft; immaterial at aggregate level |
| 6 | T-100 | Exclude `DISTANCE=0` rows from all distance/long-haul metrics; keep them in passenger totals | 1,938 rows (1,057 passenger-class, 11,085 pax) | Same-airport local flights |
| 7 | T-100 | Airport traffic is defined on `ORIGIN` basis (enplaned); departures from `ORIGIN`; no sum of origin and destination sides. Both-in-scope rows (32,139, 4.9 %) are kept once and counted only for their origin airport | 0 rows removed; avoids double counting 85,739,419 passengers | Prevents LAX-SFO type double counting |
| 8 | T-100 / On-Time / Fares | Partial 2026: keep, add `is_partial_year`; annual metrics use 2019-2025 only; latest-state metrics use the last full 12 months or same-window YTD comparisons (Jan-Jul) | T-100 53,144 rows and On-Time 2026 rows flagged, 0 removed | Avoid fake 2026 drops |
| 9 | T-100 / On-Time | Common analysis window for scoring: 2019-01 to 2026-06 (where fares exist); months after that kept for "latest" views only. On-Time rows after T-100's last month (202607): 126,239 | 0 removed, flagged | Align sources |
| 10 | T-100 | Do not use `DEPARTURES_SCHEDULED` for anything; cancelled capacity comes from On-Time only | 0 rows; column ignored | Zero on 27.7 % of flown passenger rows |
| 11 | On-Time | Keep all rows (no duplicates). Delay statistics use flown flights (`Cancelled=0` and `Diverted=0`); cancelled and diverted are kept for rate metrics | Cancelled **193,551**, diverted **21,331** excluded from delay stats only; **9,951,064** flown rows used | Delay is undefined for cancelled/diverted |
| 12 | On-Time | Delay-cause columns: do not impute; analyse only `ArrDel15=1` rows; leave nulls elsewhere. Drop the single delayed flight with all five causes null from cause analyses | 8,256,406 null cells are by design (81 %); **1** row excluded from cause analyses | Cause is only reported for delayed arrivals |
| 13 | On-Time | Extreme delays: keep; headline metrics are median, p95 and % delayed 15+ min. Any mean is also reported with arrival delay capped at 600 min | 10,456 in-scope flights (>600 min) affected by the capped mean; 0 removed | Real events, but they distort means |
| 14 | On-Time | ANC and FAI: mark delay/congestion metrics `low_coverage` (roughly 43-59 % and 19-33 % of passenger departures); decision needed whether they enter the congestion score, are given a neutral value, or are reported as "n/a" | 0 rows; scoring decision | Reporting-carrier sample is not representative |
| 15 | On-Time | LAX/SFO/BOS (about 75-80 % coverage): keep, add a `coverage_pct` field per airport-year from T-100 | 0 rows; 1 field | Transparency |
| 16 | Fares | Keep all 480 rows; use nominal for current pricing-power comparison and inflation-adjusted for trends; compute "vs benchmark" from the latest 4 quarters (2025Q3-2026Q2) to dampen seasonality and small samples; treat 2026Q2 as provisional | 0 removed | Smooths ANC/FAI noise |
| 17 | Fares | **Decision needed:** national benchmark. Options: (a) median of the 16 airports (available now, biased to California), (b) add an external national average fare series (new source) | 0 rows; adds a source if (b) | File has no national figure |
| 18 | TAF | Total enplanements = `aac+aat+commuter+us_flag+frgn_flag`; correct `docs/data-sources.md` (server/client/shared/prisma untouched). Keep the scenario flag (0 actual, 1 forecast) | 0 rows; documentation fix | Reconciles with T-100 |
| 19 | TAF | Use TAF for forward growth only (ratios such as FY2030 / FY2025), not for levels; use T-100 for actuals including 2025 and YTD 2026. Commercial ops = `itn_Ac+itn_at` | 0 rows | Fiscal vs calendar year; FY2025 is a forecast; GA noise |
| 20 | TAF / all | Strip whitespace from `APORT_NAME` and use OurAirports names (or a fixed lookup of 16 display names) for display | 16 rows | Padded names; OAK name mismatch |
| 21 | OurAirports | Count runways with `closed=0`; longest open runway; keep `type` and `scheduled_service` | 4 runway rows excluded (BDL (1), LGB (2), SJC (1)); 50 -> 46 | Closed runways |
| 22 | NAS | Parse JSON (ISO times) as the primary source; XML as fallback; parse the NOTAM text to separate curfews/GA restrictions from true closures; cache snapshots with a timestamp | 0 rows; NAS is live only | No history |
| 23 | All | Outputs: write only to `data/clean/` (parquet or csv), one table per source plus a `data_quality_flags` table; never edit `data/raw/` | n/a | Keeps raw read-only |

**Decisions I need from you:**
1. **Long-haul definition for ANC** (rule 2/6 feed it): which distance cut-off (1,000 / 1,500 / 2,000 / 2,500 mi) and whether to count freight? The answer ranges from 8.2 % to 34.0 % on the passenger-only basis alone.
2. **ANC/FAI in the congestion component** (rule 14): include with a low-confidence flag, neutral score, or exclude?
3. **Fare benchmark** (rule 17): use the 16-airport median, or add an external national series?
4. **Growth baseline** (rules 8, 19): growth vs 2019, vs 2023-2025 run-rate, or both?
5. **Approve correcting `docs/data-sources.md`** for the TAF total definition (rule 18)?

## 10. Clean data schema (`data/clean/`)

Generated by `etl/clean/run_clean.py`. Raw files are untouched. CSV, UTF-8, header row, booleans as `True`/`False`, empty = null. Scoring window = 2019-01 to 2026-06.

### 10.1 Files, rows and grain

| File | Entity | Rows | Grain |
|---|---|---|---|
| `airports.csv` | Airport | 16 | 1 row per scope airport (16) |
| `route_stats.csv` | RouteStat (monthly) | 311,487 | year x month x origin x dest x carrier x service_class x is_international; passenger classes F/L only; aircraft type aggregated away; origin or dest in scope |
| `cargo_route_stats.csv` | Cargo (monthly) | 90,002 | As route_stats for service_class G (scheduled all-cargo) and P (non-scheduled all-cargo) |
| `delay_stats.csv` | DelayStat (monthly per airport) | 2,944 | airport x year x month x direction (dep = flights leaving, arr = flights arriving); aggregated from 10.2 M flight rows |
| `fares.csv` | Fare (quarterly) | 480 | airport x year x quarter (480 rows) |
| `forecast.csv` | Forecast (annual) | 1,280 | airport x TAF fiscal year (Oct-Sep), actual to FY2024, forecast FY2025-FY2055 |
| `airport_metrics.csv` | Growth and load-factor metrics (derived, per airport) | 16 | 1 row per scope airport; both growth definitions stored, scoring config picks |
| `data_quality_flags.csv` | data_quality_flags | 31 | 1 row per flag (source, table, optional airport/period) |

### 10.2 `airports.csv` - Airport

Grain: 1 row per scope airport (16).

| Column | Type | Nulls | Description |
|---|---|---|---|
| `airport` | string | 0 | IATA code (key) |
| `icao_ident` | string | 0 | OurAirports ident (join key for runways) |
| `name` | string | 0 | OurAirports name |
| `city` | string | 0 | Municipality |
| `state` | string | 0 | US state code |
| `region_group` | string | 0 | New England / Southern California / Bay Area / Alaska |
| `is_new_england` | boolean | 0 | Q1 scope flag |
| `airport_type` | string | 0 | OurAirports type |
| `scheduled_service` | string | 0 | yes/no |
| `latitude` | decimal | 0 | deg |
| `longitude` | decimal | 0 | deg |
| `open_runways` | integer | 0 | Runways with closed=0 |
| `closed_runways` | integer | 0 | Runways with closed=1 |
| `longest_open_runway_ft` | integer | 0 | Longest open runway |
| `taf_hub_size` | integer | 0 | FAA hub size code (1-3) |
| `taf_facility_class` | integer | 0 | FAA facility class code |

### 10.3 `route_stats.csv` - RouteStat (monthly)

Grain: year x month x origin x dest x carrier x service_class x is_international; passenger classes F/L only; aircraft type aggregated away; origin or dest in scope.

| Column | Type | Nulls | Description |
|---|---|---|---|
| `year` | integer | 0 | Calendar year |
| `month` | integer | 0 | 1-12 |
| `period` | string | 0 | YYYY-MM |
| `origin` | string | 0 | IATA |
| `dest` | string | 0 | IATA |
| `carrier` | string | 0 | T-100 unique carrier code |
| `carrier_name` | string | 0 | Carrier name |
| `service_class` | string | 0 | F scheduled, L non-scheduled |
| `is_international` | boolean | 0 | DATA_SOURCE IU/IF |
| `departures` | decimal | 0 | Departures performed |
| `seats` | decimal | 0 | Seats available |
| `passengers` | decimal | 0 | Passengers |
| `distance` | decimal | 0 | Route distance, miles |
| `distance_valid` | boolean | 0 | false when distance=0 (same-airport) |
| `lf_eligible` | boolean | 0 | seats>0 and departures>0: use for load factor |
| `lf_anomaly` | boolean | 0 | passengers>seats (kept) |
| `origin_in_scope` | boolean | 0 | origin is one of 16 |
| `dest_in_scope` | boolean | 0 | dest is one of 16 |
| `is_partial_year` | boolean | 0 | latest (incomplete) year |
| `in_scoring_window` | boolean | 0 | 2019-01..2026-06 |

### 10.4 `cargo_route_stats.csv` - Cargo (monthly)

Grain: As route_stats for service_class G (scheduled all-cargo) and P (non-scheduled all-cargo).

| Column | Type | Nulls | Description |
|---|---|---|---|
| `year` | integer | 0 |  |
| `month` | integer | 0 |  |
| `period` | string | 0 |  |
| `origin` | string | 0 |  |
| `dest` | string | 0 |  |
| `carrier` | string | 0 |  |
| `carrier_name` | string | 0 |  |
| `service_class` | string | 0 |  |
| `is_international` | boolean | 0 |  |
| `departures` | decimal | 0 |  |
| `freight_lbs` | decimal | 0 | Freight pounds |
| `mail_lbs` | decimal | 0 | Mail pounds |
| `passengers` | decimal | 0 | ~0 (kept for audit) |
| `distance` | decimal | 0 |  |
| `distance_valid` | boolean | 0 |  |
| `origin_in_scope` | boolean | 0 |  |
| `dest_in_scope` | boolean | 0 |  |
| `is_partial_year` | boolean | 0 |  |
| `in_scoring_window` | boolean | 0 |  |

### 10.5 `delay_stats.csv` - DelayStat (monthly per airport)

Grain: airport x year x month x direction (dep = flights leaving, arr = flights arriving); aggregated from 10.2 M flight rows.

| Column | Type | Nulls | Description |
|---|---|---|---|
| `airport` | string | 0 | IATA |
| `month` | integer | 0 | 1-12 |
| `year` | integer | 0 | Calendar year |
| `direction` | string | 0 | dep or arr |
| `period` | string | 0 | YYYY-MM |
| `flights` | integer | 0 | All scheduled flights in On-Time file |
| `cancelled` | integer | 0 | Cancelled |
| `diverted` | integer | 0 | Diverted |
| `flown` | integer | 0 | Not cancelled and not diverted |
| `delayed15` | integer | 0 | Flown flights delayed 15+ min (DepDel15 for dep, ArrDel15 for arr) |
| `carrier_min` | decimal | 0 | Carrier-delay minutes (sum, flown; cause fields attach to arrival delay) |
| `weather_min` | decimal | 0 | Weather-delay minutes |
| `nas_min` | decimal | 0 | NAS-delay minutes |
| `security_min` | decimal | 0 | Security-delay minutes |
| `late_aircraft_min` | decimal | 0 | Late-aircraft minutes |
| `nas_delayed_flights` | integer | 0 | Flown flights with NASDelay>0 |
| `median_delay_min` | decimal | 0 | Median DepDelay (dep) / ArrDelay (arr), flown |
| `p95_delay_min` | decimal | 0 | 95th percentile delay |
| `mean_delay_capped600_min` | decimal | 0 | Mean delay capped at 600 min |
| `median_taxi_min` | decimal | 0 | Median TaxiOut (dep) / TaxiIn (arr) |
| `max_delay_min` | decimal | 0 | Max delay (kept, real extreme) |
| `nas_delay_share` | decimal | 0 | CONGESTION: nas_delayed_flights / flown |
| `nas_min_per_flown` | decimal | 0 | CONGESTION: nas_min / flown |
| `delayed15_share` | decimal | 0 | delayed15 / flown |
| `cancel_rate` | decimal | 0 | cancelled / flights |
| `t100_flights` | decimal | 32 | T-100 passenger-class performed flights (denominator) |
| `coverage_pct` | decimal | 32 | 100 x non-cancelled flights / t100_flights (monthly) |
| `coverage_window_pct` | decimal | 0 | Same, pooled over the scoring window |
| `delay_score_eligible` | boolean | 0 | false when coverage_window_pct < 50: delay metrics must be null for scoring |
| `in_scoring_window` | boolean | 0 | 2019-01..2026-06 |
| `is_partial_year` | boolean | 0 | latest (incomplete) year |

### 10.6 `fares.csv` - Fare (quarterly)

Grain: airport x year x quarter (480 rows).

| Column | Type | Nulls | Description |
|---|---|---|---|
| `airport` | string | 0 | IATA |
| `year` | integer | 0 | Year |
| `quarter` | integer | 0 | 1-4 |
| `period` | string | 0 | YYYYQn |
| `avg_fare_usd` | decimal | 0 | Nominal average domestic itinerary fare |
| `avg_fare_real_usd` | decimal | 0 | Inflation-adjusted, base Q2-2026 |
| `benchmark_median_fare_usd` | decimal | 0 | Median of 16 airports, same quarter |
| `benchmark_median_fare_real_usd` | decimal | 0 | Same, real |
| `fare_vs_benchmark` | decimal | 0 | avg_fare_usd / benchmark_median_fare_usd |
| `is_provisional` | boolean | 0 | latest quarter |

### 10.7 `forecast.csv` - Forecast (annual)

Grain: airport x TAF fiscal year (Oct-Sep), actual to FY2024, forecast FY2025-FY2055.

| Column | Type | Nulls | Description |
|---|---|---|---|
| `airport` | string | 0 | IATA |
| `fiscal_year` | integer | 0 | FAA fiscal year |
| `scenario_label` | string | 0 | actual / forecast |
| `is_forecast` | boolean | 0 | true for FY2025+ |
| `enplanements_total` | integer | 0 | aac+aat+commuter+us_flag+frgn_flag |
| `enplanements_domestic` | integer | 0 | aac+aat+commuter |
| `enplanements_international` | integer | 0 | us_flag+frgn_flag |
| `enpl_air_carrier` | integer | 0 | aac |
| `enpl_air_taxi` | integer | 0 | aat |
| `enpl_commuter` | integer | 0 | commuter |
| `enpl_intl_us_flag` | integer | 0 | us_flag |
| `enpl_intl_foreign_flag` | integer | 0 | frgn_flag |
| `ops_commercial` | decimal | 224 | itinerant air carrier + air taxi (use for congestion) |
| `ops_total` | decimal | 224 | all itinerant + local operations (GA-dominated) |
| `ops_itinerant_air_carrier` | decimal | 224 | itn_Ac |
| `ops_itinerant_air_taxi` | decimal | 224 | itn_at |
| `ops_itinerant_ga` | decimal | 224 | itn_ga |
| `ops_itinerant_military` | decimal | 224 | itn_mil |
| `ops_local_ga` | decimal | 224 | loc_ga |
| `ops_local_military` | decimal | 224 | loc_mil |

### 10.8 `airport_metrics.csv` - Growth and load-factor metrics (derived, per airport)

Grain: 1 row per scope airport; both growth definitions stored, scoring config picks.

| Column | Type | Nulls | Description |
|---|---|---|---|
| `airport` | string | 0 | IATA |
| `pax_last12m` | decimal | 0 | Enplaned pax 2025-07..2026-06 (origin basis, F+L) |
| `pax_prior12m` | decimal | 0 | Enplaned pax 2024-07..2025-06 |
| `pax_latest_full_year` | decimal | 0 | Enplaned pax 2025 |
| `pax_2019` | decimal | 0 | Enplaned pax 2019 |
| `departures_last12m` | decimal | 0 | Departures last 12 m |
| `seats_last12m` | decimal | 0 | Seats last 12 m |
| `load_factor_last12m` | decimal | 0 | sum(pax)/sum(seats) over lf_eligible rows, 2025-07..2026-06 |
| `load_factor_prior12m` | decimal | 0 | Same, 2024-07..2025-06 |
| `load_factor_latest_full_year` | decimal | 0 | Same, 2025 |
| `load_factor_2019` | decimal | 0 | Same, 2019 |
| `growth_last12m_vs_prior12m_pct` | decimal | 0 | (a) last 12m vs prior 12m, ending 2026-06 |
| `growth_latest_full_year_vs_2019_pct` | decimal | 0 | (b) 2025 vs 2019 |
| `last12m_window` | string | 0 | text |
| `prior12m_window` | string | 0 | text |
| `latest_full_year` | integer | 0 | 2025 |

### 10.9 `data_quality_flags.csv` - data_quality_flags

Grain: 1 row per flag (source, table, optional airport/period).

| Column | Type | Nulls | Description |
|---|---|---|---|
| `source` | string | 0 | ourairports/t100/ontime/fares/taf |
| `table` | string | 0 | Output table the flag applies to |
| `airport` | string | 17 | IATA or empty |
| `period` | string | 31 | Period or empty |
| `flag` | string | 0 | Flag code |
| `severity` | string | 0 | info / warn / high |
| `rows_affected` | integer | 0 | Count |
| `detail` | string | 0 | Explanation |

**Congestion metric:** `nas_delay_share` and `nas_min_per_flown` in `delay_stats.csv`, for `direction` = `dep` and `arr`. Rows with `delay_score_eligible=false` must be treated as null for scoring.

**Long-haul:** query `route_stats.csv` (passenger) and `cargo_route_stats.csv` with any `distance` cutoff; filter `distance_valid` and weight by `departures`.

**Not in clean data:** NAS live status (snapshot only, parsed at request time) and flight-level On-Time rows.

