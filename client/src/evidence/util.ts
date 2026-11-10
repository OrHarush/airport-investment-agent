/* Defensive accessors: tool shapes are still evolving, so every renderer reads through these. */
export type Obj = Record<string, any>;
export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function at(o: unknown, path: string): any {
  let cur: any = o;
  for (const k of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function fmt(n: unknown, digits = 0): string {
  if (!isNum(n)) return "–";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export const fmtPct = (n: unknown, digits = 1) => (isNum(n) ? `${fmt(n, digits)}%` : "–");
/** 0-1 ratio -> "82.3%" */
export const fmtRatio = (n: unknown, digits = 1) => (isNum(n) ? `${fmt(n * 100, digits)}%` : "–");
export function fmtCompact(n: unknown): string {
  if (!isNum(n)) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** "Santa Ana" style short name: drop trailing "International/Regional ... Airport" noise. */
export function shortName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name
    .replace(/\b(International|Intl\.?|Regional|Municipal|Metropolitan|Metro|Airport|Jetport)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

export const labelOf = (key: string) =>
  key
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bnas\b/g, "NAS")
    .replace(/\bpct\b/g, "%")
    .replace(/^./, (c) => c.toUpperCase());
