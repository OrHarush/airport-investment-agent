import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessageDTO, LlmRateLimit, LlmUsage } from "@airport/shared";

export const STARTERS = [
  "Which airports in New England are strong candidates for terminal expansion?",
  "Compare LA and Santa Ana airport congestion levels.",
  "What is the percentage of long haul flights out of Anchorage airport?",
  "What is the unmet flight demand in SFO airport and why?",
];

interface Props {
  messages: ChatMessageDTO[];
  loading: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
  selectedId: string | null;
  opening?: boolean;
  onSelect: (id: string) => void;
  llm?: { usage: LlmUsage | null; rateLimit: LlmRateLimit | null } | null;
}

const tok = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

/** Quiet usage line under the composer. Values come from the server (provider usage + x-ratelimit headers); hidden for the mock provider. */
function UsageFooter({ llm }: { llm?: Props["llm"] }) {
  const u = llm?.usage, r = llm?.rateLimit;
  if (!u && !r) return null;
  const hasWindow = r && r.tokensLimit !== null && r.tokensRemaining !== null;
  const pct = hasWindow ? Math.max(0, Math.min(100, (r.tokensRemaining! / r.tokensLimit!) * 100)) : null;
  return (
    <div className="usage" aria-label="LLM usage">
      <span>
        {u ? `This answer: ${tok(u.totalTokens)} tokens${u.rounds > 1 ? ` · ${u.rounds} rounds` : ""}` : ""}
        {u && hasWindow ? " · " : ""}
        {hasWindow ? `Groq tokens/min: ${tok(r.tokensRemaining!)} of ${tok(r.tokensLimit!)} left${r.resetTokens !== null ? `, resets in ${secs(r.resetTokens)}` : ""}` : ""}
      </span>
      {pct !== null && (
        <span className={`usage-bar ${pct < 25 ? "low" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}

export default function Chat({ messages, loading, error, onSend, onRetry, selectedId, onSelect, opening, llm }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length || loading || error) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);
  useEffect(() => {
    if (!loading) inputRef.current?.focus({ preventScroll: true });
  }, [loading]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || loading) return;
    setText("");
    onSend(t);
  };

  return (
    <main className="chat">
      <div className="scroll">
        <div className="col">
          {messages.length === 0 && !loading && !opening && (
            <div className="empty">
              <h1>Ask about US airport investment candidates</h1>
              <p>Rankings, comparisons, route mix and unmet demand, each backed by its data.</p>
              <div className="starters">
                {STARTERS.map((q) => (
                  <button key={q} className="starter" onClick={() => onSend(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="msg-user">{m.content}</div>
            ) : (
              <div key={m.id} className="msg-assistant md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                {m.evidence && m.evidence.length > 0 && (
                  <button className={`ev-link ${selectedId === m.id ? "on" : ""}`} aria-pressed={selectedId === m.id} onClick={() => onSelect(m.id)}>
                    {selectedId === m.id ? "Showing evidence" : "Show evidence"}
                    <span>{m.evidence.map((e) => e.tool).join(", ")}</span>
                  </button>
                )}
              </div>
            ),
          )}
          {loading && (
            <div className="thinking" role="status">
              <span className="dots"><i /><i /><i /></span>
              Thinking and calling tools…
            </div>
          )}
          {error && !loading && (
            <div className="error" role="alert">
              <span>{error}. Nothing was lost.</span>
              <button onClick={onRetry}>Try again</button>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <div className="composer-wrap">
        <div className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            disabled={loading}
            placeholder="Ask about airports"
            aria-label="Message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button className="send" onClick={submit} disabled={loading || !text.trim()} aria-label="Send">
            <ArrowUpwardRounded />
          </button>
        </div>
        <div className="hint">Enter to send · Shift+Enter for a new line</div>
        <UsageFooter llm={llm} />
      </div>
    </main>
  );
}
