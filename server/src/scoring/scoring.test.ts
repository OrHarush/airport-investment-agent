import { describe, expect, it } from "vitest";
import {
  compare,
  defaultConfig,
  longHaulShare,
  percentileRanks,
  minMaxScores,
  scoreAirports as scoreAirportsRaw,
  sensitivity as sensitivityRaw,
  unmetDemand,
  type AirportMetrics,
  type Weights,
} from "./index.js";

/**
 * Hand-made 5-airport peer set. All metrics are distinct, so percentiles are 0/25/50/75/100.
 *
 *            lf    recovery(pax/base)  cagr   delay  fare  pax
 *   A       .90    10/8   = 1.25       .030   .25    1.10  10M
 *   B       .80    20/25  = 0.80       .010   .15    0.90  20M
 *   C       .85     5/5   = 1.00       .020   .20    1.00   5M
 *   D       .70    30/31.5= 0.952      .005   .10    1.20  30M
 *   E       .95     2/1.8 = 1.111      .040   .30    0.80   2M
 *
 * Percentiles (util, recovery, cagr -> growth=avg, delay, fare, scale):
 *   A: 75, (100+75)/2=87.5, 75, 75, 50      -> .3*75 + .25*87.5 + .2*75 + .15*75 + .1*50 = 75.625
 *   B: 25, (0+25)/2=12.5,   25, 25, 75      -> 7.5 + 3.125 + 5 + 3.75 + 7.5            = 26.875
 *   C: 50, (50+50)/2=50,    50, 50, 25      -> 15 + 12.5 + 10 + 7.5 + 2.5               = 47.5
 *   D:  0, (25+0)/2=12.5,    0,100,100      -> 0 + 3.125 + 0 + 15 + 10                  = 28.125
 *   E:100, (75+100)/2=87.5, 100,  0,  0     -> 30 + 21.875 + 20 + 0 + 0                 = 71.875
 *   (fare percentiles: E 0, B 25, C 50, A 75, D 100; scale: E 0, C 25, A 50, B 75, D 100)
 */
/** The tests below this line pin the "percentile" normalization; min-max tests are at the bottom. */
const PCT = { ...defaultConfig, normalization: "percentile" as const };
const scoreAirports = (a: AirportMetrics[], opts: { weights?: Weights; config?: typeof defaultConfig } = {}) =>
  scoreAirportsRaw(a, { ...opts, config: { ...(opts.config ?? PCT), normalization: "percentile" } });
const sensitivity = (a: AirportMetrics[], w?: Weights, p?: number) => sensitivityRaw(a, w, p, PCT);

const A: AirportMetrics = { iata: "A", loadFactor12m: 0.9, pax12m: 10e6, paxBaseline2019: 8e6, forecastCagr: 0.03, delayRate: 0.25, fareRatio: 1.1 };
const B: AirportMetrics = { iata: "B", loadFactor12m: 0.8, pax12m: 20e6, paxBaseline2019: 25e6, forecastCagr: 0.01, delayRate: 0.15, fareRatio: 0.9 };
const C: AirportMetrics = { iata: "C", loadFactor12m: 0.85, pax12m: 5e6, paxBaseline2019: 5e6, forecastCagr: 0.02, delayRate: 0.2, fareRatio: 1.0 };
const D: AirportMetrics = { iata: "D", loadFactor12m: 0.7, pax12m: 30e6, paxBaseline2019: 31.5e6, forecastCagr: 0.005, delayRate: 0.1, fareRatio: 1.2 };
const E: AirportMetrics = { iata: "E", loadFactor12m: 0.95, pax12m: 2e6, paxBaseline2019: 1.8e6, forecastCagr: 0.04, delayRate: 0.3, fareRatio: 0.8 };
const SET = [A, B, C, D, E];

const by = (r: ReturnType<typeof scoreAirports>, code: string) => r.find((x) => x.iata === code)!;

