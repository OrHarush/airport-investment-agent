import type { FlagSeverity, ToolFlag } from "@airport/shared";
import type { Window } from "../db/metrics.js";

const SEV_RANK: Record<FlagSeverity, number> = { high: 0, warn: 1, info: 2 };

/** One flag per (airport, code): first occurrence wins (put the most specific flag first). Sorted high -> info, then airport, then code. */
export function dedupeFlags(flags: ToolFlag[]): ToolFlag[] {
  const seen = new Set<string>();
  const out: ToolFlag[] = [];
  for (const f of flags) {
    const k = `${f.airport ?? ""}|${f.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.sort(
    (a, b) =>
      SEV_RANK[a.severity] - SEV_RANK[b.severity] || (a.airport ?? "").localeCompare(b.airport ?? "") || a.code.localeCompare(b.code),
  );
}

export const partial2026 = (w: Window): ToolFlag => ({
  code: "PARTIAL_2026",
  severity: "warn",
  message: "2026 data is partial-year",
  detail: `The ${w.label} window includes months of 2026, a partial year (T-100 ends 2026-07). Annual comparisons use full years only; 2026 months are not a full-year run-rate.`,
});

export const fareBenchmark = (latestQuarter: string): ToolFlag => ({
  code: "FARE_BENCHMARK",
  severity: "info",
  message: "Fares compared to 16-airport median",
  detail: `Fare ratio is relative to the median of the 16 in-scope airports (California-heavy), not a national average. ${latestQuarter} is provisional.`,
});

export const cargoHeavy = (airport: string, sharePct: number, detail: string): ToolFlag => ({
  code: "CARGO_HEAVY",
  severity: "warn",
  message: `${Math.round(sharePct)}% of ${airport} departures are cargo`,
  detail,
  airport,
});

interface DqRow {
  airport: string | null;
  source: string;
  table: string;
  flag: string;
  severity: string;
  detail: string;
}

const sev = (s: string): FlagSeverity => (s === "high" || s === "warn" || s === "info" ? s : "warn");
const COVERAGE_RE = /coverage_pct ([\d.]+) ?%/;

/** Airport-level rows of data_quality_flags -> structured flags; dep/arr coverage duplicates merge into one flag using the lower value. */
export function dataQualityFlags(rows: DqRow[]): ToolFlag[] {
  const groups = new Map<string, DqRow[]>();
  for (const r of rows) {
    if (!r.airport) continue;
    const k = `${r.airport}|${r.flag}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: ToolFlag[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const airport = first.airport!;
    const pcts = group.map((g) => Number(COVERAGE_RE.exec(g.detail)?.[1])).filter((x) => Number.isFinite(x));
    if (pcts.length) {
      const lowest = group[pcts.indexOf(Math.min(...pcts))];
      const pct = Math.min(...pcts);
      const isLow = first.flag.startsWith("low_coverage");
      out.push({
        code: isLow ? "DELAY_COVERAGE_LOW" : "DELAY_COVERAGE",
        severity: sev(lowest.severity),
        message: isLow ? `Delay data covers only ~${Math.round(pct)}% of ${airport} flights; not scored` : `Delay data covers ~${Math.round(pct)}% of ${airport} flights`,
        detail: `[${lowest.source}/${lowest.table}] ${lowest.flag}: ${lowest.detail}${pcts.length > 1 ? ` Departure/arrival values merged, lower shown (${[...pcts].sort((a, b) => a - b).join("% and ")}%).` : ""}`,
        airport,
      });
    } else {
      out.push({
        code: first.flag.toUpperCase(),
        severity: sev(first.severity),
        message: `${airport}: ${first.flag.replace(/_/g, " ")}`,
        detail: `[${first.source}/${first.table}] ${first.detail}`,
        airport,
      });
    }
  }
  return out;
}

/** Scoring-engine flag strings ("CODE: text") -> structured flags. CARGO_HEAVY is built separately (it needs the departure share). */
export function engineFlags(airport: string, flags: string[]): ToolFlag[] {
  const out: ToolFlag[] = [];
  for (const f of flags) {
    const code = f.split(":")[0].trim();
    const detail = f.slice(code.length + 1).trim();
    if (code === "CARGO_HEAVY") continue;
    if (code === "MISSING_COMPONENTS") {
      const list = /^(.*?) \(/.exec(detail)?.[1] ?? detail;
      out.push({ code, severity: "warn", message: `${list} not scored; weights re-normalized`, detail, airport });
    } else if (code === "PARTIAL_GROWTH") {
      out.push({ code, severity: "warn", message: "Growth uses only one of its two inputs", detail, airport });
    } else if (code === "NO_DATA") {
      out.push({ code, severity: "high", message: "No data to score this airport", detail, airport });
    } else if (code === "SMALL_PEER_SET" || code === "SINGLE_AIRPORT_PEER_SET") {
      out.push({ code, severity: "info", message: "Few airports in the peer set", detail, airport });
    } else {
      out.push({ code, severity: "warn", message: detail.split(/[.;]/)[0].slice(0, 80), detail, airport });
    }
  }
  return out;
}
