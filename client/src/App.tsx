import AddRounded from "@mui/icons-material/AddRounded";
import ViewSidebarOutlined from "@mui/icons-material/ViewSidebarOutlined";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessageDTO, EvidenceItem } from "@airport/shared";
import { loadSavedLlm, saveLlm, type LlmInfo } from "./components/UsageGauge";
import {
  ApiError,
  friendlyError,
  getLlmUsage,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  sendChat,
  type ConversationSummary,
} from "./api";
import Chat from "./components/Chat";
import Sidebar from "./components/Sidebar";
import EvidencePanel from "./evidence/EvidencePanel";
import { store, useMedia, useRouteId } from "./lib";

const EV_DEFAULT = 440;
const EV_MIN = 320;
const EV_MAX_FRACTION = 0.6;

const latestWithEvidence = (ms: ChatMessageDTO[]) => [...ms].reverse().find((m) => m.role === "assistant" && m.evidence?.length)?.id ?? null;

export default function App() {
  const narrow = useMedia("(max-width: 899px)");
  const [routeId, go] = useRouteId();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [llm, setLlm] = useState<LlmInfo | null>(loadSavedLlm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastText = useRef<Record<string, string>>({});
  const skipLoad = useRef<string | null>(null); // conversation we just created locally: don't refetch it
  const activeRef = useRef<string | null>(null);
  activeRef.current = routeId;

  // layout state (persisted)
  const [sidebarOpen, setSidebarOpen] = useState(() => store.get("sidebar") !== "closed");
  const [drawer, setDrawer] = useState(false);
  const [evOpen, setEvOpen] = useState(() => store.get("evidence") !== "closed");
  const [evWidth, setEvWidth] = useState(() => {
    const n = Number(store.get("evidenceWidth"));
    return Number.isFinite(n) && n >= EV_MIN ? n : EV_DEFAULT;
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const evRef = useRef<HTMLElement>(null);

  const refreshList = useCallback(
    () =>
      listConversations()
        .then((l) => {
          setConversations(l);
          setListError(false);
        })
        .catch(() => setListError(true))
        .finally(() => setListLoaded(true)),
    [],
  );
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Last usage: kept in the browser (localStorage) and, if the server has a newer one, taken from it.
  useEffect(() => {
    getLlmUsage().then((s) => s && setLlm((p) => (!p || s.receivedAt > p.receivedAt ? s : p))).catch(() => {});
  }, []);
  useEffect(() => {
    if (llm) saveLlm(llm);
  }, [llm]);

  // Load the conversation named by the URL.
  useEffect(() => {
    setOpenError(null);
    if (!routeId) {
      setMessages([]);
      setSelectedId(null);
      setOpening(false);
      return;
    }
    if (skipLoad.current === routeId) {
      skipLoad.current = null;
      return;
    }
    let live = true;
    setOpening(true);
    setMessages([]);
    getConversation(routeId)
      .then((c) => {
        if (!live) return;
        setMessages(c.messages);
        setSelectedId(latestWithEvidence(c.messages));
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) go(null, true); // deleted or unknown id
        else setOpenError("Couldn’t load this conversation.");
      })
      .finally(() => live && setOpening(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, reloadTick]);

  const run = async (text: string, appendUser: boolean) => {
    let id = activeRef.current;
    try {
      if (!id) {
        const c = await createConversation();
        id = c.id;
        skipLoad.current = id;
        setConversations((l) => [c, ...l]);
        go(id);
      }
    } catch (e) {
      setErrors((x) => ({ ...x, "": friendlyError(e) }));
      return;
    }
    const cid = id;
    lastText.current[cid] = text;
    setErrors((x) => ({ ...x, [cid]: "" }));
    setPending((p) => ({ ...p, [cid]: true }));
    if (appendUser) setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await sendChat(cid, text);
      setLlm((p) => ({ usage: res.usage, rateLimit: res.rateLimit, receivedAt: Date.now(), sessionTokens: (p?.sessionTokens ?? 0) + (res.usage?.totalTokens ?? 0) }));
      setConversations((l) => [res.conversation, ...l.filter((c) => c.id !== cid)]);
      if (activeRef.current === cid) {
        setMessages((m) => [...m, res.message]);
        setSelectedId(res.message.id);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        refreshList();
        if (activeRef.current === cid) go(null, true);
      } else setErrors((x) => ({ ...x, [cid]: friendlyError(e) }));
    } finally {
      setPending((p) => ({ ...p, [cid]: false }));
    }
  };

  const newChat = () => {
    go(null);
    setDrawer(false);
  };
  const open = (id: string) => {
    go(id);
    setDrawer(false);
  };
  const rename = async (id: string, title: string) => {
    const c = await renameConversation(id, title);
    setConversations((l) => l.map((x) => (x.id === id ? { ...x, title: c.title, updatedAt: c.updatedAt } : x)));
  };
  const remove = async (id: string) => {
    await deleteConversation(id);
    setConversations((l) => l.filter((c) => c.id !== id));
    if (activeRef.current === id) go(null, true);
  };

  // Evidence for the selected assistant message, plus the question that triggered it.
  const { evidence, question } = useMemo(() => {
    const i = messages.findIndex((m) => m.id === selectedId);
    const m = messages[i];
    const q = i > 0 ? [...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.content : undefined;
    return { evidence: (m?.evidence ?? []) as EvidenceItem[], question: q };
  }, [messages, selectedId]);

  const select = (id: string) => {
    setSelectedId(id);
    setEvOpen(true);
    if (narrow) requestAnimationFrame(() => evRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /* ---- resizable evidence panel ---- */
  const clampWidth = (w: number) => {
    const total = contentRef.current?.clientWidth ?? window.innerWidth;
    return Math.round(Math.max(EV_MIN, Math.min(total * EV_MAX_FRACTION, w)));
  };
  const commitWidth = (w: number) => {
    setEvWidth(w);
    store.set("evidenceWidth", String(w));
  };
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const right = contentRef.current!.getBoundingClientRect().right;
    const move = (ev: PointerEvent) => setEvWidth(clampWidth(right - ev.clientX));
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      document.body.classList.remove("resizing");
      commitWidth(clampWidth(right - ev.clientX));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const onHandleKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") commitWidth(clampWidth(evWidth + step));
    else if (e.key === "ArrowRight") commitWidth(clampWidth(evWidth - step));
    else if (e.key === "Home") commitWidth(EV_DEFAULT);
    else return;
    e.preventDefault();
  };

  const toggleSidebar = () => {
    if (narrow) return setDrawer((d) => !d);
    setSidebarOpen((o) => {
      store.set("sidebar", o ? "closed" : "open");
      return !o;
    });
  };
  const toggleEvidence = () =>
    setEvOpen((o) => {
      store.set("evidence", o ? "closed" : "open");
      return !o;
    });

  const activeTitle = conversations.find((c) => c.id === routeId)?.title;
  const loading = !!(routeId && pending[routeId]);
  const error = openError || (routeId ? errors[routeId] : errors[""]) || null;
  const sidebarVisible = narrow ? drawer : sidebarOpen;

  return (
    <div className={`app ${sidebarVisible ? "with-sidebar" : ""} ${drawer ? "drawer-open" : ""}`}>
      {narrow && drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      {sidebarVisible && (
        <Sidebar
          conversations={conversations}
          activeId={routeId}
          loaded={listLoaded}
          listError={listError}
          onRetryList={refreshList}
          onNew={newChat}
          onOpen={open}
          onRename={rename}
          onDelete={remove}
          onCollapse={() => (narrow ? setDrawer(false) : toggleSidebar())}
        />
      )}
      <div className="main">
        <header className="topbar">
          <div className="tb-left">
            {!sidebarVisible && (
              <>
                <button className="icon-btn" onClick={toggleSidebar} aria-label="Open sidebar" title="Open sidebar">
                  <ViewSidebarOutlined />
                </button>
                {!narrow && (
                  <button className="icon-btn" onClick={newChat} aria-label="New chat" title="New chat"><AddRounded /></button>
                )}
              </>
            )}
            <span className="tb-title">{activeTitle ?? (sidebarVisible ? "" : "Airport Investment Agent")}</span>
          </div>
          <button className="icon-btn flip" onClick={toggleEvidence} aria-pressed={evOpen} aria-label={evOpen ? "Hide evidence" : "Show evidence"} title={evOpen ? "Hide evidence" : "Show evidence"}>
            <ViewSidebarOutlined />
          </button>
        </header>
        <div
          ref={contentRef}
          className={`content ${evOpen ? "" : "ev-closed"}`}
          style={{ ["--ev-w" as string]: `${evWidth}px` }}
        >
          <Chat
            llm={llm}
            messages={messages}
            loading={loading}
            opening={opening}
            error={error}
            onSend={(t) => run(t, true)}
            onRetry={() => (openError ? setReloadTick((t) => t + 1) : routeId && lastText.current[routeId] && run(lastText.current[routeId], false))}
            selectedId={selectedId}
            onSelect={select}
          />
          {evOpen && (
            <>
              <div
                className="handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize evidence panel"
                aria-valuenow={evWidth}
                aria-valuemin={EV_MIN}
                tabIndex={0}
                title="Drag to resize, double-click to reset"
                onPointerDown={onHandleDown}
                onDoubleClick={() => commitWidth(EV_DEFAULT)}
                onKeyDown={onHandleKey}
              />
              <EvidencePanel key={selectedId ?? "none"} ref={evRef} evidence={evidence} question={question} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