describe("percentileRanks", () => {
  it("ranks distinct values 0..100", () => {
    expect(percentileRanks([10, 30, 20, 40, 50])).toEqual([0, 50, 25, 75, 100]);
  });
  it("gives ties the average rank and keeps nulls", () => {
    expect(percentileRanks([1, 1, 3, null])).toEqual([25, 25, 100, null]);
  });
  it("returns 50 for a single value", () => {
    expect(percentileRanks([7, null])).toEqual([50, null]);
  });
});

describe("scoreAirports: hand-calculated 5-airport set", () => {
  const r = scoreAirports(SET);

  it("ranks A, E, C, D, B with the hand-computed totals", () => {
    expect(r.map((x) => x.iata)).toEqual(["A", "E", "C", "D", "B"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(by(r, "A").total).toBeCloseTo(75.625, 6);
    expect(by(r, "E").total).toBeCloseTo(71.875, 6);
    expect(by(r, "C").total).toBeCloseTo(47.5, 6);
    expect(by(r, "D").total).toBeCloseTo(28.125, 6);
    expect(by(r, "B").total).toBeCloseTo(26.875, 6);
  });

  it("exposes explainable components for A", () => {
    const a = by(r, "A");
    expect(a.components.utilization).toMatchObject({ rawValue: 0.9, score: 75, weight: 0.3 });
    expect(a.components.utilization.contribution).toBeCloseTo(22.5, 6);
    expect(a.components.growth.score).toBeCloseTo(87.5, 6);
    expect(a.components.growth.rawValue).toBeCloseTo(1.25, 9);
    expect(a.components.growth.rawValues.forecastCagr).toBe(0.03);
    expect(a.components.congestion.score).toBe(75);
    expect(a.components.pricingPower.score).toBe(75);
    expect(a.components.scale.score).toBe(50);
  });

  it("component contributions sum to the total, weights sum to 1, version and confidence are set", () => {
    for (const s of r) {
      const sum = Object.values(s.components).reduce((t, c) => t + c.contribution, 0);
      expect(sum).toBeCloseTo(s.total as number, 6);
      expect(Object.values(s.components).reduce((t, c) => t + c.weight, 0)).toBeCloseTo(1, 9);
      expect(s.weightsVersion).toBe(defaultConfig.weightsVersion);
      expect(s.confidence).toBe("high");
      expect(s.flags).toEqual([]);
    }
  });

  it("is deterministic and independent of input order", () => {
    expect(scoreAirports(SET)).toEqual(r);
    expect(scoreAirports([E, D, C, B, A])).toEqual(r);
  });

  it("changing the growth blend changes the growth percentile (config is honoured)", () => {
    const rec = scoreAirports(SET, { config: { ...defaultConfig, growthBlend: { recovery: 1, forecast: 0 } } });
    expect(by(rec, "A").components.growth.score).toBe(100);
    expect(by(rec, "E").components.growth.score).toBe(75);
  });
});

describe("null handling and renormalization", () => {
  it("drops a missing component, re-normalizes weights, flags it and lowers confidence", () => {
    const E2: AirportMetrics = { ...E, delayRate: null };
    const r = scoreAirports([A, B, C, D, E2]);
    const e = by(r, "E");
    // remaining weights .3+.25+.15+.1 = .8 -> .375, .3125, .1875, .125
    expect(e.components.congestion).toMatchObject({ available: false, score: null, weight: 0, contribution: 0 });
    expect(e.components.utilization.weight).toBeCloseTo(0.375, 9);
    expect(e.components.growth.weight).toBeCloseTo(0.3125, 9);
    expect(e.components.pricingPower.weight).toBeCloseTo(0.1875, 9);
    expect(e.components.scale.weight).toBeCloseTo(0.125, 9);
    // E: util 100, growth 87.5, fare 0, scale 0 -> 37.5 + 27.34375
    expect(e.total).toBeCloseTo(64.84375, 6);
    expect(e.weightCoverage).toBeCloseTo(0.8, 9);
    expect(e.confidence).toBe("medium");
    expect(e.flags.some((f) => f.startsWith("MISSING_COMPONENTS") && f.includes("congestion"))).toBe(true);
    // peers percentile only over the 4 who have delay data: D .10->0, B .15->33.33, C .20->66.67, A .25->100
    expect(by(r, "D").components.congestion.score).toBe(0);
    expect(by(r, "A").components.congestion.score).toBe(100);
    expect(by(r, "B").components.congestion.score).toBeCloseTo(33.333333333, 6);
  });

  it("uses a partial growth blend when only one sub-metric exists", () => {
    const A2: AirportMetrics = { ...A, forecastCagr: null };
    const r = scoreAirports([A2, B, C, D, E]);
    const a = by(r, "A");
    expect(a.components.growth.available).toBe(true);
    expect(a.components.growth.score).toBe(100); // recovery percentile only
    expect(a.flags.some((f) => f.startsWith("PARTIAL_GROWTH"))).toBe(true);
    // coverage = 1 - .25 * .5 = .875 -> medium
    expect(a.weightCoverage).toBeCloseTo(0.875, 9);
    expect(a.confidence).toBe("medium");
  });

  it("treats zero/missing baseline as no recovery data and non-finite values as null", () => {
    const r = scoreAirports([{ ...A, paxBaseline2019: 0 }, { ...B, loadFactor12m: Number.NaN }, C]);
    expect(by(r, "A").components.growth.rawValue).toBeNull();
    expect(by(r, "B").components.utilization.available).toBe(false);
  });

  it("gives low confidence and no total when too little data exists", () => {
    const r = scoreAirports([{ iata: "X", pax12m: 1 }, { iata: "Y" }, A]);
    const y = by(r, "Y");
    expect(y.total).toBeNull();
    expect(y.confidence).toBe("low");
    expect(y.flags.some((f) => f.startsWith("NO_DATA"))).toBe(true);
    expect(r[r.length - 1].iata).toBe("Y"); // unscorable sorts last
    const x = by(r, "X");
    expect(x.confidence).toBe("low"); // only scale (.1) present
    expect(x.weightCoverage).toBeCloseTo(0.1, 9);
  });

  it("passes the cargoHeavy flag through", () => {
    const r = scoreAirports([{ ...A, flags: { cargoHeavy: true } }, B, C, D, E]);
    expect(by(r, "A").flags.some((f) => f.startsWith("CARGO_HEAVY"))).toBe(true);
  });

  it("rejects duplicate airports", () => {
    expect(() => scoreAirports([A, A])).toThrow(/Duplicate/);
  });
});

describe("ties and single-airport peer set", () => {
  it("breaks equal totals by pax12m desc, then IATA asc", () => {
    const weights: Weights = { utilization: 1, growth: 1, congestion: 1, pricingPower: 1, scale: 0 }; // scale ignored so totals tie
    const base = { loadFactor12m: 0.8, forecastCagr: 0.02, delayRate: 0.2, fareRatio: 1 };
    const r = scoreAirports(
      [
        { iata: "ZZZ", pax12m: 5, paxBaseline2019: 10, ...base },
        { iata: "BBB", pax12m: 9, paxBaseline2019: 18, ...base },
        { iata: "AAA", pax12m: 5, paxBaseline2019: 10, ...base },
      ],
      { weights },
    );
    expect(new Set(r.map((x) => x.total)).size).toBe(1);
    expect(r.map((x) => x.iata)).toEqual(["BBB", "AAA", "ZZZ"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("scores a single-airport peer set at 50 with a flag", () => {
    const [only] = scoreAirports([A]);
    expect(only.total).toBeCloseTo(50, 9);
    expect(only.rank).toBe(1);
    expect(only.flags.some((f) => f.startsWith("SINGLE_AIRPORT_PEER_SET"))).toBe(true);
  });

  it("flags small peer sets but not the 5-airport set", () => {
    expect(scoreAirports([A, B]).every((s) => s.flags.some((f) => f.startsWith("SMALL_PEER_SET")))).toBe(true);
    expect(scoreAirports(SET).some((s) => s.flags.some((f) => f.startsWith("SMALL_PEER_SET")))).toBe(false);
  });
});

describe("unmetDemand", () => {
  it("is seats * (loadFactor - threshold) above the threshold", () => {
    const u = unmetDemand({ seats: 1000, passengers: 900 });
    expect(u.loadFactor).toBeCloseTo(0.9, 9);
    expect(u.threshold).toBe(0.85);
    expect(u.unmetPassengers).toBeCloseTo(50, 6);
    expect(u.explanation).toContain("seats * max(0, loadFactor - threshold)");
    expect(u.explanation).toContain("0.85");
  });
  it("is 0 exactly at the threshold and below it", () => {
    expect(unmetDemand({ seats: 1000, passengers: 850 }).unmetPassengers).toBe(0);
    expect(unmetDemand({ seats: 1000, passengers: 600 }).unmetPassengers).toBe(0);
  });
  it("honours a custom threshold and handles invalid input", () => {
    expect(unmetDemand({ seats: 1000, passengers: 900, threshold: 0.8 }).unmetPassengers).toBeCloseTo(100, 6);
    const bad = unmetDemand({ seats: 0, passengers: 10 });
    expect(bad.unmetPassengers).toBe(0);
    expect(bad.loadFactor).toBeNull();
  });
});

describe("longHaulShare", () => {
  const deps = [
    { distanceMi: 2999, departures: 10 },
    { distanceMi: 3000, departures: 30 },
    { distanceMi: 3001, departures: 60 },
  ];
  it("counts distance == cutoff as long-haul (inclusive)", () => {
    const r = longHaulShare(deps);
    expect(r.cutoffMi).toBe(3000);
    expect(r.longHaulDepartures).toBe(90);
    expect(r.totalDepartures).toBe(100);
    expect(r.share).toBeCloseTo(0.9, 9);
  });
  it("one mile above the boundary excludes the 3000-mile bucket", () => {
    expect(longHaulShare(deps, 3001).share).toBeCloseTo(0.6, 9);
  });
  it("returns null share with no departures and ignores bad rows", () => {
    expect(longHaulShare([]).share).toBeNull();
    expect(longHaulShare([{ distanceMi: 5000, departures: 0 }, { distanceMi: Number.NaN, departures: 5 }]).share).toBeNull();
  });
});

describe("sensitivity", () => {
  it("runs 10 scenarios (5 components x +-10%) with renormalized weights", () => {
    const s = sensitivity(SET, defaultConfig.weights);
    expect(s.scenarios).toHaveLength(10);
    expect(s.baselineOrder).toEqual(["A", "E", "C", "D", "B"]);
    for (const sc of s.scenarios) expect(Object.values(sc.weights).reduce((t, w) => t + w, 0)).toBeCloseTo(1, 9);
    // +10% on utilization: .33 / 1.03
    const up = s.scenarios.find((x) => x.component === "utilization" && x.direction === "+")!;
    expect(up.weights.utilization).toBeCloseTo(0.33 / 1.03, 9);
  });

  it("reports a stable ranking when one airport dominates every metric", () => {
    const dom: AirportMetrics[] = [
      { iata: "TOP", loadFactor12m: 0.95, pax12m: 30e6, paxBaseline2019: 20e6, forecastCagr: 0.05, delayRate: 0.3, fareRatio: 1.3 },
      { iata: "MID", loadFactor12m: 0.85, pax12m: 20e6, paxBaseline2019: 20e6, forecastCagr: 0.03, delayRate: 0.2, fareRatio: 1.0 },
      { iata: "LOW", loadFactor12m: 0.75, pax12m: 10e6, paxBaseline2019: 15e6, forecastCagr: 0.01, delayRate: 0.1, fareRatio: 0.8 },
      { iata: "LOWER", loadFactor12m: 0.7, pax12m: 5e6, paxBaseline2019: 9e6, forecastCagr: 0.0, delayRate: 0.05, fareRatio: 0.7 },
    ];
    const s = sensitivity(dom);
    expect(s.summary.top1Stable).toBe(true);
    expect(s.summary.top3SetStable).toBe(true);
    expect(s.summary.top3OrderStable).toBe(true);
    expect(Object.values(s.summary.maxRankMove).every((m) => m === 0)).toBe(true);
  });

  it("detects a knife-edge ranking and reports rank moves", () => {
    // 2 airports: X wins utilization, Y wins congestion; weights .52 vs .48 -> X leads.
    // Cutting utilization by 10% (.468 < .48) flips the winner.
    const pair: AirportMetrics[] = [
      { iata: "X", loadFactor12m: 0.9, delayRate: 0.1 },
      { iata: "Y", loadFactor12m: 0.8, delayRate: 0.3 },
    ];
    const w: Weights = { utilization: 0.52, growth: 0, congestion: 0.48, pricingPower: 0, scale: 0 };
    const s = sensitivity(pair, w);
    expect(s.baselineOrder).toEqual(["X", "Y"]);
    expect(s.summary.top1Stable).toBe(false);
    expect(s.summary.scenariosChangingTop1).toBeGreaterThan(0);
    expect(s.summary.maxRankMove.X).toBe(1);
    expect(s.summary.maxRankMove.Y).toBe(1);
    const flip = s.scenarios.find((x) => x.component === "utilization" && x.direction === "-")!;
    expect(flip.order).toEqual(["Y", "X"]);
  });
});

describe("compare", () => {
  it("reports per-component differences (a minus b) and the biggest driver", () => {
    const r = scoreAirports(SET);
    const c = compare(by(r, "A"), by(r, "E"));
    expect(c.a).toBe("A");
    expect(c.b).toBe("E");
    expect(c.totalDiff).toBeCloseTo(3.75, 6);
    expect(c.rankDiff).toBe(-1);
    const get = (n: string) => c.components.find((x) => x.component === n)!;
    expect(get("utilization").scoreDiff).toBe(-25);
    expect(get("utilization").contributionDiff).toBeCloseTo(-7.5, 6);
    expect(get("utilization").leader).toBe("b");
    expect(get("growth").leader).toBe("tie");
    expect(get("pricingPower").scoreDiff).toBe(75);
    expect(get("pricingPower").leader).toBe("a");
    expect(c.biggestDriver).toBe("pricingPower"); // 11.25 is the largest |contribution diff|
  });

  it("marks components n/a when one side lacks data", () => {
    const r = scoreAirports([A, B, C, D, { ...E, delayRate: null }]);
    const c = compare(by(r, "A"), by(r, "E"));
    expect(c.components.find((x) => x.component === "congestion")!.leader).toBe("n/a");
  });
});

// ---------------------------------------------------------------------------------------------
// Min-max normalization (the default)
// ---------------------------------------------------------------------------------------------
describe("minMaxScores", () => {
  it("scales (x - min) / (max - min) * 100 and keeps nulls", () => {
    expect(minMaxScores([10, 30, 20, null, 50])).toEqual([0, 50, 25, null, 100]);
  });
  it("gives everyone 50 when max == min, and for a single value", () => {
    expect(minMaxScores([0.8, 0.8, 0.8])).toEqual([50, 50, 50]);
    expect(minMaxScores([7, null])).toEqual([50, null]);
  });
  it("returns all null when nothing is present", () => {
    expect(minMaxScores([null, null])).toEqual([null, null]);
  });
});

describe("scoreAirports: min-max (default), hand-calculated on the same 5 airports", () => {
  // Hand calc (range in brackets):
  //  util  lf .70-.95 [.25]:  A 80  B 40  C 60  D 0   E 100
  //  recov 0.8-1.25 [.45]:    A 100 B 0   C 44.444  D 33.862  E 69.136
  //  cagr  .005-.04 [.035]:   A 71.429 B 14.286 C 42.857 D 0 E 100  -> growth = mean(recov, cagr)
  //  delay .10-.30 [.2]:      A 75 B 25 C 50 D 0 E 100
  //  fare  .8-1.2 [.4]:       A 75 B 25 C 50 D 100 E 0
  //  scale ln(pax) ln2M..ln30M [ln15 = 2.70805]: A ln5/ln15=59.431 B ln10/ln15=85.027 C ln2.5/ln15=33.836 D 100 E 0
  //  total = .3 util + .25 growth + .2 delay + .15 fare + .1 scale
  const r = scoreAirportsRaw(SET);
  it("is the default and labels itself", () => {
    expect(defaultConfig.normalization).toBe("minmax");
    expect(r[0].normalization).toEqual({ method: "minmax", label: "Min-max score vs all 5 airports" });
  });
  it("component scores match the hand calculation", () => {
    const a = by(r, "A").components;
    expect(a.utilization.score).toBeCloseTo(80, 6);
    expect(a.growth.score).toBeCloseTo((100 + 71.428571) / 2, 4);
    expect(a.congestion.score).toBeCloseTo(75, 6);
    expect(a.pricingPower.score).toBeCloseTo(75, 6);
    expect(a.scale.score).toBeCloseTo((Math.log(5) / Math.log(15)) * 100, 4);
    expect(by(r, "D").components.scale.score).toBe(100);
    expect(by(r, "E").components.scale.score).toBe(0);
    expect(by(r, "C").components.growth.score).toBeCloseTo((44.444444 + 42.857143) / 2, 3);
  });
  it("totals match the hand calculation and rank A, E, C, B, D", () => {
    expect(r.map((x) => x.iata)).toEqual(["A", "E", "C", "B", "D"]);
    expect(by(r, "A").total).toBeCloseTo(77.6217, 3);
    expect(by(r, "E").total).toBeCloseTo(71.142, 3);
    expect(by(r, "C").total).toBeCloseTo(49.7963, 3);
    expect(by(r, "B").total).toBeCloseTo(31.0384, 3);
    expect(by(r, "D").total).toBeCloseTo(29.2328, 3);
  });
  it("keeps tiny raw gaps small: LF .813 vs .818 is a ~2 point gap, not 40 vs 100", () => {
    const lo = { ...C, iata: "P", loadFactor12m: 0.813 };
    const hi = { ...C, iata: "Q", loadFactor12m: 0.818 };
    const x = scoreAirportsRaw([lo, hi, { ...C, iata: "R", loadFactor12m: 0.7 }, { ...C, iata: "S", loadFactor12m: 0.95 }]);
    const gap = by(x, "Q").components.utilization.score! - by(x, "P").components.utilization.score!;
    expect(gap).toBeCloseTo((0.005 / 0.25) * 100, 6);
    const p = scoreAirportsRaw([lo, hi, { ...C, iata: "R", loadFactor12m: 0.7 }, { ...C, iata: "S", loadFactor12m: 0.95 }], { config: PCT });
    expect(by(p, "Q").components.utilization.score! - by(p, "P").components.utilization.score!).toBeCloseTo(33.333, 2);
  });
  it("gives every component 50 when all airports are identical (max == min)", () => {
    const same = [A, { ...A, iata: "A2" }, { ...A, iata: "A3" }];
    for (const s of scoreAirportsRaw(same)) {
      for (const c of Object.values(s.components)) expect(c.score).toBe(50);
      expect(s.total).toBeCloseTo(50, 9);
    }
  });
  it("null handling, re-weighting and confidence are unchanged", () => {
    const x = scoreAirportsRaw([A, B, C, D, { ...E, delayRate: null }]);
    const e = by(x, "E");
    expect(e.components.congestion).toMatchObject({ available: false, score: null, weight: 0 });
    expect(e.weightCoverage).toBeCloseTo(0.8, 9);
    expect(e.confidence).toBe("medium");
    expect(Object.values(e.components).reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 9);
  });
  it("is deterministic and independent of input order", () => {
    expect(scoreAirportsRaw([E, D, C, B, A])).toEqual(r);
  });
  it("percentile and min-max agree on the order of a single metric but not on gaps", () => {
    const p = scoreAirportsRaw(SET, { config: PCT });
    expect(by(p, "A").total).toBeCloseTo(75.625, 6);
    expect(by(r, "A").total).not.toBeCloseTo(75.625, 1);
  });
});
