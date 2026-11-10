import { useEffect, useRef, useState } from "react";
import type { LlmRateLimit, LlmUsage } from "@airport/shared";
import { labelOf } from "../evidence/util";

/** Last answer's provider numbers, stamped on arrival so the reset countdown needs no extra API calls. */
export interface LlmInfo {
  usage: LlmUsage | null;
  rateLimit: LlmRateLimit | null;
  receivedAt: number;
  /** Client-side sum of totalTokens over this page session. */
  sessionTokens: number;
}

const tok = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

const R = 11;
const C = 2 * Math.PI * R;

/** Ring gauge of tokens/min left, with a click popover. Hidden when the provider reports no limits (mock). */
export default function UsageGauge({ llm }: { llm?: LlmInfo | null }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const r = llm?.rateLimit ?? null;
  const resetAt = llm && r && r.resetTokens !== null ? llm.receivedAt + r.resetTokens * 1000 : null;

  // 1s tick only while the window is still counting down; it stops itself once resetAt has passed.
  useEffect(() => {
    if (resetAt === null) return;
    setNow(Date.now());
    if (Date.now() >= resetAt) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= resetAt) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [resetAt]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!llm || !r || r.tokensLimit === null || r.tokensRemaining === null) return null;

  const limit = r.tokensLimit;
  const passed = resetAt !== null && now >= resetAt;
  const remaining = passed ? limit : r.tokensRemaining;
  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  const low = pct < 25;
  const left = resetAt !== null && !passed ? Math.max(0, Math.ceil((resetAt - now) / 1000)) : null;
  const u = llm.usage;
  const rq = r.requestsLimit !== null && r.requestsRemaining !== null ? { left: r.requestsRemaining, limit: r.requestsLimit } : null;

  return (
    <div className="gauge" ref={box}>
      <button
        className={`gauge-btn ${low ? "low" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`LLM usage: ${Math.round(pct)}% of tokens per minute left`}
      >
        <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden>
          <circle cx="14" cy="14" r={R} className="gauge-track" />
          <circle cx="14" cy="14" r={R} className="gauge-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 14 14)" />
        </svg>
      </button>
      {open && (
        <div className="gauge-pop" role="dialog" aria-label="LLM usage">
          <div className="gp-row">
            <b>Tokens per minute</b>
            <span>{tok(remaining)} of {tok(limit)} left</span>
          </div>
          <span className={`usage-bar ${low ? "low" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <div className="gp-sub">{passed ? "Limit has reset" : left !== null ? `Resets in ${secs(left)}` : "Reset time not reported"}</div>
          {rq && (
            <div className="gp-row">
              <span>Requests left</span>
              <span>{rq.left} of {rq.limit}</span>
            </div>
          )}
          {u && (
            <>
              <div className="gp-h">This answer</div>
              <div className="gp-row"><span>Prompt</span><span>{tok(u.promptTokens)}</span></div>
              <div className="gp-row"><span>Completion</span><span>{tok(u.completionTokens)}</span></div>
              <div className="gp-row"><span>Rounds</span><span>{u.rounds}</span></div>
              {u.toolTokens && u.toolTokens.length > 0 && (
                <>
                  <div className="gp-h">Tool results sent to the model</div>
                  {u.toolTokens.map((t, i) => (
                    <div className="gp-row" key={i}><span>{labelOf(t.tool)}</span><span>~{tok(t.tokens)}</span></div>
                  ))}
                </>
              )}
            </>
          )}
          <div className="gp-h">Session</div>
          <div className="gp-row"><span>Total tokens</span><span>{tok(llm.sessionTokens)}</span></div>
        </div>
      )}
    </div>
  );
}
