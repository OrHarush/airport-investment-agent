import { Box, Divider, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { ChatMessageDTO, EvidenceItem } from "@airport/shared";
import { clearConversation, getConversation, sendChat } from "./api";
import Chat from "./components/Chat";
import EvidencePanel from "./components/EvidencePanel";

export default function App() {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConversation()
      .then(({ messages }) => {
        setMessages(messages);
        const last = [...messages].reverse().find((m) => m.role === "assistant" && m.evidence?.length);
        setEvidence(last?.evidence ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const send = async (text: string) => {
    setError(null);
    setLoading(true);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text, createdAt: now }]);
    try {
      const { reply, evidence } = await sendChat(text);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: reply, evidence, createdAt: new Date().toISOString() }]);
      setEvidence(evidence as EvidenceItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    await clearConversation();
    setMessages([]);
    setEvidence([]);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Box sx={{ px: 2, py: 1, bgcolor: "primary.main", color: "primary.contrastText" }}>
        <Typography variant="h6">Airport Investment Intelligence Agent</Typography>
      </Box>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
          <Chat messages={messages} loading={loading} error={error} onSend={send} onReset={reset} />
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ width: "45%", minWidth: 360, overflowY: "auto", bgcolor: "grey.50" }}>
          <EvidencePanel evidence={evidence} />
        </Box>
      </Box>
    </Box>
  );
}
