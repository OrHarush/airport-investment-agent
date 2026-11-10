import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import { loadMetrics } from "../db/metrics.js";
import { CLEAN_TABLES, readCsv } from "../seed/csv.js";
import { scoreAirports } from "../scoring/index.js";
import { compareAirports } from "./compareAirports.js";
import { getAirportProfile } from "./getAirportProfile.js";
import { getRouteMix } from "./getRouteMix.js";
import { getUnmetDemand } from "./getUnmetDemand.js";
import { executeTool } from "./index.js";
import { rankAirports } from "./rankAirports.js";

afterAll(() => prisma.$disconnect());

const NEW_ENGLAND = ["BOS", "BDL", "PVD", "MHT", "PWM", "BTV"];

function expectEnvelope(r: Awaited<ReturnType<typeof rankAirports>>) {
  expect(r.sources.length).toBeGreaterThan(0);
  for (const s of r.sources) {
    expect(s.name).toBeTruthy();
    expect(s.url).toMatch(/^https?:\/\//);
  }
  expect(r.assumptions.length).toBeGreaterThan(0);
  expect(r.flags.some((f) => f.code === "PARTIAL_2026")).toBe(true);
  for (const f of r.flags) {
    expect(f.code).toBeTruthy();
    expect(["info", "warn", "high"]).toContain(f.severity);
    expect(f.message.split(/\s+/).length).toBeLessThanOrEqual(12);
  }
  expect(r.methodology?.length ?? 0).toBeGreaterThan(0);
  expect(JSON.stringify(r.flags)).not.toContain("MOCK");
}

describe("seed", () => {
  it("row counts in the DB equal the CSV row counts", async () => {
    for (const t of CLEAN_TABLES) {
      const csv = readCsv(t.file).rows.length;
      const db: number = await (prisma as any)[t.delegate].count();
      expect(db, t.model).toBe(csv);
    }
  });

  it("the latest IngestionRun recorded the same counts", async () => {
    const run = await prisma.ingestionRun.findFirst({ where: { finishedAt: { not: null } }, orderBy: { id: "desc" } });
    expect(run).not.toBeNull();
    const counts = run!.rowCounts as Record<string, number>;
    for (const t of CLEAN_TABLES) expect(counts[t.model], t.model).toBe(readCsv(t.file).rows.length);
  });
});

describe("Q1: New England expansion ranking", () => {
  it("shows the 6 airports with a full per-component breakdown, scored against all 16", async () => {
    const before = await prisma.airportScore.count();
    const r = await rankAirports({ airports: NEW_ENGLAND });
    const d = r.data as any;
    expectEnvelope(r);
    expect(d.peerSet).toBe("all 16 in-scope airports");
    expect(d.normalization).toEqual({ method: "minmax", label: "Min-max score vs all 16 airports" });
    expect(d.ranking.map((x: any) => x.airport).sort()).toEqual([...NEW_ENGLAND].sort());
    expect(d.ranking.map((x: any) => x.rankInScope)).toEqual([1, 2, 3, 4, 5, 6]);
    const overall = d.ranking.map((x: any) => x.rankOverall);
    expect([...overall].sort((a: number, b: number) => a - b)).toEqual(overall);
    expect(Math.max(...overall)).toBeLessThanOrEqual(16);
    const totals = d.ranking.map((x: any) => x.total);
    expect([...totals].sort((a: number, b: number) => b - a)).toEqual(totals);
    for (const row of d.ranking) {
      const comps = Object.values(row.components) as any[];
      expect(comps).toHaveLength(5);
      expect(comps.reduce((s, c) => s + c.appliedWeight, 0)).toBeCloseTo(1, 3);
      expect(comps.reduce((s, c) => s + c.contribution, 0)).toBeCloseTo(row.total, 1);
      expect(["high", "medium", "low"]).toContain(row.confidence);
      expect(row.pax12m).toBeGreaterThan(0);
      expect(row.unmetSeats).toBeGreaterThanOrEqual(0);
    }
    expect(d.configuredWeights).toEqual({ utilization: 0.3, growth: 0.25, congestion: 0.2, pricingPower: 0.15, scale: 0.1 });
    expect(d.weightsVersion).toBe("v1");
    expect(d.sensitivity.baselineOrder).toHaveLength(16);
    expect(await prisma.airportScore.count()).toBe(before + 6); // only displayed rows are snapshotted
  });

  it("the same airport gets the same score in-scope and overall", async () => {
    const ne = (await rankAirports({ airports: NEW_ENGLAND })).data as any;
    const all = (await rankAirports({})).data as any;
    const bay = (await rankAirports({ region: "Bay Area" })).data as any;
    expect(all.ranking).toHaveLength(16);
    for (const row of ne.ranking) {
      const o = all.ranking.find((x: any) => x.airport === row.airport);
      expect(row.total).toBe(o.total);
      expect(row.rankOverall).toBe(o.rankOverall);
      expect(row.components).toEqual(o.components);
      expect(o.rankInScope).toBe(o.rankOverall);
    }
    for (const row of bay.ranking) {
      expect(row.total).toBe(all.ranking.find((x: any) => x.airport === row.airport).total);
    }
  });

  it("min-max scores equal (x - min) / (max - min) * 100 over all 16 airports, computed independently", async () => {
    const ms = await prisma.airportMetric.findMany();
    const lf = ms.map((m) => m.loadFactorLast12m);
    const lo = Math.min(...lf);
    const hi = Math.max(...lf);
    const lnPax = ms.map((m) => Math.log(m.paxLast12m));
    const nlo = Math.min(...lnPax);
    const nhi = Math.max(...lnPax);
    const d = (await rankAirports({ airports: NEW_ENGLAND })).data as any;
    for (const row of d.ranking) {
      const m = ms.find((x) => x.airport === row.airport)!;
      expect(row.components.utilization.score).toBeCloseTo(((m.loadFactorLast12m - lo) / (hi - lo)) * 100, 1);
      expect(row.components.scale.score).toBeCloseTo(((Math.log(m.paxLast12m) - nlo) / (nhi - nlo)) * 100, 1);
      expect(row.components.utilization.rawValue).toBeCloseTo(m.loadFactorLast12m, 12);
    }
    // the point of min-max: BOS (0.813) and BDL (0.813) are not 20 points apart
    const bos = d.ranking.find((x: any) => x.airport === "BOS").components.utilization.score;
    const bdl = d.ranking.find((x: any) => x.airport === "BDL").components.utilization.score;
    expect(Math.abs(bos - bdl)).toBeLessThan(2);
  });

  it("matches the scoring engine run on all 16 metrics read from the DB", async () => {
    const loaded = await loadMetrics(prisma);
    const direct = scoreAirports(loaded.metrics);
    const d = (await rankAirports({ airports: NEW_ENGLAND })).data as any;
    for (const row of d.ranking) {
      const s = direct.find((x) => x.iata === row.airport)!;
      expect(row.rankOverall).toBe(s.rank);
      expect(row.total).toBeCloseTo(s.total!, 2);
    }
  });

  it("region filter picks the display set only", async () => {
    const d = (await rankAirports({ region: "New England" })).data as any;
    expect([...d.displayed].sort()).toEqual([...NEW_ENGLAND].sort());
    expect(d.peerSet).toBe("all 16 in-scope airports");
  });

  it("flags are structured, deduplicated per airport and code, and merge dep/arr coverage", async () => {
    const r = await rankAirports({});
    const d = r.data as any;
    const keys = r.flags.map((f) => `${f.airport ?? ""}|${f.code}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of d.ranking) {
      const k = row.flags.map((f: any) => f.code);
      expect(new Set(k).size).toBe(k.length);
    }
    const lax = r.flags.filter((f) => f.airport === "LAX" && f.code.startsWith("DELAY_COVERAGE"));
    expect(lax).toHaveLength(1);
    expect(lax[0].message).toBe("Delay data covers ~75% of LAX flights");
    expect(lax[0].severity).toBe("warn");
    expect(lax[0].detail).toMatch(/ontime\/delay_stats/);
    expect(lax[0].detail).toMatch(/75(\.\d)?%/);
    // data-quality text is passed through as detail
    expect(r.flags.some((f) => f.code === "DELAY_COVERAGE" && /moderate_coverage/.test(f.detail ?? ""))).toBe(true);
  });
});

describe("Q2: LAX vs SNA congestion", () => {
  it("returns raw delay stats for both airports that match an independent SQL aggregate", async () => {
    const r = await compareAirports({ a: "LAX", b: "SNA" });
    const d = r.data as any;
    expectEnvelope(r);
    for (const side of [d.a, d.b]) {
      expect(side.delay.departures.flown).toBeGreaterThan(0);
      expect(side.delay.arrivals.flown).toBeGreaterThan(0);
      expect(side.delay.departures.p95DelayMin).not.toBeNull();
      expect(side.delay.departures.medianDelayMin).not.toBeNull();
      expect(side.delay.eligibleForScoring).toBe(true);
    }
    expect(d.a.scale.t100DeparturesLast12m).toBeGreaterThan(d.b.scale.t100DeparturesLast12m);
    expect(d.scoreComparison.components.map((c: any) => c.component)).toContain("congestion");

    const [lax] = await prisma.$queryRaw<{ r: number }[]>(Prisma.sql`
      select sum(nas_delayed_flights)::float / sum(flown) as r from "DelayStat"
      where airport = 'LAX' and direction = 'arr' and period >= '2025-07' and period <= '2026-06'`);
    expect(d.a.delay.arrivals.nasDelayRatePct).toBeCloseTo(lax.r * 100, 1);
  });
});

describe("Q3: ANC long-haul share", () => {
  it("reports passenger-only and incl. cargo at 1500/2500/3000 mi and matches raw SQL", async () => {
    const r = await getRouteMix({ airport: "ANC", cutoffMi: 3000 });
    const d = r.data as any;
    expectEnvelope(r);
    expect(d.sharesByCutoff.map((x: any) => x.cutoffMi)).toEqual([1500, 2500, 3000]);
    let prev = 101;
    for (const s of d.sharesByCutoff) {
      expect(s.passengerOnly.sharePct).toBeLessThanOrEqual(prev);
      prev = s.passengerOnly.sharePct;
      expect(s.includingCargo.sharePct).toBeGreaterThan(s.passengerOnly.sharePct);
    }
    expect(r.flags.some((f) => f.code === "CARGO_HEAVY")).toBe(true);
    expect(d.departures.cargoSharePct).toBeGreaterThan(50);

    const [row] = await prisma.$queryRaw<{ p: number; a: number }[]>(Prisma.sql`
      select
        (select sum(case when distance >= 3000 then departures else 0 end) / sum(departures) from "RouteStat" where origin = 'ANC' and year = 2025 and distance_valid) as p,
        (select (sum(case when distance >= 3000 then departures else 0 end)) / sum(departures) from (
           select distance, departures from "RouteStat" where origin = 'ANC' and year = 2025 and distance_valid
           union all select distance, departures from "CargoRouteStat" where origin = 'ANC' and year = 2025 and distance_valid) u) as a`);
    expect(d.headline.passengerOnlySharePct).toBeCloseTo(row.p * 100, 1);
    expect(d.headline.includingCargoSharePct).toBeCloseTo(row.a * 100, 1);
    expect(d.topPassengerRoutes[0].distanceMi).toBeTypeOf("number");
  });

  it("honours a custom cutoff and still returns the reference cutoffs", async () => {
    const d = (await getRouteMix({ airport: "ANC", cutoffMi: 1000 })).data as any;
    expect(d.sharesByCutoff.map((x: any) => x.cutoffMi)).toEqual([1000, 1500, 2500, 3000]);
    expect(d.requestedCutoffMi).toBe(1000);
  });
});

describe("Q4: SFO unmet demand", () => {
  it("gives airport-level unmet demand, high-LF routes/carriers and supporting evidence, framed as inference", async () => {
    const r = await getUnmetDemand({ airport: "SFO" });
    const d = r.data as any;
    expectEnvelope(r);
    expect(r.assumptions.join(" ")).toMatch(/INFERRED, NOT MEASURED/);
    expect(r.flags.some((f) => f.code === "INFERENCE")).toBe(true);

    const m = await prisma.airportMetric.findUniqueOrThrow({ where: { airport: "SFO" } });
    expect(d.airportLevel.loadFactor).toBeCloseTo(m.loadFactorLast12m, 3);
    expect(d.airportLevel.unmetPassengers).toBeGreaterThanOrEqual(0);

    // headline is route-month grain and must match an independent SQL computation; it can only be >= the annual figure
    const [sq] = await prisma.$queryRaw<{ u: number }[]>(Prisma.sql`
      select sum(seats * greatest(0, pax / seats - 0.85)) as u from (
        select dest, period, sum(seats) as seats, sum(passengers) as pax from "RouteStat"
        where origin = 'SFO' and lf_eligible and period >= '2025-07' and period <= '2026-06'
        group by dest, period having sum(departures) >= 10 and sum(seats) > 0) t`);
    expect(d.headline.unmetSeats).toBeCloseTo(sq.u, -1);
    expect(d.headline.unmetSeats).toBeGreaterThanOrEqual(d.airportLevel.unmetPassengers);
    expect(d.headline.unmetSeats).toBeGreaterThan(0);
    expect(d.peakMonths).toHaveLength(3);
    const top = d.topRoutesByUnmetSeats as any[];
    expect([...top.map((x) => x.unmetSeats)].sort((a, b) => b - a)).toEqual(top.map((x) => x.unmetSeats));
    expect(r.assumptions.join(" ")).toMatch(/capacity binds at peaks/);

    const routes = d.routesAtOrAboveThresholdWholeWindow.top as any[];
    expect(routes.length).toBeGreaterThan(0);
    for (const x of routes) expect(x.loadFactor).toBeGreaterThanOrEqual(0.85);
    const unmet = routes.map((x) => x.unmetPassengers);
    expect([...unmet].sort((a, b) => b - a)).toEqual(unmet);
    for (const x of d.carriersAtOrAboveThreshold.top as any[]) expect(x.loadFactor).toBeGreaterThanOrEqual(0.85);

    expect(d.supportingEvidence.fares.meanVsPeerMedianLast4q).toBeGreaterThan(0);
    expect(d.supportingEvidence.delay.arrivalNasDelayRatePct).not.toBeNull();
    expect(d.supportingEvidence.regionPeers.map((p: any) => p.airport).sort()).toEqual(["OAK", "SJC"]);
    expect(d.monthlyAirportLevel).toHaveLength(12);
  });
});

describe("data-quality handling", () => {
  it("FAI congestion is null in the engine input, unavailable in the ranking, and flagged", async () => {
    const loaded = await loadMetrics(prisma, ["FAI", "ANC", "SFO", "LAX", "OAK", "SJC"]);
    expect(loaded.metrics.find((m) => m.iata === "FAI")!.delayRate).toBeNull();
    expect(loaded.metrics.find((m) => m.iata === "SFO")!.delayRate).not.toBeNull();

    const r = await rankAirports({ airports: ["FAI", "ANC", "SFO", "LAX", "OAK", "SJC"] });
    const fai = (r.data as any).ranking.find((x: any) => x.airport === "FAI");
    expect(fai.components.congestion.available).toBe(false);
    expect(fai.components.congestion.rawValue).toBeNull();
    expect(fai.components.congestion.appliedWeight).toBe(0);
    const wsum = (Object.values(fai.components) as any[]).reduce((s, c) => s + c.appliedWeight, 0);
    expect(wsum).toBeCloseTo(1, 3);
    const low = fai.flags.filter((f: any) => f.code === "DELAY_COVERAGE_LOW");
    expect(low).toHaveLength(1);
    expect(low[0]).toMatchObject({ severity: "high", airport: "FAI" });
    expect(low[0].message).toMatch(/^Delay data covers only ~26% of FAI flights/);
    expect(low[0].detail).toMatch(/low_coverage_delay_metric_null_for_scoring/);
    const missing = fai.flags.find((f: any) => f.code === "MISSING_COMPONENTS");
    expect(missing.message).toMatch(/^congestion not scored/);
    expect(r.flags.some((f) => f.airport === "FAI" && f.code === "DELAY_COVERAGE_LOW")).toBe(true);
    expect(fai.components.congestion.score).toBeNull();
  });

  it("ANC is flagged cargo-heavy in the ranking", async () => {
    const r = await rankAirports({});
    const anc = (r.data as any).ranking.find((x: any) => x.airport === "ANC");
    expect(anc.flags.filter((f: any) => f.code === "CARGO_HEAVY")).toHaveLength(1);
    expect(anc.flags.some((f: any) => f.code === "CARGO_HEAVY")).toBe(true);
  });
});

describe("determinism and contract", () => {
  it("ranking the full peer set twice gives identical output", async () => {
    const a = await rankAirports({});
    const b = await rankAirports({});
    expect(b).toEqual(a);
    expect((a.data as any).ranking).toHaveLength(16);
  });

  it("profile, route mix and unmet demand are deterministic too", async () => {
    expect(await getAirportProfile({ airport: "BOS" })).toEqual(await getAirportProfile({ airport: "BOS" }));
    expect(await getUnmetDemand({ airport: "SFO" })).toEqual(await getUnmetDemand({ airport: "SFO" }));
  });

  it("getAirportProfile returns the documented sections and monthly pax that sum to the metrics CSV", async () => {
    const r = await getAirportProfile({ airport: "BOS" });
    const d = r.data as any;
    expectEnvelope(r);
    for (const k of ["metadata", "runways", "traffic", "loadFactor", "growth", "fare", "tafForecast", "score"]) expect(d[k]).toBeDefined();
    expect(d.growth.last12mVsPrior12mPct.value).toBeTypeOf("number");
    expect(d.growth.latestFullYearVs2019Pct.value).toBeTypeOf("number");
    const sum = d.traffic.monthlyPax.reduce((s: number, x: any) => s + x.passengers, 0);
    expect(sum).toBe(d.traffic.paxLast12m);
    expect(d.fare.meanVsPeerMedianLast4q).toBeGreaterThan(0);
    expect(d.tafForecast.cagrFY2025toFY2030).toBeTypeOf("number");
  });

  it("unknown airports fail cleanly through executeTool", async () => {
    const out = await executeTool("getAirportProfile", JSON.stringify({ airport: "ZZZ" }));
    expect(out.ok).toBe(false);
    const bad = await executeTool("rankAirports", JSON.stringify({ airports: ["BOS", "ZZZ"] }));
    expect(bad.ok).toBe(false);
  });
});
