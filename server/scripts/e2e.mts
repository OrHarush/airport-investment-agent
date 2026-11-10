// E2E runner: posts questions to the running server (/api/chat, same endpoint the UI uses) and checks the answers.
// Usage: tsx scripts/e2e.mts [q1 q2 ...]   (env: API=http://localhost:3001, OUT=path/to/results.json)
import { writeFileSync } from "node:fs";

const API = process.env.API ?? "http://localhost:3001";

interface Case {
  id: string;
  question: string;
  /** Substrings (regex source, case-insens.) that must appear in the answer. */
  expect: { label: string; re: string }[];
  /** Tools that must have been called. */
  tools: string[];
  /** Caveat patterns: at least one must appear. */
  caveats: string[];
}

const CASES: Case[] = [
  {
    id: "q1",
    question: "Rank the New England airports for terminal-expansion investment.",
    tools: ["rankAirports"],
    expect: [
      ...["BOS 71.9", "BTV 70.8", "PWM 61.4", "BDL 54.6", "PVD 47.6", "MHT 33.9"].map((s) => ({
        label: s,
        // tolerate tool precision (71.89) and table cells ("| BOS | 71.89"): same value at 1 or 2 dp
        re: s.replace(" ", "\\D{0,40}?").replace(/(\d+)\.(\d)$/, "$1\\.$2\\d?"),
      })),
      { label: "BOS unmetSeats 398,907", re: "398,?907" },
      { label: "BTV unmetSeats 14,587", re: "14,?587" },
      { label: "most pressured view", re: "pressure" },
      { label: "absolute opportunity view", re: "opportunity|absolute" },
      { label: "states views disagree (BTV vs BOS)", re: "disagree|diverge" },
      { label: "no NE airport reaches LF 0.85", re: "(no|none|neither|not).{0,80}(0\\.85|85\\s?%)|(0\\.85|85\\s?%).{0,80}(no |none|not |below|under)" },
    ],
    caveats: ["proxy|threshold|comfort", "partial|coverage|2026"],
  },
  {
    id: "q2",
    question: "Compare LAX vs SNA on congestion.",
    tools: ["compareAirports"],
    expect: [
      { label: "LAX NAS arrival delay 9.3%", re: "9\\.(3|26)\\s?%" },
      { label: "SNA NAS arrival delay 8.2%", re: "8\\.(2|15)\\s?%" },
      { label: "~20% delayed 15+", re: "\\b(19|20)(\\.\\d+)?\\s?%" },
      { label: "63.6k departures/runway", re: "63[.,]6|63,607" },
      { label: "25.5k departures/runway", re: "25[.,]5|25,489" },
    ],
    caveats: ["coverage|partial|2026|sample"],
  },
  {
    id: "q3",
    question: "How much of ANC's traffic is long-haul?",
    tools: ["getRouteMix"],
    expect: [
      { label: "pax-only 17.7%", re: "17\\.(7|69)\\s?%" },
      { label: "pax-only 9.8%", re: "9\\.80?\\s?%" },
      { label: "pax-only 2.8%", re: "2\\.(8|82)\\s?%" },
      { label: "with cargo 49.3%", re: "49\\.(3|26)\\s?%" },
      { label: "with cargo 43.3%", re: "43\\.(3|27)\\s?%" },
      { label: "with cargo 31.1%", re: "31\\.(1|12)\\s?%" },
      { label: "freighters 56.5%", re: "56\\.(5|53)\\s?%" },
      { label: "cutoff stated", re: "3,?000" },
    ],
    caveats: ["cargo|freighter", "partial|2026|definition|cutoff"],
  },
  {
    id: "q4",
    question: "Where is the unmet demand at SFO?",
    tools: ["getUnmetDemand"],
    expect: [
      { label: "556,759 seats", re: "556,?759" },
      { label: "annual 0 / LF 0.823", re: "0\\.82" },
      ...["EWR", "JFK", "ORD", "HNL", "DFW", "HKG"].map((r) => ({ label: `route ${r}`, re: r })),
      ...["2026-06", "2025-07", "2025-08"].map((m) => ({ label: `peak ${m}`, re: m })),
      { label: "proxy / not observed", re: "proxy|not .{0,30}(observed|measured|turned)|inferred|above" },
    ],
    caveats: ["proxy|threshold|0\\.85|85\\s?%", "partial|2026|inferred"],
  },
];

