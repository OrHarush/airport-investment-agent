# Airport Investment Intelligence Agent

A chat agent that helps analysts screen 16 US airports for terminal-expansion investment. An LLM chooses tools and explains results; all scores and numbers come from deterministic code over public BTS and FAA data, shown as evidence cards next to the chat.

Design, scoring method, tradeoffs and limits: [docs/design.md](docs/design.md). Test results on the four example questions: [docs/e2e-results.md](docs/e2e-results.md). Decisions and status: [docs/handoff.md](docs/handoff.md).

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

`data/clean/` (about 47 MB of CSV) is committed, so `npm run seed` works from a fresh clone. `python etl/clean/run_clean.py` rebuilds it from the public sources in `data/raw/` (git-ignored, about 340 MB; see [docs/data-sources.md](docs/data-sources.md)).

Edit `.env`:
- `LLM_PROVIDER=mock` (default, no key; canned tool call and answer) or `LLM_PROVIDER=groq`
- `GROQ_API_KEY=...` (only for `groq`)
- `LLM_MODEL` defaults to `openai/gpt-oss-120b`

`.env` is git-ignored. Restart the dev server after changing it.

## Run
```bash
npm run dev
```
Server on http://localhost:3001, UI on http://localhost:5173 (Vite picks the next free port if 5173 is taken).

`PORT` in `.env` sets the server port and the UI proxy follows it. Changing the Postgres host port means editing both `docker-compose.yml` and the port in `DATABASE_URL`.

Smoke test the API (mock provider returns a canned answer plus real tool evidence):
```bash
curl -X POST localhost:3001/api/chat -H "content-type: application/json" -d '{"message":"Rank the New England airports for terminal-expansion investment."}'
```

## Example questions
1. Rank the New England airports for terminal-expansion investment.
2. Compare LAX vs SNA on congestion.
3. How much of ANC's traffic is long-haul?
4. Where is the unmet demand at SFO?

Follow-ups work in the same chat (for example "why is BTV above BDL?").

## Tests and checks
```bash
npm test -w server        # 86 tests (scoring, tools, LLM providers); needs the seeded Postgres from Setup
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
| `data/` | `raw/` downloads (git-ignored) and `clean/` CSVs (committed) loaded by the seed |
| `docs/` | Design doc, data sources, data profile, E2E results |

## Known limits
**The free LLM tier is the main constraint.** The project runs on Groq's free tier (`openai/gpt-oss-120b`) on purpose, so anyone can run it without paying. That tier is very small:
- **8,000 tokens per minute, per request.** One answer costs about 5,000 to 10,000 tokens (system prompt about 2,500, tool results 1,000 to 2,000 each, plus chat history).
- **200,000 tokens per day, per Groq organization** (not per key, so a second key on the same account shares it). That is roughly 20 to 40 answers a day. The usage gauge shows only the per-minute budget, not the daily one.

What this means in practice:
- **Works (checked by the E2E run):** the four example questions, and short follow-ups about the same data ("show only California", "why is X above Y?").
- **Can fail:** questions that need data on many airports in several tool calls (for example "which California airport has the highest fares"), and long chats. You get a plain message ("usage limit, try again at ...", or "this chat has grown too long, start a new chat") instead of an answer.
- **Workarounds:** start a new chat for each topic, ask about fewer airports, or wait for the limit to reset.
- **Mitigations already in place:** tool results are compacted before they go to the model (the 16-airport ranking drops from about 7,400 to about 2,000 tokens; the UI still gets the full result), and only the last 8 messages (about 8,000 characters, older answers shortened) are sent as history.
- **Reviewers:** please use your own free Groq key. A shared key runs out of daily tokens quickly.
- **Lifting it:** a paid tier, or another OpenAI-compatible endpoint with tool calling (set `LLM_BASE_URL` and `LLM_MODEL`, not tested), removes these limits. Scoring and tools do not depend on the model.

Data limits: unmet demand is a load-factor proxy (85% threshold), not observed turned-away demand, and 2026 data is partial. See [docs/design.md](docs/design.md) section 7.

## Windows notes
- `prisma generate` can fail with `EPERM` while the dev server holds the Prisma engine file. Stop `npm run dev`, rerun `npm run db:generate -w server`, then start the server again.
- Docker Desktop must be running before `npm run db:up`.
