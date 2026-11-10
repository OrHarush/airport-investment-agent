import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getLiveAirportStatus, NAS_STATUS_URL, parseNasStatusXml, summarizeAirport } from "./liveStatus.js";

// Real sample saved from the FAA API (read-only). No network is used in these tests.
const sample = readFileSync(fileURLToPath(new URL("./fixtures/airport-status-information.xml", import.meta.url)), "utf8");

// SYNTHETIC fixture (not a saved FAA response) for categories absent from the saved sample.
// Shapes follow the FAA AirportStatus DTD as understood; verify against a live response when one appears.
const synthetic = `<AIRPORT_STATUS_INFORMATION><Update_Time>Tue Nov 10 20:00:00 2026 GMT</Update_Time>
<Delay_type><Name>Ground Stops</Name><Ground_Stop_List><Program><ARPT>BOS</ARPT><Reason>thunderstorms</Reason><End_Time>9:15 pm EST</End_Time></Program></Ground_Stop_List></Delay_type>
<Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List><Ground_Delay><ARPT>SFO</ARPT><Reason>low ceilings</Reason><Avg>1 hour and 12 minutes</Avg><Max>2 hours</Max></Ground_Delay></Ground_Delay_List></Delay_type>
<Delay_type><Name>Arrival/Departure Delay Info</Name><Arrival_Departure_Delay_List><Delay><ARPT>SFO</ARPT><Reason>VOL:Volume</Reason><Arrival_Departure Type="Departure"><Min>31 minutes</Min><Max>45 minutes</Max><Trend>Increasing</Trend></Arrival_Departure></Delay></Arrival_Departure_Delay_List></Delay_type>
</AIRPORT_STATUS_INFORMATION>`;

const okFetch = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("parseNasStatusXml: saved FAA sample", () => {
  const p = parseNasStatusXml(sample);

  it("parses the feed timestamp", () => {
    expect(p.updateTimeRaw).toBe("Tue Nov 10 16:09:15 2026 GMT");
    expect(p.updateTime).toBe("2026-11-10T16:09:15.000Z");
  });

  it("extracts all four closure events from both Delay_type blocks", () => {
    expect(p.events.map((e) => e.airport)).toEqual(["SNA", "LAX", "SAN", "LAS"]);
    expect(p.events.every((e) => e.kind === "closure" && e.category === "Airport Closures")).toBe(true);
  });

  it("keeps reason and start/reopen details", () => {
    const sna = p.events[0];
    expect(sna.reason).toContain("SNA AD AP CLSD DLY 0730-1415");
    expect(sna.details).toMatchObject({ Start: "Nov 10 at 07:30 UTC.", Reopen: "Nov 21 at 14:15 UTC." });
    expect(sna.closureScope).toBe("unspecified");
  });

  it("classifies GA-only closures", () => {
    expect(p.events.find((e) => e.airport === "LAX")!.closureScope).toBe("ga_only");
  });
});

describe("summarizeAirport", () => {
  const p = parseNasStatusXml(sample);
  it("reports an unspecified closure as 'closure'", () => {
    const s = summarizeAirport(p, "sna");
    expect(s.airport).toBe("SNA");
    expect(s.status).toBe("closure");
    expect(s.events).toHaveLength(1);
  });
  it("reports GA-only restrictions as 'advisory'", () => {
    expect(summarizeAirport(p, "LAX").status).toBe("advisory");
  });
  it("reports airports not in the feed as normal with no events", () => {
    const s = summarizeAirport(p, "BOS");
    expect(s).toMatchObject({ status: "normal", events: [], available: true });
  });
});