// ---------- number checking ----------
const NUM = /(?<![\w.])-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])-?\d+(?:\.\d+)?/g;

function collectToolNumbers(evidence: unknown, args: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v);
    else if (typeof v === "string") for (const m of v.matchAll(NUM)) out.push(Number(m[0].replace(/,/g, "")));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(evidence);
  walk(args);
  return out;
}

function decimals(s: string): number {
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

const ALWAYS_OK = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 85, 0.85, 12, 100]); // list numbers, "15+ min", 16 airports, 12 months, 85% threshold

/** Normalise typography the model likes to use: non-breaking hyphens, space-grouped thousands. */
export function normalize(s: string): string {
  return s
    .replace(/[‐-―−]/g, "-")
    .replace(/(\d{1,3})(?:[    ](\d{3}))+(?![\d])/g, (m) => m.replace(/[    ]/g, ","))
    .replace(/(\d)\s?%/g, "$1%");
}

export function checkNumbers(answer: string, toolNums: number[]): { ungrounded: string[]; checked: number } {
  const ungrounded: string[] = [];
  let checked = 0;
  // drop list markers, ISO dates/months, years
  const cleaned = normalize(answer)
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "")
    .replace(/\b20\d{2}(?:-\d{2})?(?:\.\.20\d{2}-\d{2})?\b/g, " ")
    .replace(/\b20\d{2}Q[1-4]\b/g, " ")
    .replace(/\*\*/g, "");
  for (const m of cleaned.matchAll(NUM)) {
    const raw = m[0];
    const after = cleaned.slice(m.index! + raw.length, m.index! + raw.length + 2);
    const v = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    const d = decimals(raw);
    const suffix = /^\s?[kK]\b/.test(after) || after[0] === "k" ? "k" : /^\s?[mM](?![a-z])/.test(after) ? "M" : /^\s?%/.test(after) ? "%" : "";
    checked++;
    if (ALWAYS_OK.has(v) && suffix === "") continue;
    const eq = (c: number) => Math.abs(Number(c.toFixed(d)) - v) < 1e-9 || Math.abs(c - v) < 1e-9;
    const ok = toolNums.some(
      (x) => eq(x) || eq(x * 100) || (suffix === "k" && eq(x / 1e3)) || (suffix === "M" && eq(x / 1e6)) || (suffix === "%" && eq(x * 100)),
    );
    if (!ok) ungrounded.push(raw + suffix);
  }
  return { ungrounded: [...new Set(ungrounded)], checked };
}

// ---------- methodology check ----------
// Flag method claims that no tool field supports: weights quoted, named techniques not present in tool text.
export function checkMethodology(answer: string, evidence: any[]): string[] {
  const toolText = JSON.stringify(evidence.map((e) => ({ m: e.methodology, a: e.assumptions, d: e.data?.normalization, w: e.data?.configuredWeights, win: e.data?.window }))).toLowerCase();
  const issues: string[] = [];
  const terms = ["z-score", "zscore", "percentile", "regression", "machine learning", "exponential", "weighted average", "min-max", "minmax", "cagr", "moving average", "bayesian", "logistic"];
  for (const t of terms) if (answer.toLowerCase().includes(t) && !toolText.includes(t.replace("zscore", "z-score"))) issues.push(`method term not in tool fields: "${t}"`);
  for (const m of answer.matchAll(/(\d{1,3})\s?%\s*(?:weight|weighted)|weight(?:s|ed)?[^.\n]{0,25}?(\d{1,3})\s?%/gi)) {
    const n = Number(m[1] ?? m[2]);
    const frac = n / 100;
    if (!toolText.includes(String(frac)) && !toolText.includes(String(n))) issues.push(`weight not in tool fields: ${m[0]}`);
  }
  return issues;
}

