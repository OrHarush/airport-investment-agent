import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessageDTO } from "@airport/shared";
import UsageGauge, { type LlmInfo } from "./UsageGauge";

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
  llm?: LlmInfo | null;
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
              <span>{error}</span>
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
          <UsageGauge llm={llm} />
          <button className="send" onClick={submit} disabled={loading || !text.trim()} aria-label="Send">
            <ArrowUpwardRounded />
          </button>
        </div>
        <div className="hint">Enter to send · Shift+Enter for a new line</div>
      </div>
    </main>
  );
}
