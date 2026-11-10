-- CreateTable
CREATE TABLE "Airport" (
    "airport" TEXT NOT NULL,
    "icao_ident" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "region_group" TEXT NOT NULL,
    "is_new_england" BOOLEAN NOT NULL,
    "airport_type" TEXT NOT NULL,
    "scheduled_service" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "open_runways" INTEGER NOT NULL,
    "closed_runways" INTEGER NOT NULL,
    "longest_open_runway_ft" INTEGER NOT NULL,
    "taf_hub_size" INTEGER NOT NULL,
    "taf_facility_class" INTEGER NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("airport")
);

-- CreateTable
CREATE TABLE "RouteStat" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "dest" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "service_class" TEXT NOT NULL,
    "is_international" BOOLEAN NOT NULL,
    "departures" DOUBLE PRECISION NOT NULL,
    "seats" DOUBLE PRECISION NOT NULL,
    "passengers" DOUBLE PRECISION NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "distance_valid" BOOLEAN NOT NULL,
    "lf_eligible" BOOLEAN NOT NULL,
    "lf_anomaly" BOOLEAN NOT NULL,
    "origin_in_scope" BOOLEAN NOT NULL,
    "dest_in_scope" BOOLEAN NOT NULL,
    "is_partial_year" BOOLEAN NOT NULL,
    "in_scoring_window" BOOLEAN NOT NULL,

    CONSTRAINT "RouteStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoRouteStat" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "dest" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "service_class" TEXT NOT NULL,
    "is_international" BOOLEAN NOT NULL,
    "departures" DOUBLE PRECISION NOT NULL,
    "freight_lbs" DOUBLE PRECISION NOT NULL,
    "mail_lbs" DOUBLE PRECISION NOT NULL,
    "passengers" DOUBLE PRECISION NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "distance_valid" BOOLEAN NOT NULL,
    "origin_in_scope" BOOLEAN NOT NULL,
    "dest_in_scope" BOOLEAN NOT NULL,
    "is_partial_year" BOOLEAN NOT NULL,
    "in_scoring_window" BOOLEAN NOT NULL,

    CONSTRAINT "CargoRouteStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelayStat" (
    "id" SERIAL NOT NULL,
    "airport" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "flights" INTEGER NOT NULL,
    "cancelled" INTEGER NOT NULL,
    "diverted" INTEGER NOT NULL,
    "flown" INTEGER NOT NULL,
    "delayed15" INTEGER NOT NULL,
    "carrier_min" DOUBLE PRECISION NOT NULL,
    "weather_min" DOUBLE PRECISION NOT NULL,
    "nas_min" DOUBLE PRECISION NOT NULL,
    "security_min" DOUBLE PRECISION NOT NULL,
    "late_aircraft_min" DOUBLE PRECISION NOT NULL,
    "nas_delayed_flights" INTEGER NOT NULL,
    "median_delay_min" DOUBLE PRECISION NOT NULL,
    "p95_delay_min" DOUBLE PRECISION NOT NULL,
    "mean_delay_capped600_min" DOUBLE PRECISION NOT NULL,
    "median_taxi_min" DOUBLE PRECISION NOT NULL,
    "max_delay_min" DOUBLE PRECISION NOT NULL,
    "nas_delay_share" DOUBLE PRECISION NOT NULL,
    "nas_min_per_flown" DOUBLE PRECISION NOT NULL,
    "delayed15_share" DOUBLE PRECISION NOT NULL,
    "cancel_rate" DOUBLE PRECISION NOT NULL,
    "t100_flights" DOUBLE PRECISION,
    "coverage_pct" DOUBLE PRECISION,
    "coverage_window_pct" DOUBLE PRECISION NOT NULL,
    "delay_score_eligible" BOOLEAN NOT NULL,
    "in_scoring_window" BOOLEAN NOT NULL,
    "is_partial_year" BOOLEAN NOT NULL,

    CONSTRAINT "DelayStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fare" (
    "id" SERIAL NOT NULL,
    "airport" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "avg_fare_usd" DOUBLE PRECISION NOT NULL,
    "avg_fare_real_usd" DOUBLE PRECISION NOT NULL,
    "benchmark_median_fare_usd" DOUBLE PRECISION NOT NULL,
    "benchmark_median_fare_real_usd" DOUBLE PRECISION NOT NULL,
    "fare_vs_benchmark" DOUBLE PRECISION NOT NULL,
    "is_provisional" BOOLEAN NOT NULL,

    CONSTRAINT "Fare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" SERIAL NOT NULL,
    "airport" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "scenario_label" TEXT NOT NULL,
    "is_forecast" BOOLEAN NOT NULL,
    "enplanements_total" INTEGER NOT NULL,
    "enplanements_domestic" INTEGER NOT NULL,
    "enplanements_international" INTEGER NOT NULL,
    "enpl_air_carrier" INTEGER NOT NULL,
    "enpl_air_taxi" INTEGER NOT NULL,
    "enpl_commuter" INTEGER NOT NULL,
    "enpl_intl_us_flag" INTEGER NOT NULL,
    "enpl_intl_foreign_flag" INTEGER NOT NULL,
    "ops_commercial" DOUBLE PRECISION,
    "ops_total" DOUBLE PRECISION,
    "ops_itinerant_air_carrier" DOUBLE PRECISION,
    "ops_itinerant_air_taxi" DOUBLE PRECISION,
    "ops_itinerant_ga" DOUBLE PRECISION,
    "ops_itinerant_military" DOUBLE PRECISION,
    "ops_local_ga" DOUBLE PRECISION,
    "ops_local_military" DOUBLE PRECISION,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirportMetric" (
    "airport" TEXT NOT NULL,
    "pax_last12m" DOUBLE PRECISION NOT NULL,
    "pax_prior12m" DOUBLE PRECISION NOT NULL,
    "pax_latest_full_year" DOUBLE PRECISION NOT NULL,
    "pax_2019" DOUBLE PRECISION NOT NULL,
    "departures_last12m" DOUBLE PRECISION NOT NULL,
    "seats_last12m" DOUBLE PRECISION NOT NULL,
    "load_factor_last12m" DOUBLE PRECISION NOT NULL,
    "load_factor_prior12m" DOUBLE PRECISION NOT NULL,
    "load_factor_latest_full_year" DOUBLE PRECISION NOT NULL,
    "load_factor_2019" DOUBLE PRECISION NOT NULL,
    "growth_last12m_vs_prior12m_pct" DOUBLE PRECISION NOT NULL,
    "growth_latest_full_year_vs_2019_pct" DOUBLE PRECISION NOT NULL,
    "last12m_window" TEXT NOT NULL,
    "prior12m_window" TEXT NOT NULL,
    "latest_full_year" INTEGER NOT NULL,

    CONSTRAINT "AirportMetric_pkey" PRIMARY KEY ("airport")
);

-- CreateTable
CREATE TABLE "DataQualityFlag" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "airport" TEXT,
    "period" TEXT,
    "flag" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "rows_affected" INTEGER NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "DataQualityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirportScore" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "airport" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "total" DOUBLE PRECISION,
    "components" JSONB NOT NULL,
    "flags" TEXT[],
    "confidence" TEXT NOT NULL,
    "weightsVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirportScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowCounts" JSONB NOT NULL,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteStat_origin_period_idx" ON "RouteStat"("origin", "period");

-- CreateIndex
CREATE INDEX "RouteStat_dest_period_idx" ON "RouteStat"("dest", "period");

-- CreateIndex
CREATE INDEX "RouteStat_origin_dest_period_idx" ON "RouteStat"("origin", "dest", "period");

-- CreateIndex
CREATE INDEX "RouteStat_origin_year_month_idx" ON "RouteStat"("origin", "year", "month");

-- CreateIndex
CREATE INDEX "CargoRouteStat_origin_period_idx" ON "CargoRouteStat"("origin", "period");

-- CreateIndex
CREATE INDEX "CargoRouteStat_origin_dest_period_idx" ON "CargoRouteStat"("origin", "dest", "period");

-- CreateIndex
CREATE INDEX "DelayStat_airport_period_idx" ON "DelayStat"("airport", "period");

-- CreateIndex
CREATE INDEX "DelayStat_airport_direction_period_idx" ON "DelayStat"("airport", "direction", "period");

-- CreateIndex
CREATE INDEX "Fare_airport_year_quarter_idx" ON "Fare"("airport", "year", "quarter");

-- CreateIndex
CREATE INDEX "Forecast_airport_fiscal_year_idx" ON "Forecast"("airport", "fiscal_year");

-- CreateIndex
CREATE INDEX "DataQualityFlag_airport_idx" ON "DataQualityFlag"("airport");

-- CreateIndex
CREATE INDEX "AirportScore_batchId_idx" ON "AirportScore"("batchId");

-- CreateIndex
CREATE INDEX "AirportScore_airport_createdAt_idx" ON "AirportScore"("airport", "createdAt");