/** Style rules: tables only for 3+ airports, no flag codes, no tool/field names. */
export function checkStyle(answer: string, id: string): string[] {
  const out: string[] = [];
  if (id !== "q1" && /^\s*\|.*\|\s*$/m.test(answer)) out.push("markdown table used for <3 airports");
  const codes = answer.match(/\b[A-Z]{3,}(?:_[A-Z0-9]+)+\b/g);
  if (codes) out.push(`flag codes printed: ${[...new Set(codes)].join(", ")}`);
  const ids = answer.match(/\b[a-z]+[A-Z][A-Za-z]+\(?\)?|`[^`]+`/g);
  if (ids) out.push(`tool/field names printed: ${[...new Set(ids)].join(", ")}`);
  return out;
}

async function post(path: string, body: unknown) {
  const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json() as Promise<any>;
}

async function main() {
  const want = process.argv.slice(2);
  const results: any[] = [];
  for (const c of CASES.filter((c) => !want.length || want.includes(c.id))) {
    const t0 = Date.now();
    let res: any;
    try {
      // Groq free tier: 8000 tokens/min. Space the runs and retry once after a 413/429-induced failure.
      if (results.length) await new Promise((r) => setTimeout(r, Number(process.env.GAP_MS ?? 10_000)));
      try {
        res = await post("/api/chat", { message: c.question });
      } catch {
        await new Promise((r) => setTimeout(r, 70_000));
        res = await post("/api/chat", { message: c.question });
      }
    } catch (e) {
      results.push({ id: c.id, question: c.question, error: String(e), pass: false });
      continue;
    }
    const detail = await fetch(`${API}/api/conversations/${res.conversation.id}`).then((r) => r.json() as Promise<any>);
    const assistant = detail.messages.filter((m: any) => m.role === "assistant").at(-1);
    const toolCalls: any[] = assistant?.toolCalls ?? [];
    const evidence: any[] = res.evidence ?? [];
    const answer: string = res.reply;
    const nums = collectToolNumbers(evidence, toolCalls.map((t) => t.arguments));
    const a = checkNumbers(answer, nums);
    const methodIssues = checkMethodology(answer, evidence);
    const missing = c.expect.filter((e) => !new RegExp(e.re, "i").test(normalize(answer))).map((e) => e.label);
    const toolsMissing = c.tools.filter((t) => !toolCalls.some((x) => x.name === t));
    const caveatMissing = c.caveats.filter((re) => !new RegExp(re, "i").test(normalize(answer)));
    const style = checkStyle(answer, c.id);
    const pass = !style.length && !a.ungrounded.length && !methodIssues.length && !missing.length && !toolsMissing.length && !caveatMissing.length && !toolCalls.some((t) => t.error);
    results.push({
      id: c.id,
      question: c.question,
      seconds: Math.round((Date.now() - t0) / 100) / 10,
      toolCalls: toolCalls.map((t) => ({ name: t.name, arguments: t.arguments, error: t.error })),
      answer,
      checks: {
        a_ungroundedNumbers: a.ungrounded,
        numbersChecked: a.checked,
        b_methodologyIssues: methodIssues,
        c_caveatsMissing: caveatMissing,
        styleIssues: style,
        expectedMissing: missing,
        toolsMissing,
      },
      pass,
    });
    console.log(`\n=== ${c.id} ${pass ? "PASS" : "FAIL"} (${results.at(-1).seconds}s)\n${JSON.stringify(toolCalls.map((t) => ({ n: t.name, a: t.arguments, e: t.error })))}\n${answer}\n${JSON.stringify(results.at(-1).checks)}`);
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(results, null, 2));
}

if (process.argv[1]?.endsWith("e2e.mts")) await main();
