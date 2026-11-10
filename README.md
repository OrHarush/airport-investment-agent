# Airport Investment Intelligence Agent

A chat agent that helps analysts screen 16 US airports for terminal-expansion investment. An LLM chooses tools and explains results; all scores and numbers come from deterministic code over public BTS and FAA data, shown as evidence cards next to the chat.

Design, scoring method, tradeoffs and limits: [docs/design.md](docs/design.md). Test results on the four example questions: [docs/e2e-results.md](docs/e2e-results.md).

## Prerequisites
- Node 20+
- Docker Desktop (running), for Postgres on host port 5433
- Optional: a [Groq](https://console.groq.com) API key. Without one, use the mock provider.

## Setup
```bash
npm install
cp .env.example .env              # PowerShell: Copy-Item .env.example .env
npm run db:up                     # start Postgres
npm run db:generate -w server     # prisma generate
npm run db:migrate                # create tables
npm run seed                      # load data/clean/*.csv into Postgres
```

Edit `.env`:
- `LLM_PROVIDER=mock` (default, no key; canned tool call and answer) or `LLM_PROVIDER=groq`
- `GROQ_API_KEY=...` (only for `groq`)
- `LLM_MODEL` defaults to `openai/gpt-oss-120b`

`.env` is git-ignored. Restart the dev server after changing it.

## Run
```bash
npm run dev
```
Server on http://localhost:3001, UI on http://localhost:5173.

## Example questions
1. Rank the New England airports for terminal-expansion investment.
2. Compare LAX vs SNA on congestion.
3. How much of ANC's traffic is long-haul?
4. Where is the unmet demand at SFO?

Follow-ups work in the same chat (for example "why is BTV above BDL?").

## Tests and checks
```bash
npm test -w server        # 78 unit tests (scoring, tools, LLM providers)
npm run typecheck         # shared, server and client
```
E2E against a live Groq-backed server (server running with `LLM_PROVIDER=groq`):
```bash
cd server && npx tsx scripts/e2e.mts
```

## Repo map
| Folder | Purpose |
|---|---|
| `client/` | Vite + React + MUI chat UI with evidence cards |
| `server/` | Express API, agent loop, LLM providers, tools, scoring, Prisma, seed |
| `shared/` | Tool contract types and zod input schemas |
| `etl/` | Python data profiling and cleaning (`data/raw` to `data/clean`) |
| `data/` | `raw/` downloads (git-ignored) and `clean/` CSVs loaded by the seed |
| `docs/` | Design doc, data sources, data profile, E2E results |

## Known limits
- Groq free tier allows 8,000 tokens/min. Tool results are compacted for the model, but back-to-back large questions can still return a 413.
- Unmet demand is a load-factor proxy (85% threshold), not observed turned-away demand. 2026 data is partial. See [docs/design.md](docs/design.md) section 7.

## Windows notes
- `prisma generate` can fail with `EPERM` while the dev server holds the Prisma engine file. Stop `npm run dev`, rerun `npm run db:generate -w server`, then start the server again.
- Docker Desktop must be running before `npm run db:up`.
