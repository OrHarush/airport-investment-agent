import { randomUUID } from "node:crypto";
import type { ToolFlag, ToolResult } from "@airport/shared";
import { prisma } from "../db.js";
import { CARGO_HEAVY_SHARE, loadMetrics, type LoadedMetrics } from "../db/metrics.js";
import { routeMonthCells, unmetSeatsByAirport } from "../db/unmet.js";
import { defaultConfig, scoreAirports, sensitivity, type AirportScore } from "../scoring/index.js";
import { result, round, scoringMethodology, SRC } from "./common.js";
import { cargoHeavy, engineFlags } from "./flags.js";

/** Resolve an optional region filter (region group name or state code) and/or explicit airport list to IATA codes. Display filter only. */
export async function resolveDisplaySet(input: { airports?: string[]; region?: string }): Promise<string[] | undefined> {
  let codes = input.airports?.length ? input.airports.map((c) => c.toUpperCase()) : undefined;
  if (input.region) {
    const r = input.region.trim();
    const rows = await prisma.airport.findMany({
      where: { OR: [{ regionGroup: { equals: r, mode: "insensitive" } }, { state: { equals: r, mode: "insensitive" } }] },
      select: { airport: true },
    });
    if (!rows.length) {
      const groups = (await prisma.airport.findMany({ distinct: ["regionGroup"], select: { regionGroup: true } })).map((x) => x.regionGroup);
      throw new Error(`No airports match region "${input.region}". Use a region group (${groups.join(", ")}) or a state code.`);
    }
    const inRegion = rows.map((x) => x.airport);
    codes = codes ? codes.filter((c) => inRegion.includes(c)) : inRegion;
    if (!codes.length) throw new Error(`None of the requested airports are in region "${input.region}".`);
  }
  return codes;
}

/** Per-airport structured flags: cargo share + data-quality flags from the CSV + scoring-engine flags (deduplicated by result()). */
export function airportFlags(score: AirportScore, loaded: LoadedMetrics): ToolFlag[] {
  const inp = loaded.inputs.get(score.iata);
  const out: ToolFlag[] = [];
  if (inp?.cargo.departuresShare != null && inp.cargo.departuresShare > CARGO_HEAVY_SHARE) {
    out.push(
      cargoHeavy(
        score.iata,
        inp.cargo.departuresShare * 100,
        `All-cargo flights are ${(inp.cargo.departuresShare * 100).toFixed(1)}% of ${score.iata} departures in ${loaded.window.label} (${inp.cargo.cargoDepartures} cargo vs ${inp.cargo.passengerDepartures} passenger; T-100 classes G/P vs F/L). Freight is not scored, so passenger-based metrics understate its role.`,
      ),
    );
  }
  out.push(...(loaded.airportNotes.get(score.iata) ?? []));
  out.push(...engineFlags(score.iata, score.flags));
  return out;
}

/** Score ALL 16 airports once, so an airport's score never depends on the question asked. */
export async function scoreAll() {
  const loaded = await loadMetrics(prisma);
  const scores = scoreAirports(loaded.metrics);
  return { loaded, scores };
}

