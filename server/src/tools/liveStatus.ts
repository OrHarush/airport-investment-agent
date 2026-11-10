import { XMLParser } from "fast-xml-parser";
import type { ToolFlag, ToolResult } from "@airport/shared";

export const NAS_STATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information";
export const NAS_TIMEOUT_MS = 5000;

export type NasEventKind = "closure" | "ground_stop" | "ground_delay" | "delay" | "other";
export type LiveStatus = "normal" | "advisory" | "delay" | "ground_stop" | "closure";

export interface NasEvent {
  kind: NasEventKind;
  airport: string;
  /** FAA category name as published, e.g. "Airport Closures" */
  category: string;
  reason: string | null;
  /** Remaining scalar fields as published (Start, Reopen, End_Time, Avg, Max, Min, Trend, direction, ...). */
  details: Record<string, string>;
  /** Closures only: "ga_only" when the notice restricts only non-scheduled/transient GA, else "unspecified". */
  closureScope?: "ga_only" | "unspecified";
}

export interface ParsedNasStatus {
  /** ISO timestamp of the FAA feed's Update_Time, or null if missing or unparseable */
  updateTime: string | null;
  updateTimeRaw: string | null;
  events: NasEvent[];
}

export interface LiveAirportStatusData {
  airport: string;
  available: true;
  /** Worst active condition for this airport. "normal" means the feed lists nothing for it. */
  status: LiveStatus;
  feedUpdatedAt: string | null;
  events: NasEvent[];
}

export interface LiveAirportUnavailableData {
  airport: string;
  available: false;
  reason: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (isObj(v) && typeof v["#text"] === "string") return (v["#text"] as string).trim() || null;
  return null;
};

function kindOf(category: string): NasEventKind {
  if (/closure/i.test(category)) return "closure";
  if (/ground\s*stop/i.test(category)) return "ground_stop";
  if (/ground\s*delay/i.test(category)) return "ground_delay";
  if (/delay/i.test(category)) return "delay";
  return "other";
}

/** NOTAM closures that only restrict non-scheduled / transient general aviation do not affect airline service. */
function closureScopeOf(reason: string | null): "ga_only" | "unspecified" {
  return reason && /CLSD TO (NON\s*SKED|TRANSIENT|GA\b)/i.test(reason) ? "ga_only" : "unspecified";
}

function collectDetails(item: Record<string, unknown>, into: Record<string, string>) {
  for (const [k, v] of Object.entries(item)) {
    if (k === "ARPT" || k === "Reason" || k.startsWith("@_")) continue;
    const t = text(v);
    if (t !== null) {
      into[k] = t;
    } else if (isObj(v)) {
      // nested block such as <Arrival_Departure Type="Arrival"><Min/><Max/><Trend/></Arrival_Departure>
      const type = v["@_Type"];
      if (typeof type === "string") into[`${k}.direction`] = type;
      for (const [k2, v2] of Object.entries(v)) {
        const t2 = text(v2);
        if (!k2.startsWith("@_") && t2 !== null) into[`${k}.${k2}`] = t2;
      }
    }
  }
}

/** Parse the FAA NAS airport-status-information XML into typed events. Throws on a malformed document. */
export function parseNasStatusXml(xml: string): ParsedNasStatus {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new Error(`NAS XML parse error: ${(e as Error).message}`);
  }
  const root = doc["AIRPORT_STATUS_INFORMATION"];
  if (!isObj(root)) throw new Error("NAS XML missing AIRPORT_STATUS_INFORMATION root");

  const updateTimeRaw = text(root["Update_Time"]);
  const ms = updateTimeRaw ? Date.parse(updateTimeRaw) : NaN;
  const events: NasEvent[] = [];

  for (const dt of asArray(root["Delay_type"])) {
    if (!isObj(dt)) continue;
    const category = text(dt["Name"]) ?? "Unknown";
    const kind = kindOf(category);
    // Every other child is a list wrapper (e.g. Airport_Closure_List) whose children are the items.
    for (const [listName, list] of Object.entries(dt)) {
      if (listName === "Name" || !isObj(list)) continue;
      for (const items of Object.values(list)) {
        for (const item of asArray(items)) {
          if (!isObj(item)) continue;
          const airport = text(item["ARPT"]);
          if (!airport) continue;
          const reason = text(item["Reason"]);
          const details: Record<string, string> = {};
          collectDetails(item, details);
          const ev: NasEvent = { kind, airport: airport.toUpperCase(), category, reason, details };
          if (kind === "closure") ev.closureScope = closureScopeOf(reason);
          events.push(ev);
        }
      }
    }
  }
  return { updateTime: Number.isNaN(ms) ? null : new Date(ms).toISOString(), updateTimeRaw, events };
}

