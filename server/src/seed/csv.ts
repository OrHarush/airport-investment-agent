import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). Returns rows including the header. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export const CLEAN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/clean");

export function readCsv(file: string): { header: string[]; rows: string[][] } {
  const all = parseCsv(fs.readFileSync(path.join(CLEAN_DIR, file), "utf8"));
  return { header: all[0], rows: all.slice(1) };
}

export const snakeToCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** The 8 clean tables: Prisma model delegate name, SQL table name, CSV file. */
export const CLEAN_TABLES = [
  { model: "Airport", delegate: "airport", file: "airports.csv" },
  { model: "RouteStat", delegate: "routeStat", file: "route_stats.csv" },
  { model: "CargoRouteStat", delegate: "cargoRouteStat", file: "cargo_route_stats.csv" },
  { model: "DelayStat", delegate: "delayStat", file: "delay_stats.csv" },
  { model: "Fare", delegate: "fare", file: "fares.csv" },
  { model: "Forecast", delegate: "forecast", file: "forecast.csv" },
  { model: "AirportMetric", delegate: "airportMetric", file: "airport_metrics.csv" },
  { model: "DataQualityFlag", delegate: "dataQualityFlag", file: "data_quality_flags.csv" },
] as const;
