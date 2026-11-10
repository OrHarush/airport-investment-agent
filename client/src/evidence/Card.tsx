import CheckRounded from "@mui/icons-material/CheckRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { Fragment, useState, type ReactNode } from "react";
import type { EvidenceItem, ToolFlag } from "@airport/shared";

/** Chips grouped by flag code (severity colours the chip); click reveals each flag's short message and technical detail. */
function Flags({ flags }: { flags: ToolFlag[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!flags?.length) return null;
  const groups = new Map<string, ToolFlag[]>();
  for (const f of flags) groups.set(f.code, [...(groups.get(f.code) ?? []), f]);
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  return (
    <>
      <div className="flags">
        {[...groups].map(([k, items]) => (
          <button key={k} className={`flag sev-${items[0].severity}`} aria-expanded={open.has(k)} title={items[0].message} onClick={() => toggle(k)}>
            {k.replace(/_/g, " ").toLowerCase()}
            {items.length > 1 ? ` · ${items.length}` : ""}
          </button>
        ))}
      </div>
      {[...groups].filter(([k]) => open.has(k)).map(([k, items]) => (
        <ul key={k} className="flag-notes">
          {items.map((f, i) => (
            <li key={i}>
              {f.message}
              {f.detail && <small style={{ display: "block", color: "var(--ink-3)" }}>{f.detail}</small>}
            </li>
          ))}
        </ul>
      ))}
    </>
  );
}

function Disclose({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button className="disclose" aria-expanded={open} onClick={onClick}>
      <ChevronRightRounded />
      {label}
    </button>
  );
}

const fmtDate = (s: string) => (isNaN(Date.parse(s)) ? s : new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));

/** Shared card chrome: title, summary (children), amber flags, one collapsed "Assumptions & sources"; header has a Copy JSON button. */
export default function Card({ ev, title, meta, children }: { ev: EvidenceItem; title: string; meta?: [string, ReactNode][]; children: ReactNode }) {
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(ev, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  const hasDetails = ev.assumptions?.length || ev.methodology?.length || ev.sources?.length || meta?.length;
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <button className="icon-btn" onClick={copyJson} title={copied ? "Copied" : "Copy JSON"} aria-label="Copy JSON">
          {copied ? <CheckRounded /> : <ContentCopyRounded />}
        </button>
      </div>
      {children}
      <Flags flags={ev.flags} />
      <div className="card-foot">
        {hasDetails ? (
          <>
            <Disclose label="Assumptions & sources" open={details} onClick={() => setDetails((v) => !v)} />
            {details && (
              <div className="sub">
                {ev.assumptions?.length > 0 && (
                  <>
                    <h4>Assumptions</h4>
                    <ul>{ev.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </>
                )}
                {ev.methodology && ev.methodology.length > 0 && (
                  <>
                    <h4>Methodology</h4>
                    <ul>{ev.methodology.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </>
                )}
                {meta && meta.length > 0 && (
                  <>
                    <h4>Parameters</h4>
                    <dl>{meta.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
                  </>
                )}
                {ev.sources?.length > 0 && (
                  <>
                    <h4>Sources</h4>
                    <ul>
                      {ev.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                          <span style={{ color: "var(--ink-3)" }}> · retrieved {fmtDate(s.retrievedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
