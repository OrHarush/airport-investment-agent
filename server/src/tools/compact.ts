import type { ToolResult } from "@airport/shared";

/**
 * Compact view of a tool result for the LLM context. The UI keeps the full ToolResult (evidence cards);
 * the model gets this smaller copy so one result stays under ~2,000 tokens (Groq free tier: 8,000 tokens/min).
 *
 * What is cut: URLs, retrieval dates, long per-field explanations (the numbers they explain stay), per-row
 * flags (merged and de-duplicated at the top level), long lists (top N only), float noise.
 * What is kept: every headline number, units/windows, assumptions, flags (message only) and methodology.
 */

/** Keys whose value is prose that restates numbers already present next to it. */
const DROP_KEYS = new Set([
  "explanation",
  "formula",
  "note",
  "monthlyNote",
  "url",
  "retrievedAt",
  "quarters",
  "unmetByMonth",
  "monthlyAirportLevel",
  "byYear",
  "displayed",
  "baselineOrder",
  "weightsVersion",
  "scope",
  "scenariosChangingTop3Set",
  "topCargoRoutes",
  "configuredWeight",
  "appliedWeight",
  "contribution",
  "rawValues",
  "eligibleForScoring",
  "maxDelayMin",
  "medianTaxiMin",
  "nasMinutesPerFlight",
  "medianDelayMin",
  "p95DelayMin",
  "flightsInSample",
  "flown",
]);

/** Max list length by key (default DEFAULT_CAP). ranking is capped by the 16-airport peer set, not here. */
const CAPS: Record<string, number> = {
  ranking: 16,
  topRoutesByUnmetSeats: 6,
  peakMonths: 3,
  top: 3,
  topPassengerRoutes: 5,
  sharesByCutoff: 3,
  components: 5,
};
const DEFAULT_CAP = 6;

const round = (n: number) => (Number.isInteger(n) ? n : Number(n.toPrecision(5)));

function slim(v: unknown, key = ""): unknown {
  if (typeof v === "number") return round(v);
  if (Array.isArray(v)) return v.slice(0, CAPS[key] ?? DEFAULT_CAP).map((x) => slim(x, key));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = slim(x, k);
    }
    return out;
  }
  return v;
}

/** rankAirports rows: one line of numbers per airport; per-row flags move to the (de-duplicated) top-level list. */
function slimRanking(data: any): any {
  const rows = (data.ranking ?? []).map((r: any) => ({
    rankInScope: r.rankInScope,
    ...(r.rankOverall !== r.rankInScope ? { rankOverall: r.rankOverall } : {}), // omitted when identical to rankInScope
    airport: r.airport,
    total: r.total,
    pax12m: r.pax12m,
    unmetSeats: r.unmetSeats,
    confidence: r.confidence,
    // utilization keeps its raw value (the 12-month load factor, compared with the 0.85 threshold); the rest are scores only.
    components: Object.fromEntries(
      Object.entries(r.components ?? {}).map(([name, c]: [string, any]) => [
        name,
        !c.available ? null : name === "utilization" ? { score: c.score, rawValue: round(c.rawValue) } : c.score,
      ]),
    ),
  }));
  const { ranking: _r, ...rest } = data;
  return { ...(slim(rest) as object), ranking: rows };
}

/** Flags de-duplicated by (code, airport-less message); airports listed once. Detail text dropped. */
function dedupeFlags(result: ToolResult, extra: any[] = []): unknown[] {
  const byKey = new Map<string, { code: string; severity: string; message: string; airports?: string[] }>();
  for (const f of [...result.flags, ...extra]) {
    // "Delay data covers ~76% of BOS flights" differs per airport: group by code, keep the first message as the example.
    const k = `${f.code}`;
    const cur = byKey.get(k);
    if (!cur) byKey.set(k, { code: f.code, severity: f.severity, message: f.message, ...(f.airport ? { airports: [f.airport] } : {}) });
    else if (f.airport && !cur.airports?.includes(f.airport)) (cur.airports ??= []).push(f.airport);
  }
  return [...byKey.values()];
}

export function compactForModel(tool: string, result: ToolResult): unknown {
  let data: any = result.data;
  const rowFlags: any[] = [];
  if (tool === "rankAirports") {
    for (const r of (data as any).ranking ?? []) rowFlags.push(...(r.flags ?? []));
    data = slimRanking(data);
  } else if (tool === "compareAirports") {
    for (const side of ["a", "b"]) rowFlags.push(...(data[side]?.flags ?? []));
    data = slim({ ...data, a: { ...data.a, flags: undefined }, b: { ...data.b, flags: undefined } });
  } else {
    data = slim(data);
  }
  return {
    data,
    sources: result.sources.map((s) => s.name),
    // assumptions that merely repeat a methodology line are dropped
    assumptions: result.assumptions.filter((a) => !(result.methodology ?? []).includes(a)),
    flags: dedupeFlags(result, rowFlags),
    ...(result.methodology ? { methodology: result.methodology } : {}),
  };
}

/** Rough token estimate (chars / 4). Good enough for budgeting; Groq counts with the model's own tokenizer. */
export const estimateTokens = (o: unknown) => Math.ceil((typeof o === "string" ? o : JSON.stringify(o)).length / 4);
