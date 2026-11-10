# Airport Investment Intelligence Agent

LLM agent that ranks/compares US airports for terminal-expansion investment. The LLM only orchestrates: all numbers come from deterministic tools that return `ToolResult { data, sources, assumptions, flags }`, shown in an Evidence panel next to the chat.

> Status: **skeleton**. Tools are stubs returning mock `ToolResult`s (flag `MOCK_DATA`); scoring and real data come later.

## Layout

| Path | Purpose |
|---|---|
| `shared/` | Tool contract types + zod input schemas (consumed as TS source) |
| `server/` | Express API, agent loop, LLM providers (Groq / Mock), Prisma |
| `client/` | Vite + React + MUI chat UI with Evidence panel |
| `docker-compose.yml` | Postgres (host port **5433**) |

## Run (Windows / PowerShell or bash)

Prereqs: Node 20+, Docker Desktop (running).

```bash
npm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm run db:up                 # starts Postgres
npm run db:migrate            # creates tables (Conversation, Message)
npm run dev                   # server :3001 + client :5173
```

Open http://localhost:5173.

## LLM provider

Set `LLM_PROVIDER` in `.env`:

- `mock` (default): no key needed. Emits a fake `rankAirports` tool call, then a fake answer.
- `groq`: set `GROQ_API_KEY`. Uses the OpenAI SDK against `LLM_BASE_URL` with `LLM_MODEL`; on error retries once with `LLM_FALLBACK_MODEL`.

Restart `npm run dev` after changing `.env`. `.env` is git-ignored; never commit it.

## API

- `POST /api/chat` `{ message }` → `{ reply, evidence: ToolResult[] }` (each evidence item also has `tool`)
- `GET /api/conversation` → persisted messages (single conversation)
- `DELETE /api/conversation` → clear
- `GET /api/health`

## Agent loop

messages + tool specs → model → for each tool call: parse JSON args, validate with zod, run (errors are returned to the model as `{error}`) → repeat, max 5 iterations, then a forced tool-less final answer. System prompt rules: no numbers not returned by a tool, cite sources, state assumptions, say "I don't have data" instead of guessing.

## Adding a real tool

Replace the stub in `server/src/tools/index.ts` (`handlers`); input schema lives in `shared/src/tools.ts`.

## Checks

```bash
npm run typecheck
```