export async function rankAirports(input: { airports?: string[]; region?: string }): Promise<ToolResult> {
  const display = await resolveDisplaySet(input);
  const { loaded, scores } = await scoreAll();
  if (display) {
    const unknown = display.filter((c) => !scores.some((s) => s.iata === c));
    if (unknown.length) throw new Error(`Unknown airport(s): ${unknown.join(", ")}. In-scope airports: ${scores.map((s) => s.iata).join(", ")}.`);
  }
  const shown = scores.filter((s) => !display || display.includes(s.iata)); // already in overall rank order

  const cells = await routeMonthCells(prisma, shown.map((s) => s.iata), loaded.window);
  const unmet = unmetSeatsByAirport(cells);

  const batchId = randomUUID();
  await prisma.airportScore.createMany({
    data: shown.map((s) => ({
      batchId,
      airport: s.iata,
      rank: s.rank,
      total: s.total,
      components: s.components as unknown as object,
      flags: airportFlags(s, loaded).map((f) => `${f.code}: ${f.message}`),
      confidence: s.confidence,
      weightsVersion: s.weightsVersion,
    })),
  });

  const ranking = shown.map((s, idx) => ({
    rankInScope: idx + 1,
    rankOverall: s.rank,
    airport: s.iata,
    name: loaded.inputs.get(s.iata)!.name,
    regionGroup: loaded.inputs.get(s.iata)!.regionGroup,
    total: round(s.total, 2),
    confidence: s.confidence,
    weightCoverage: round(s.weightCoverage, 4),
    // Size context, NOT part of the score: separates "most pressured" from "biggest absolute opportunity".
    pax12m: loaded.metrics.find((m) => m.iata === s.iata)!.pax12m ?? null,
    unmetSeats: round(unmet.get(s.iata) ?? 0, 0),
    components: Object.fromEntries(
      Object.values(s.components).map((c) => [
        c.component,
        {
          available: c.available,
          rawValue: c.rawValue,
          rawValues: c.rawValues,
          score: round(c.score, 2),
          configuredWeight: c.configuredWeight,
          appliedWeight: round(c.weight, 4),
          contribution: round(c.contribution, 3),
        },
      ]),
    ),
    flags: airportFlags(s, loaded),
  }));

  const sens = sensitivity(loaded.metrics);
  const flags = [...loaded.globalFlags, ...ranking.flatMap((r) => r.flags)];

  return result({
    data: {
      normalization: scores[0].normalization,
      peerSet: "all 16 in-scope airports",
      displayed: ranking.map((r) => r.airport),
      window: loaded.window.label,
      weightsVersion: defaultConfig.weightsVersion,
      configuredWeights: defaultConfig.weights,
      ranking,
      sensitivity: {
        scope: "all 16 airports",
        perturbation: sens.perturbation,
        baselineOrder: sens.baselineOrder,
        top1Stable: sens.summary.top1Stable,
        top3SetStable: sens.summary.top3SetStable,
        top3OrderStable: sens.summary.top3OrderStable,
        maxRankMove: sens.summary.maxRankMove,
        scenariosChangingTop1: sens.summary.scenariosChangingTop1,
        scenariosChangingTop3Set: sens.summary.scenariosChangingTop3Set,
        note: "Each weight perturbed by +-10% (relative), others re-normalized; 10 scenarios.",
      },
    },
    sources: [SRC.t100, SRC.ontime, SRC.fares, SRC.taf, SRC.ourairports],
    assumptions: [
      "Expansion attractiveness is a demand-pressure proxy (load factor, growth, delay, fares, scale). No source has gates or terminal square footage, so physical terminal need is not measured.",
      `Traffic metrics use the trailing-12-month window ${loaded.window.label} on an origin (enplaned) basis, passenger classes F/L only; freight is excluded.`,
      "Growth blends recovery vs 2019 (trailing-12m pax / 2019 pax) and the FAA TAF 2025 enplanement CAGR FY2025-FY2030, 50/50 as configured. TAF is used for growth ratios, not levels.",
      "Congestion = share of ARRIVING flights with a NAS-attributed delay (delay causes are attached to arrivals), pooled over the window, from reporting carriers only. Airports with On-Time coverage < 50% of T-100 departures get a null component.",
      "Pricing power = mean of fare / 16-airport median over the latest 4 quarters (domestic origin-airport average fares; no national benchmark).",
      `Scores (${scores[0].normalization.label}) are always computed against all 16 airports; region/airport filters only choose which rows are shown. rankOverall is the rank among all 16, rankInScope the rank among the rows shown. The same airport has the same score in every question.`,
      "pax12m and unmetSeats are size context and are NOT part of the score. unmetSeats = sum over route-months of seats x max(0, LF - 0.85) in the window (same logic as getUnmetDemand's headline); it is a load-factor proxy, not measured unmet demand.",
      "Scores are deterministic: same data and weights give the same ranking. A snapshot of the displayed rows is saved in AirportScore (rank = rankOverall).",
    ],
    flags,
    methodology: scoringMethodology(defaultConfig.weights, defaultConfig.normalization),
  });
}
