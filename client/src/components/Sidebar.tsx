import AddRounded from "@mui/icons-material/AddRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ViewSidebarOutlined from "@mui/icons-material/ViewSidebarOutlined";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "../api";
import { groupConversations } from "../lib";

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  loaded: boolean;
  listError: boolean;
  onRetryList: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCollapse: () => void;
}

function Item({ c, active, onOpen, onRename, onDelete }: { c: ConversationSummary; active: boolean; onOpen: () => void; onRename: (t: string) => Promise<void>; onDelete: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [draft, setDraft] = useState(c.title);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === "rename") input.current?.select();
  }, [mode]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setMode("view");
    } catch {
      /* keep the editor open so the user can retry */
    } finally {
      setBusy(false);
    }
  };
  const saveRename = () => {
    const t = draft.trim();
    if (!t || t === c.title) return setMode("view");
    run(() => onRename(t));
  };

  if (mode === "rename")
    return (
      <li className="conv editing">
        <input
          ref={input}
          className="conv-input"
          value={draft}
          maxLength={120}
          disabled={busy}
          aria-label="Conversation title"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") setMode("view");
          }}
          onBlur={saveRename}
        />
      </li>
    );

  if (mode === "delete")
    return (
      <li className="conv confirm">
        <span>Delete this chat?</span>
        <button className="icon-btn" disabled={busy} aria-label="Confirm delete" onClick={() => run(onDelete)}><CheckRounded /></button>
        <button className="icon-btn" disabled={busy} aria-label="Cancel" onClick={() => setMode("view")}><CloseRounded /></button>
      </li>
    );

  return (
    <li className={`conv ${active ? "active" : ""}`}>
      <button className="conv-main" onClick={onOpen} aria-current={active ? "page" : undefined} title={c.title}>
        <span>{c.title}</span>
      </button>
      <span className="conv-actions">
        <button className="icon-btn" aria-label={`Rename ${c.title}`} onClick={() => { setDraft(c.title); setMode("rename"); }}><EditOutlined /></button>
        <button className="icon-btn" aria-label={`Delete ${c.title}`} onClick={() => setMode("delete")}><DeleteOutlineRounded /></button>
      </span>
    </li>
  );
}

export default function Sidebar({ conversations, activeId, loaded, listError, onRetryList, onNew, onOpen, onRename, onDelete, onCollapse }: Props) {
  const groups = groupConversations(conversations);
  return (
    <nav className="sidebar" aria-label="Conversations">
      <div className="sb-head">
        <div className="brand"><span className="brand-mark" />Airport Investment Agent</div>
        <button className="icon-btn" onClick={onCollapse} aria-label="Close sidebar" title="Close sidebar"><ViewSidebarOutlined /></button>
      </div>
      <button className="new-chat" onClick={onNew}><AddRounded />New chat</button>
      <div className="sb-list">
        {listError && (
          <p className="sb-empty">
            Couldn’t load conversations. <button className="link" onClick={onRetryList}>Try again</button>
          </p>
        )}
        {loaded && !listError && groups.length === 0 && <p className="sb-empty">Your conversations will appear here.</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="sb-group">{g.label}</h2>
            <ul>
              {g.items.map((c) => (
                <Item key={c.id} c={c} active={c.id === activeId} onOpen={() => onOpen(c.id)} onRename={(t) => onRename(c.id, t)} onDelete={() => onDelete(c.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