describe("parser: other categories (synthetic fixture)", () => {
  const p = parseNasStatusXml(synthetic);
  it("types ground stops, ground delay programs and arrival/departure delays", () => {
    expect(p.events.map((e) => [e.airport, e.kind])).toEqual([
      ["BOS", "ground_stop"],
      ["SFO", "ground_delay"],
      ["SFO", "delay"],
    ]);
    expect(p.events[0].details.End_Time).toBe("9:15 pm EST");
    expect(p.events[1].details).toMatchObject({ Avg: "1 hour and 12 minutes", Max: "2 hours" });
    expect(p.events[2].details).toMatchObject({
      "Arrival_Departure.direction": "Departure",
      "Arrival_Departure.Min": "31 minutes",
      "Arrival_Departure.Trend": "Increasing",
    });
  });
  it("takes the worst status per airport", () => {
    expect(summarizeAirport(p, "BOS").status).toBe("ground_stop");
    expect(summarizeAirport(p, "SFO").status).toBe("delay");
  });
  it("handles an empty feed", () => {
    const e = parseNasStatusXml("<AIRPORT_STATUS_INFORMATION><Update_Time>Tue Nov 10 20:00:00 2026 GMT</Update_Time></AIRPORT_STATUS_INFORMATION>");
    expect(e.events).toEqual([]);
  });
  it("throws on a document that is not the NAS feed", () => {
    expect(() => parseNasStatusXml("<html><body>Service unavailable</body></html>")).toThrow(/AIRPORT_STATUS_INFORMATION/);
  });
});

describe("getLiveAirportStatus (mocked fetch)", () => {
  const now = () => new Date("2026-11-10T16:10:00.000Z");

  it("returns typed data, a source with retrievedAt and assumptions", async () => {
    const r = await getLiveAirportStatus({ airport: "sna" }, { fetchImpl: okFetch(sample), now });
    expect(r.data).toMatchObject({ airport: "SNA", available: true, status: "closure" });
    expect(r.sources).toEqual([{ name: expect.stringContaining("FAA NAS"), url: NAS_STATUS_URL, retrievedAt: "2026-11-10T16:10:00.000Z" }]);
    expect(r.assumptions.length).toBeGreaterThan(0);
    expect(r.flags.map((f) => f.code)).toContain("CLOSURE_SCOPE_UNVERIFIED");
    expect(r.flags.map((f) => f.code)).not.toContain("LIVE_DATA_UNAVAILABLE");
  });

  it("returns normal for an airport with nothing reported, without flags", async () => {
    const r = await getLiveAirportStatus({ airport: "BOS" }, { fetchImpl: okFetch(sample), now });
    expect(r.data).toMatchObject({ status: "normal", events: [] });
    expect(r.flags).toEqual([]);
  });

  it("flags LIVE_DATA_UNAVAILABLE with no fake data when the network fails", async () => {
    const r = await getLiveAirportStatus({ airport: "SFO" }, { fetchImpl: (async () => { throw new Error("ENOTFOUND"); }) as unknown as typeof fetch });
    expect(r.flags.map((f) => f.code)).toContain("LIVE_DATA_UNAVAILABLE");
    expect(r.data).toMatchObject({ airport: "SFO", available: false });
    expect(r.data).not.toHaveProperty("status");
    expect(r.sources).toEqual([]);
  });

  it("flags LIVE_DATA_UNAVAILABLE on HTTP errors and unreadable bodies", async () => {
    const http = await getLiveAirportStatus({ airport: "SFO" }, { fetchImpl: okFetch("nope", 503) });
    expect(http.flags.map((f) => f.code)).toContain("LIVE_DATA_UNAVAILABLE");
    const bad = await getLiveAirportStatus({ airport: "SFO" }, { fetchImpl: okFetch("<html>oops</html>") });
    expect(bad.flags.map((f) => f.code)).toContain("LIVE_DATA_UNAVAILABLE");
    expect(bad.sources).toEqual([]);
  });

  it("times out via the abort signal", async () => {
    const hang = ((_u: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch;
    const r = await getLiveAirportStatus({ airport: "SFO" }, { fetchImpl: hang, timeoutMs: 20 });
    expect(r.flags.map((f) => f.code)).toContain("LIVE_DATA_UNAVAILABLE");
    expect((r.data as { reason: string }).reason).toMatch(/timed out/);
  });
});
