// Dev helper: New England breakdown under both normalizations, scored against all 16 airports.
import { prisma } from "../src/db.js";
import { loadMetrics } from "../src/db/metrics.js";
import { routeMonthCells, unmetSeatsByAirport } from "../src/db/unmet.js";
import { defaultConfig, scoreAirports } from "../src/scoring/index.js";

const NE = ["BOS", "BDL", "PVD", "MHT", "PWM", "BTV"];
const loaded = await loadMetrics(prisma);
const unmet = unmetSeatsByAirport(await routeMonthCells(prisma, NE, loaded.window));
const run = (normalization: "minmax" | "percentile") => scoreAirports(loaded.metrics, { config: { ...defaultConfig, normalization } });
const mm = run("minmax");
const pc = run("percentile");
const inScope = (s: ReturnType<typeof run>) => s.filter((x) => NE.includes(x.iata));
const comps = ["utilization", "growth", "congestion", "pricingPower", "scale"] as const;
const f = (x: number | null, d = 2) => (x === null ? "null" : x.toFixed(d));

for (const a of inScope(mm)) {
  const p = pc.find((x) => x.iata === a.iata)!;
  const m = loaded.metrics.find((x) => x.iata === a.iata)!;
  console.log(`\n${a.iata}  pax12m=${m.pax12m}  unmetSeats=${Math.round(unmet.get(a.iata) ?? 0)}`);
  console.log(`  ${"component".padEnd(13)}${"raw".padStart(12)} | ${"minmax score".padStart(12)} ${"contrib".padStart(8)} | ${"pctile score".padStart(12)} ${"contrib".padStart(8)}`);
  for (const c of comps) {
    const x = a.components[c], y = p.components[c];
    console.log(`  ${c.padEnd(13)}${f(x.rawValue, 4).padStart(12)} | ${f(x.score).padStart(12)} ${f(x.contribution).padStart(8)} | ${f(y.score).padStart(12)} ${f(y.contribution).padStart(8)}`);
  }
  const ms = inScope(mm).findIndex((x) => x.iata === a.iata) + 1;
  const ps = inScope(pc).findIndex((x) => x.iata === a.iata) + 1;
  console.log(`  TOTAL  minmax=${f(a.total)} (rankInScope ${ms}, rankOverall ${a.rank})   percentile=${f(p.total)} (rankInScope ${ps}, rankOverall ${p.rank})`);
}
await prisma.$disconnect();
