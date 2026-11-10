import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { useState } from "react";
import type { EvidenceItem } from "@airport/shared";
import Card from "./Card";
import Generic from "./Generic";
import { at, fmt, fmtCompact, fmtPct, fmtRatio, isNum, labelOf, shortName, type Obj } from "./util";

interface P { ev: EvidenceItem; question?: string }
const d = (ev: EvidenceItem): Obj => (ev.data ?? {}) as Obj;

/* ------------------------------------------------------------------ rankAirports */

const COMPONENT_ORDER = ["utilization", "growth", "congestion", "pricingPower", "scale"];
const COMPONENT_LABEL: Record<string, string> = { utilization: "Utilization", growth: "Growth", congestion: "Congestion", pricingPower: "Pricing power", scale: "Scale" };

/** Rows in the user's question scope: region names or uppercase IATA codes mentioned in it. Null = no clear scope. */
function scopeOf(rows: Obj[], question?: string): Set<string> | null {
  if (!question) return null;
  const q = question.toLowerCase();
  const hit = rows.filter((r) => (r.regionGroup && q.includes(String(r.regionGroup).toLowerCase())) || new RegExp(`\\b${r.airport}\\b`).test(question));
  return hit.length ? new Set(hit.map((r) => r.airport)) : null;
}

function RankRow({ r, shownRank, ofCount, subset, label }: { r: Obj; shownRank?: number; ofCount?: number; subset?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const total = isNum(r.total) ? r.total : 0;
  const comps: Obj = r.components ?? {};
  const keys = [...COMPONENT_ORDER.filter((k) => k in comps), ...Object.keys(comps).filter((k) => !COMPONENT_ORDER.includes(k))];
  return (
    <div>
      <button className="rank-row" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="rank-n">
          <b>{shownRank ?? (subset ? r.rankInScope : (r.rankOverall ?? r.rank))}</b>
          {(shownRank !== undefined || subset) && ofCount !== undefined && <small>#{r.rankOverall ?? r.rank} of {ofCount}</small>}
        </span>
        <span className="rank-name">
          <b>{r.airport}</b>
          <span>{shortName(r.name)}</span>
        </span>
        <span className="rank-vol" title="12-month passengers · unmet seats (proxy: seats above 85% load factor)">
          <span>{isNum(r.pax12m) ? fmt(r.pax12m) : "–"}<small> pax</small></span>
          <span>{isNum(r.unmetSeats) ? fmt(r.unmetSeats) : "–"}<small> unmet</small></span>
        </span>
        <span className="rank-score">
          <em>{fmt(total, 1)}</em>
          <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, total))}%` }} /></span>
        </span>
        <span className={`dot ${r.confidence ?? ""}`} title={`${r.confidence ?? "unknown"} confidence`} aria-label={`${r.confidence ?? "unknown"} confidence`} />
      </button>
      {open && (
        <div className="rank-detail">
          <div className="comp head"><span /><span>{label ?? "Score"}</span><span>× weight</span></div>
          {keys.map((k) => {
            const c = comps[k] ?? {};
            const ok = c.available !== false && isNum(c.score);
            return (
              <div className="comp" key={k}>
                <span>{COMPONENT_LABEL[k] ?? labelOf(k)}</span>
                <span className="bar"><i style={{ width: ok ? `${Math.max(0, Math.min(100, c.score))}%` : 0 }} /></span>
                <span>{ok ? `${fmt(c.score, 0)} × ${fmt(c.appliedWeight, 2)}` : "n/a"}</span>
              </div>
            );
          })}
          <div className="comp" style={{ color: "var(--ink-3)" }}>
            <span>Confidence</span><span>{r.confidence ?? "–"}{r.regionGroup ? ` · ${r.regionGroup}` : ""}</span><span />
          </div>
          {(r.flags as { message: string; severity: string }[] | undefined)?.filter((f) => f.severity !== "info").slice(0, 3).map((f, i) => <p className="rank-note" key={i}>{f.message}</p>)}
        </div>
      )}
    </div>
  );
}

function Rank({ ev, question }: P) {
  const rows: Obj[] = at(ev.data, "ranking") ?? [];
  const [all, setAll] = useState(false);
  const scope = rows.length > 8 ? scopeOf(rows, question) : null;
  const top = scope ? rows.filter((r) => scope.has(r.airport)) : rows.slice(0, rows.length > 8 ? 5 : rows.length);
  const rest = rows.filter((r) => !top.includes(r));
  const sens = d(ev).sensitivity;
  const ofCount: number = (d(ev).sensitivity?.baselineOrder as string[] | undefined)?.length ?? rows.length;
  const subset = rows.length < ofCount;
  const label: string | undefined = d(ev).normalization?.label;
  const meta: [string, React.ReactNode][] = [
    ["Window", d(ev).window ?? "–"],
    ["Weights", `${d(ev).weightsVersion ?? "–"} · ${Object.entries(d(ev).configuredWeights ?? {}).map(([k, v]) => `${COMPONENT_LABEL[k] ?? k} ${v}`).join(", ")}`],
    ["Scoring", label ?? "–"],
    ["Peer set", typeof d(ev).peerSet === "string" ? d(ev).peerSet : (d(ev).peerSet as string[] | undefined)?.join(", ") ?? "–"],
  ];
  return (
    <Card ev={ev} title={scope ? `Ranking · ${[...new Set(top.map((r) => r.regionGroup))].filter(Boolean).join(", ") || "selected airports"}` : "Airport ranking"} meta={meta}>
      <div className="rank">{top.map((r, i) => <RankRow key={r.airport} r={r} shownRank={scope ? i + 1 : undefined} ofCount={scope || subset ? ofCount : undefined} subset={subset} label={label} />)}</div>
      {rest.length > 0 && (
        <>
          <button className="more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            <ChevronRightRounded style={{ fontSize: 18, transform: all ? "rotate(90deg)" : undefined, transition: "transform .2s" }} />
            {all ? "Hide full peer set" : `Show full peer set (${rest.length} more)`}
          </button>
          {all && <div className="rank">{rest.map((r) => <RankRow key={r.airport} r={r} label={label} />)}</div>}
        </>
      )}
      {sens && typeof sens.top1Stable === "boolean" && (
        <p className="stable">
          {sens.top1Stable ? "The top rank holds" : "The top rank changes"} when weights move ±{fmt((sens.perturbation ?? 0.1) * 100, 0)}%.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ compareAirports */

interface Metric { label: string; get: (s: Obj) => unknown; show: (v: unknown) => string; better?: "low" | "high" }
const METRICS: Metric[] = [
  { label: "Rank", get: (s) => s.rank, show: (v) => `#${fmt(v)}`, better: "low" },
  { label: "Investment score", get: (s) => s.total, show: (v) => fmt(v, 1), better: "high" },
  { label: "Congestion score", get: (s) => s.congestionScore, show: (v) => fmt(v, 0), better: "low" },
  { label: "Arrivals, NAS delay", get: (s) => at(s, "delay.arrivals.nasDelayRatePct"), show: (v) => fmtPct(v, 1), better: "low" },
  { label: "Arrivals 15+ min late", get: (s) => at(s, "delay.arrivals.delayed15Pct"), show: (v) => fmtPct(v, 1), better: "low" },
  { label: "95th pct arrival delay", get: (s) => at(s, "delay.arrivals.p95DelayMin"), show: (v) => (isNum(v) ? `${fmt(v, 0)} min` : "–"), better: "low" },
  { label: "Departures per runway", get: (s) => at(s, "scale.t100DeparturesPerOpenRunway"), show: (v) => fmtCompact(v), better: "low" },
  { label: "Open runways", get: (s) => at(s, "scale.openRunways"), show: (v) => fmt(v) },
  { label: "Passengers, 12 mo", get: (s) => at(s, "scale.paxLast12m"), show: (v) => fmtCompact(v), better: "high" },
];