const SEVERITY: Record<LiveStatus, number> = { normal: 0, advisory: 1, delay: 2, ground_stop: 3, closure: 4 };

function statusOf(ev: NasEvent): LiveStatus {
  switch (ev.kind) {
    case "closure":
      return ev.closureScope === "ga_only" ? "advisory" : "closure";
    case "ground_stop":
      return "ground_stop";
    case "ground_delay":
    case "delay":
      return "delay";
    default:
      return "advisory";
  }
}

/** Reduce a parsed feed to one airport. Absence from the feed means no reported program. */
export function summarizeAirport(parsed: ParsedNasStatus, iata: string): LiveAirportStatusData {
  const code = iata.toUpperCase();
  const events = parsed.events.filter((e) => e.airport === code);
  let status: LiveStatus = "normal";
  for (const ev of events) if (SEVERITY[statusOf(ev)] > SEVERITY[status]) status = statusOf(ev);
  return { airport: code, available: true, status, feedUpdatedAt: parsed.updateTime, events };
}

export interface LiveStatusDeps {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

const baseAssumptions = [
  "Source is the FAA NAS Status feed; it lists only airports with an active program or notice, so 'normal' means none is reported, not a guarantee of on-time operations.",
  "Snapshot only: the feed has no history, so this says nothing about how often the airport is delayed.",
];

function unavailable(airport: string, reason: string): ToolResult<LiveAirportUnavailableData> {
  return {
    data: { airport, available: false, reason },
    sources: [],
    assumptions: ["No live data was obtained, so no status is reported. Do not infer current conditions from this result."],
    flags: [{ code: "LIVE_DATA_UNAVAILABLE", severity: "high", message: "Live FAA status unavailable", detail: reason }],
  };
}

/** Fetch live NAS status for one airport. Never throws; failures return LIVE_DATA_UNAVAILABLE with no data. */
export async function getLiveAirportStatus(
  input: { airport: string },
  deps: LiveStatusDeps = {},
): Promise<ToolResult<LiveAirportStatusData | LiveAirportUnavailableData>> {
  const airport = input.airport.toUpperCase();
  const doFetch = deps.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? NAS_TIMEOUT_MS);
  let xml: string;
  try {
    const res = await doFetch(NAS_STATUS_URL, { signal: ctrl.signal, headers: { Accept: "application/xml" } });
    if (!res.ok) return unavailable(airport, `FAA NAS API returned HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return unavailable(airport, aborted ? `FAA NAS API timed out after ${(deps.timeoutMs ?? NAS_TIMEOUT_MS) / 1000}s` : `FAA NAS API unreachable: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const retrievedAt = (deps.now ?? (() => new Date()))().toISOString();
  let parsed: ParsedNasStatus;
  try {
    parsed = parseNasStatusXml(xml);
  } catch (e) {
    return unavailable(airport, `FAA NAS API returned an unreadable response: ${(e as Error).message}`);
  }

  const data = summarizeAirport(parsed, airport);
  const assumptions = [...baseAssumptions];
  const flags: ToolFlag[] = [];
  if (data.events.some((e) => e.kind === "closure" && e.closureScope === "unspecified")) {
    flags.push({ code: "CLOSURE_SCOPE_UNVERIFIED", severity: "warn", message: "Closure notice may be partial", detail: "The closure notice does not say whether it is GA-only or time-windowed; read the reason text." });
    assumptions.push("A closure notice may be partial or time-windowed (for example a daily overnight closure); read the reason text before concluding the airport is closed right now.");
  }
  if (data.events.some((e) => e.kind === "closure" && e.closureScope === "ga_only")) {
    assumptions.push("Closures limited to non-scheduled/transient general aviation are reported as 'advisory' and do not affect airline service.");
  }
  if (data.feedUpdatedAt === null) flags.push({ code: "FEED_TIMESTAMP_MISSING", severity: "info", message: "Feed has no update timestamp", detail: "The FAA feed did not include a parseable Update_Time." });
  return {
    data,
    sources: [{ name: "FAA NAS Status (airport status information)", url: NAS_STATUS_URL, retrievedAt }],
    assumptions,
    flags,
  };
}
