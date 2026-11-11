# Handoff — Airport Investment Agent (updated 2026-11-10 23:10 Israel time)

Repo: AirportRanking. Put this file at docs/handoff.md. It supersedes claude/decisions.md wherever they differ.

## Exam requirements (FDE Exam 2, Deloitte Digital, 24h)
Build an AI agent that helps analysts find US airports where renovation/expansion is most profitable, based on increased flight and passenger capacity.
Must answer:
- Which airports in New England are strong candidates for terminal expansion?
- Compare LA and Santa Ana airport congestion levels.
- What is the percentage of long-haul flights out of Anchorage?
- What is the unmet flight demand at SFO and why?
The agent must: use public APIs/data for aviation data; rank or compare airports with defined logic/KPIs; explain reasoning clearly; support conversational follow-ups.
Requirements: deterministic scoring/ranking logic (not only LLM output); chat interface (voice is a bonus); clearly communicate assumptions, uncertainty and scoping.
Deliverables: source code + SHORT design/architecture doc covering scoring methodology, key tradeoffs, where/how AI is used. Prioritize clarity, reasoning and thoughtful design over completeness or polish.

## Status
Complete. Data download, ETL, DB + 6 tools, scoring, live status, UI (multi-chat, resizable evidence panel, evidence cards, usage gauge), agent system prompt, plain-language error handling, design doc and README. E2E: all 4 questions pass on Groq (docs/e2e-results.md). Tests: 86 pass, typecheck clean. Fresh-clone test passed. Everything is committed and pushed.

## Key decisions
- Scoring: min-max normalization (default; percentile kept as config option), scale = ln(pax12m), always against all 16 airports; region filters only choose which rows are displayed (rankInScope + rankOverall). Weights 30/25/20/15/10.
  - Why: percentile turned a 0.813 vs 0.818 load-factor gap into 40 vs 100.
- Growth = 50/50 blend of recovery (pax 12m ÷ 2019) and TAF enplanement CAGR FY2025→2030.
- Scoring window 2025-07..2026-06. 2026 flagged partial.
- Congestion = arrivals' NAS-delay share; null for scoring if On-Time coverage <50% (only FAI; ANC is at 50.2%).
- Fare benchmark = 16-airport median (explanation only, not ranking). High fares at BTV/FAI reflect remoteness.
- Unmet demand = sum over route-months (2025-07..2026-06) of seats × max(0, LF − 0.85), ignoring route-months with <10 departures. Annual airport-level figure kept as secondary. It measures pax above an 85% comfort threshold, not observed turned-away demand.
- Long-haul cutoff is a parameter, default 3000 mi; always show 1500/2500/3000 bands, passenger-only and with cargo.
- Flags are structured {code, severity, message, detail?, airport?} and deduplicated.
- Agent answers ranking questions with two views: "most pressured" (score) vs "biggest absolute opportunity" (unmetSeats, pax12m).
- LLM never computes numbers. Numbers only from tool results; methodology only from the tool's methodology field. E2E runner checks every number in an answer appears in a tool result (lexical check: proves existence, not correct attribution).
- Data: bulk public datasets (BTS T-100 / On-Time, FAA TAF) loaded via ETL into Postgres, plus the live FAA NAS status API. Bulk data = reproducible, offline-capable demo; live API only covers current state.
- LLM: Groq (free tier, 8,000 tokens/min cap) or Mock provider (LLM_PROVIDER=mock|groq). Tool results are compacted before going to the model (rankAirports ~7.4k → ~2k tokens); UI still gets full results.

## Key numbers (verify against code / docs/e2e-results.md before using)
- New England (min-max): BOS 71.9, BTV 70.8, PWM 61.4, BDL 54.6, PVD 47.6, MHT 33.9. Percentile had BTV 77.1 > BOS 68.4. BOS unmetSeats 398,907 vs BTV 14,587. No NE airport reaches LF 0.85 annually (~0.81).
- LAX vs SNA: NAS arrival delay rate 9.3% (9.26) vs 8.2% (8.15); ~20% delayed 15+ at both; LAX 63.6k vs SNA 25.5k departures per open runway.
- ANC long-haul (2025): passenger-only 17.7% ≥1500, 9.8% ≥2500, 2.8% ≥3000; with cargo 49.3 / 43.3 / 31.1%. Freighters are 56.5% of departures.
- SFO unmet demand: 556,759 seats (route-month); annual figure 0 (LF 0.823). Top routes EWR, JFK, ORD, HNL, DFW, HKG; peak months 2026-06, 2025-07, 2025-08. Fares 1.17× peer median; highest NAS delay rate among eligible airports; pax 4.7% below 2019 (OAK/SJC ~−37%).

## Known limits (for the design doc)
- Unmet demand is a proxy (85% LF threshold), not observed turned-away demand.
- 2026 data is partial. Peer set is small (16). Remote-airport fares are high (BTV/FAI).
- Number-grounding check is lexical.
- Groq free tier: 8k tokens/min per request and 200k tokens/day per organization (not per key). Mitigated by compact tool payloads and a history cap (last 8 messages, 8,000 chars). Multi-airport questions and long chats can still fail with a plain-language message. Decision: stay on the free tier, document the limits, do not add paid dependencies. See README "Known limits".
- The usage gauge shows a snapshot of the last answer's per-minute rate limit (it assumes the window refills fully once the reset time passes), kept in the browser so it survives a refresh. It does not show the daily limit, which Groq reports only in error messages.
- Prisma generate EPERM on Windows: stop the dev server, rerun `npx prisma generate`.
