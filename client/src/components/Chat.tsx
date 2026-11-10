import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { ChatMessageDTO } from "@airport/shared";

interface Props {
  messages: ChatMessageDTO[];
  loading: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onReset: () => void;
}

export default function Chat({ messages, loading, error, onSend, onReset }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = () => {
    const t = text.trim();
    if (!t || loading) return;
    setText("");
    onSend(t);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <Stack spacing={1.5} sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {messages.length === 0 && (
          <Typography color="text.secondary">Ask e.g. "Which airports are the best terminal-expansion investments?"</Typography>
        )}
        {messages.map((m) => (
          <Paper
            key={m.id}
            elevation={0}
            sx={{
              p: 1.5,
              maxWidth: "85%",
              whiteSpace: "pre-wrap",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              bgcolor: m.role === "user" ? "primary.main" : "grey.100",
              color: m.role === "user" ? "primary.contrastText" : "text.primary",
            }}
          >
            {m.content}
          </Paper>
        ))}
        {loading && <CircularProgress size={24} />}
        {error && <Alert severity="error">{error}</Alert>}
        <div ref={endRef} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask about airports…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button variant="contained" onClick={submit} disabled={loading || !text.trim()}>Send</Button>
        <Button onClick={onReset} disabled={loading}>Clear</Button>
      </Stack>
    </Box>
  );
}
