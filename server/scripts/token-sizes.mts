// Measures what each tool result costs the model. tokens ~ chars/4 (rough; Groq counts with the model tokenizer).
import { executeTool } from "../src/tools/index.js";
import { prisma } from "../src/db.js";
let compact: ((n: string, r: any) => any) | undefined;
try { compact = (await import("../src/tools/compact.js")).compactForModel; } catch {}
const est = (o: unknown) => Math.ceil(JSON.stringify(o).length / 4);
const calls: [string, object][] = [
  ["rankAirports", {}], ["rankAirports", { region: "New England" }], ["compareAirports", { a: "LAX", b: "SNA" }],
  ["getAirportProfile", { airport: "SFO" }], ["getRouteMix", { airport: "ANC" }], ["getUnmetDemand", { airport: "SFO" }],
  ["getLiveAirportStatus", { airport: "BOS" }],
];
const rows: string[] = [];
for (const [n, a] of calls) {
  const out = await executeTool(n, JSON.stringify(a));
  if (!out.ok) { rows.push(`${n} ${JSON.stringify(a)}: ERROR ${out.error}`); continue; }
  const full = est(out.result);
  const c = compact ? est(compact(n, out.result)) : "-";
  rows.push(`${n.padEnd(22)} ${JSON.stringify(a).padEnd(24)} full ~${full} tok   model ~${c} tok`);
  if (process.env.DUMP === n) console.log(JSON.stringify(compact ? compact(n, out.result) : out.result, null, 1));
}
console.log(rows.join("\n"));
await prisma.$disconnect();
