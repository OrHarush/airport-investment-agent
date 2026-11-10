import { LlmError } from "./llm/errors.js";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { config } from "./config.js";
import { createProvider } from "./llm/index.js";
import { NotFound, conversationRouter } from "./routes/conversations.js";

const app = express();
app.use(cors());
app.use(express.json());
const provider = createProvider();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: provider.name });

app.use("/api", conversationRouter(provider));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues.map((i) => i.message).join("; ") });
    return;
  }
  if (err instanceof NotFound) {
    res.status(404).json({ error: err.message });
    return;
  }
  console.error(err);
  if (err instanceof LlmError) {
    const retryAt = err.retryAfterSeconds !== null ? new Date(Date.now() + Math.ceil(err.retryAfterSeconds) * 1000).toISOString() : undefined;
    const status = err.kind === "rate_limit" ? 429 : err.kind === "too_large" ? 413 : 502;
    res.status(status).json({ error: "The AI model could not answer.", kind: err.kind, ...(retryAt && { retryAt }) });
    return;
  }
  res.status(500).json({ error: "Something went wrong on the server.", kind: "server" });
});
});

app.listen(config.port, () => console.log(`server on :${config.port} (provider=${provider.name})`));