function Compare({ ev }: P) {
  const a = d(ev).a ?? {}, b = d(ev).b ?? {};
  const driver = at(ev.data, "scoreComparison.biggestDriver");
  return (
    <Card ev={ev} title={`${a.airport ?? "A"} vs ${b.airport ?? "B"}`} meta={[["Peer set", at(ev.data, "scoreComparison.peerSet") ?? "–"]]}>
      <div className="cmp">
        <div className="cmp-h"><b>{a.airport}</b><span>{shortName(a.name)}</span></div>
        <div />
        <div className="cmp-h r"><b>{b.airport}</b><span>{shortName(b.name)}</span></div>
        {METRICS.map((m) => {
          const x = m.get(a), y = m.get(b);
          const win = m.better && isNum(x) && isNum(y) && x !== y ? ((m.better === "low" ? x < y : x > y) ? "a" : "b") : null;
          return (
            <div key={m.label} style={{ display: "contents" }}>
              <div className={`cmp-v ${win === "a" ? "win" : ""}`}>{m.show(x)}</div>
              <div className="cmp-l">{m.label}</div>
              <div className={`cmp-v r ${win === "b" ? "win" : ""}`}>{m.show(y)}</div>
            </div>
          );
        })}
      </div>
      <p className="cmp-note">
        Highlight marks the stronger value: lower delay and congestion, higher score and traffic.
        {typeof driver === "string" && ` Biggest score difference: ${(COMPONENT_LABEL[driver] ?? labelOf(driver)).toLowerCase()}.`}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ getRouteMix */

function RouteMix({ ev }: P) {
  const x = d(ev);
  const cutoff = x.requestedCutoffMi;
  const [all, setAll] = useState(false);
  const routes: Obj[] = x.topPassengerRoutes ?? [];
  const shown = all ? routes : routes.slice(0, 5);
  const cargoShare = at(x, "departures.cargoSharePct");
  return (
    <Card ev={ev} title={`Long-haul share · ${x.airport ?? ""}`} meta={[["Year", x.year ?? "–"], ["Requested cutoff", `${fmt(cutoff)} mi`], ["Definition", "Long-haul = route distance at or above the cutoff, by departures"]]}>
      <div className="big">{fmt(at(x, "headline.passengerOnlySharePct"), 1)}<small>%</small></div>
      <p className="big-cap">of {x.airport} passenger departures in {x.year} flew {fmt(cutoff)} miles or more.</p>
      {isNum(at(x, "headline.includingCargoSharePct")) && (
        <p className="big-sub">{fmtPct(at(x, "headline.includingCargoSharePct"))} including cargo flights{isNum(cargoShare) ? ` (cargo is ${fmtPct(cargoShare, 0)} of departures)` : ""}.</p>
      )}
      <div className="bands">
        {((x.sharesByCutoff as Obj[]) ?? []).map((s) => (
          <div key={s.cutoffMi} className={`band ${s.cutoffMi === cutoff ? "on" : ""}`}>
            <b>{fmtPct(at(s, "passengerOnly.sharePct"), 1)}</b>
            <span>{fmt(s.cutoffMi)}+ mi</span>
          </div>
        ))}
      </div>
      {routes.length > 0 && (
        <>
          <div className="list-title">Top routes by departures</div>
          {shown.map((r) => (
            <div className="lrow" key={r.dest}>
              <span>{r.dest}{r.longHaul && <span className="tag">long-haul</span>}<small>{fmt(r.distanceMi)} mi</small></span>
              <span className="v">{fmt(r.departures)}</span>
            </div>
          ))}
          {routes.length > 5 && (
            <button className="more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${routes.length}`}</button>
          )}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ getUnmetDemand */

function Unmet({ ev }: P) {
  const x = d(ev);
  // Primary number: the tool's route-month sum of unmet seats. The annual airport-level figure is secondary
  // (averaging over routes and months hides peaks, so it can be 0). Tool values only, no client math.
  const headline = at(x, "headline.unmetSeats");
  const grain: string | undefined = at(x, "headline.grain");
  const annual = at(x, "airportLevel.unmetPassengers");
  const lf = at(x, "airportLevel.loadFactor");
  const threshold = x.threshold;
  const monthlySum = x.monthlySumUnmetPassengers;
  const routes: Obj[] = x.topRoutesByUnmetSeats ?? [];
  const peaks: Obj[] = x.peakMonths ?? [];
  const [all, setAll] = useState(false);
  const shown = all ? routes : routes.slice(0, 6);
  const signals: Obj[] = x.signals ?? [];
  const supporting = signals.filter((s) => s.supportsConstrainedSupply);
  return (
    <Card ev={ev} title={`Unmet demand · ${x.airport ?? ""}`} meta={[["Window", x.window ?? "–"], ["Threshold", `Load factor above ${fmtRatio(threshold, 0)}`], ["Grain", grain ?? "–"], ["Formula", at(x, "headline.formula") ?? "–"]]}>
      <div className="big">{fmt(headline)}</div>
      <p className="big-cap">unmet seats (proxy), summed over route-months with load factor above {fmtRatio(threshold, 0)}. Not observed turned-away demand.</p>
      <p className="big-sub">
        Annual airport-level figure (secondary): {fmt(annual)} unmet passengers at {fmtRatio(lf)} load factor.
        {isNum(monthlySum) ? ` Month-by-month airport-level sum: ${fmt(monthlySum)}.` : ""}
      </p>
      {routes.length > 0 && (
        <>
          <div className="list-title">Top routes by unmet seats</div>
          {shown.map((r) => (
            <div className="lrow" key={r.dest}>
              <span>{r.dest}<small>{fmt(r.distanceMi)} mi · {fmt(r.monthsAboveThreshold)} months above threshold</small></span>
              <span className="v">{fmt(r.unmetSeats)}<small>{r.peakMonth ? `peak ${r.peakMonth.period} · LF ${fmtRatio(r.peakMonth.loadFactor)}` : "unmet seats"}</small></span>
            </div>
          ))}
          {routes.length > 6 && <button className="more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${routes.length}`}</button>}
        </>
      )}
      {peaks.length > 0 && (
        <>
          <div className="list-title">Peak months</div>
          {peaks.map((m) => (
            <div className="lrow" key={m.period}>
              <span>{m.period}<small>{fmt(m.routesAboveThreshold)} of {fmt(m.routesInMonth)} routes above threshold{m.topRoute ? ` · top ${m.topRoute}` : ""}</small></span>
              <span className="v">{fmt(m.unmetSeats)}<small>unmet seats</small></span>
            </div>
          ))}
        </>
      )}
      {supporting.length > 0 && (
        <>
          <div className="list-title">Signals consistent with tight supply (inferred, not measured)</div>
          {supporting.map((s) => (
            <div className="lrow" key={s.signal}>
              <span>{labelOf(String(s.signal))}</span>
              <span className="v">{typeof s.value === "number" ? fmt(s.value, 2) : String(s.value ?? "–")}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ getAirportProfile */

function Profile({ ev }: P) {
  const x = d(ev);
  const m = x.metadata ?? {};
  const growth = at(x, "growth.last12mVsPrior12mPct.value");
  const tiles: { v: string; l: string; s?: string }[] = [
    { v: fmtCompact(at(x, "traffic.paxLast12m")), l: "Passengers, 12 mo" },
    { v: fmtRatio(at(x, "loadFactor.last12m")), l: "Load factor" },
    { v: isNum(growth) ? `${growth > 0 ? "+" : ""}${fmt(growth, 1)}%` : "–", l: "Traffic vs prior year" },
    { v: isNum(at(x, "score.rank")) ? `#${at(x, "score.rank")}` : "–", l: "Investment rank", s: isNum(at(x, "score.total")) ? `score ${fmt(at(x, "score.total"), 1)}` : undefined },
    { v: isNum(at(x, "congestion.arrivalNasDelayRatePct")) ? fmtPct(at(x, "congestion.arrivalNasDelayRatePct")) : "–", l: "Arrivals with NAS delay" },
    { v: isNum(at(x, "fare.meanVsPeerMedianLast4q")) ? `${fmt(at(x, "fare.meanVsPeerMedianLast4q"), 2)}×` : "–", l: "Fare vs peer median" },
  ];
  return (
    <Card ev={ev} title={`${x.airport ?? ""} profile`} meta={[["Window", at(x, "traffic.window") ?? "–"], ["Runways", `${fmt(at(x, "runways.open"))} open, longest ${fmt(at(x, "runways.longestOpenFt"))} ft`]]}>
      <p className="sub-id">{shortName(m.name)}{m.city ? ` · ${m.city}${m.state ? `, ${m.state}` : ""}` : ""}</p>
      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.l}>
            <b>{t.v}</b>
            <span>{t.l}</span>
            {t.s && <small>{t.s}</small>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ getLiveAirportStatus */

function Live({ ev }: P) {
  const x = d(ev);
  const events: Obj[] = x.events ?? [];
  let cls = "", label = "Normal operations", text = "The FAA feed lists no delays or closures for this airport right now.";
  if (x.available === false) {
    cls = "off"; label = "Unavailable"; text = x.reason ?? "Live data could not be retrieved.";
  } else if (x.status === "closure") {
    cls = "closed"; label = "Closed";
  } else if (x.status && x.status !== "normal") {
    cls = "delay"; label = x.status === "advisory" ? "Advisory" : x.status === "ground_stop" ? "Ground stop" : "Delays";
  }
  if (events.length) text = events.map((e) => `${labelOf(String(e.kind ?? "event")).toLowerCase()}${e.reason ? `: ${e.reason}` : ""}`).join(" · ");
  const when = x.feedUpdatedAt && !isNaN(Date.parse(x.feedUpdatedAt)) ? new Date(x.feedUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <Card ev={ev} title={`Live status · ${x.airport ?? ""}`}>
      <span className={`pill ${cls}`}><i />{label}</span>
      <p className="live-text">{text}{when ? ` Feed updated ${when}.` : ""}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ dispatch */

function Fallback({ ev }: P) {
  return <Card ev={ev} title={labelOf(ev.tool)}><Generic data={ev.data} /></Card>;
}

export const renderers: Record<string, (p: P) => JSX.Element> = {
  rankAirports: Rank,
  compareAirports: Compare,
  getRouteMix: RouteMix,
  getUnmetDemand: Unmet,
  getAirportProfile: Profile,
  getLiveAirportStatus: Live,
};

export { Fallback };
