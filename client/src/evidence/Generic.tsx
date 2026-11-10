import { useMemo, useState } from "react";
import { fmt, isNum, isObj, labelOf, type Obj } from "./util";

const isRows = (v: unknown): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every(isObj);

/** Fallback for tools without a dedicated renderer: tidy key/value lists and sortable tables, no scroll areas of its own. */
export function Value({ v, depth = 0 }: { v: unknown; depth?: number }) {
  if (v == null || v === "") return <>–</>;
  if (isNum(v)) return <>{fmt(v, 2)}</>;
  if (typeof v === "boolean") return <>{v ? "yes" : "no"}</>;
  if (isRows(v)) return <Table rows={v} depth={depth} />;
  if (Array.isArray(v)) return <>{v.map((x) => (isObj(x) || Array.isArray(x) ? JSON.stringify(x) : String(x))).join(", ") || "–"}</>;
  if (isObj(v)) return <KV o={v} depth={depth} />;
  return <>{String(v)}</>;
}

function KV({ o, depth }: { o: Obj; depth: number }) {
  return (
    <dl className="kv">
      {Object.entries(o).map(([k, v]) => {
        const nested = isObj(v) || isRows(v);
        return nested ? (
          <div key={k} className="nest">
            <dt style={{ margin: "8px 0 4px" }}>{labelOf(k)}</dt>
            <dd style={{ paddingLeft: depth ? 8 : 0 }}><Value v={v} depth={depth + 1} /></dd>
          </div>
        ) : (
          <div key={k} style={{ display: "contents" }}>
            <dt>{labelOf(k)}</dt>
            <dd><Value v={v} depth={depth + 1} /></dd>
          </div>
        );
      })}
    </dl>
  );
}

function Table({ rows, depth }: { rows: Obj[]; depth: number }) {
  const cols = useMemo(() => [...new Set(rows.flatMap((r) => Object.keys(r)))], [rows]);
  const [sort, setSort] = useState<{ c: string; dir: 1 | -1 } | null>(null);
  const data = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.c], y = b[sort.c];
      if (x == null) return 1;
      if (y == null) return -1;
      return (isNum(x) && isNum(y) ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
    });
  }, [rows, sort]);
  const numeric = (c: string) => rows.every((r) => r[c] == null || isNum(r[c]));
  return (
    <table className="gtable">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} className={numeric(c) ? "num" : ""}>
              <button onClick={() => setSort((s) => (s?.c === c ? (s.dir === 1 ? { c, dir: -1 } : null) : { c, dir: 1 }))}>
                {labelOf(c)}{sort?.c === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => <td key={c} className={numeric(c) ? "num" : ""}><Value v={r[c]} depth={depth + 1} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Generic({ data }: { data: unknown }) {
  return <Value v={data} />;
}
