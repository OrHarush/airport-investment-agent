# E2E results (Groq, gpt-oss-120b)

Final run: 2026-11-10 to 2026-11-11. Provider `LLM_PROVIDER=groq`, model `openai/gpt-oss-120b`. Driver: `server/scripts/e2e.mts`. It posts each question to `POST /api/chat` (the endpoint the UI uses) on a Groq-backed server, then reads tool calls and evidence back from the response. The four questions are single-turn, each in a new conversation. The free tier's token limits meant the final four passes were run in separate batches against the final prompt (`server/src/agent/systemPrompt.ts`); the answers below are those runs.

## Result

| # | Question | Tool | Result |
|---|---|---|---|
| Q1 | Rank the New England airports for terminal-expansion investment. | rankAirports | **PASS** |
| Q2 | Compare LAX vs SNA on congestion. | compareAirports | **PASS** |
| Q3 | How much of ANC's traffic is long-haul? | getRouteMix | **PASS** |
| Q4 | Where is the unmet demand at SFO? | getUnmetDemand | **PASS** |

## What is checked
For every answer the runner checks:
- **(a) Numbers are grounded:** every number in the answer appears in a tool result or tool argument. The script extracts numbers and tolerates 1 to 2 dp rounding and %, k and M suffixes.
- **(b) No invented methodology:** no methodology term or weight outside the tool's methodology, normalization, weights and window fields.
- **(c) Caveats present.**
- **Expected values:** the figures a correct answer must contain are all present (for example Q1: BOS 71.9, BTV 70.8, 398,907 and 14,587 unmet seats). These come from the deterministic code, not from the model.
- **Tool use:** the required tool was called with no tool error.
- **Style:** no flag codes, tool or field names; no table for fewer than 3 airports; no dashes, `---` separators or dangling punctuation in prose; Q1 ends with a verdict sentence that names the leader and its drivers.

## Q1: Rank the New England airports for terminal-expansion investment.

**Tools called:**
- `rankAirports({"region":"New England"})`

**Final answer:**

> The most pressured New England airports, by score, are BOS 71.9, BTV 70.8, PWM 61.4, BDL 54.6, PVD 47.6 and MHT 33.9.  
> By absolute unmet‑seat opportunity the order is BOS 398,907 unmet seats (20,964,773 12‑month passengers), BDL 48,986 unmet seats (3,216,571 12‑month passengers), PWM 24,452 unmet seats (1,277,986 12‑month passengers), PVD 17,210 unmet seats (2,084,833 12‑month passengers), BTV 14,587 unmet seats (703,880 12‑month passengers) and MHT 5,661 unmet seats (675,010 12‑month passengers).  
> The two views disagree: BTV jumps from second in the pressure score to fifth in absolute opportunity.  
> Score is a min‑max relative score across all 16 airports.  
> No airport reaches the 0.85 load‑factor threshold (highest BTV 0.818).  
> Partial‑2026 data and limited delay‑coverage for some airports modestly affect the conclusions.  
>
> The strongest candidate is BOS, driven by high utilization (score 92.3, raw 0.813), large scale (score 86.8) and notable congestion (score 73.9).

**Checks:** PASS
- (a) ungrounded numbers: none (31 numbers checked)
- (b) methodology issues: none
- (c) missing caveats: none
- expected values missing: none
- style issues: none

## Q2: Compare LAX vs SNA on congestion.

**Tools called:**
- `compareAirports({"a":"LAX","b":"SNA"})`

**Final answer:**

> LAX is more congested than SNA on most measured metrics. For the 12‑month window 2025‑07 to 2026‑06, LAX’s NAS‑attributed delay rate is 9.41 % on departures and 9.26 % on arrivals, versus 8.92 % and 8.15 % for SNA; the share of flights delayed 15 minutes or more is 19.96 % on departures and 19.84 % on arrivals at LAX, compared with 19.98 % on departures and 18.51 % on arrivals at SNA (the departure‑delay shares are essentially equal); and LAX handles 63,607 departures per open runway versus 25,489 at SNA. The two airports have similar departure‑delay‑over‑15‑minute shares, but LAX exceeds SNA on NAS delay rates and runway‑based departure volume, indicating higher overall congestion. Note that the LAX delay figures cover only about 75 % of its flights and 2026 data are partial‑year, which may affect the comparison.

**Checks:** PASS
- (a) ungrounded numbers: none (14 numbers checked)
- (b) methodology issues: none
- (c) missing caveats: none
- expected values missing: none
- style issues: none

## Q3: How much of ANC's traffic is long-haul?

**Tools called:**
- `getRouteMix({"topN":10,"airport":"ANC","cutoffMi":3000})`

**Final answer:**

> ANC’s long‑haul share depends on the distance cutoff.  
>
> - At 1,500 mi, 17.69 % of passenger departures and 49.26 % of all departures (including cargo) are long‑haul.  
> - At 2,500 mi, the shares fall to 9.8 % (passenger‑only) and 43.27 % (including cargo).  
> - At the default 3,000 mi cutoff, only 2.82 % of passenger departures and 31.12 % of all departures are long‑haul.  
>
> Cargo flights make up 56.53 % of ANC’s total departures, so including cargo raises the long‑haul proportion markedly.  
>
> A cargo‑heavy traffic mix influences these figures.

**Checks:** PASS
- (a) ungrounded numbers: none (10 numbers checked)
- (b) methodology issues: none
- (c) missing caveats: none
- expected values missing: none
- style issues: none

## Q4: Where is the unmet demand at SFO?

**Tools called:**
- `getUnmetDemand({"topN":10,"airport":"SFO"})`

**Final answer:**

> SFO’s unmet‑demand proxy shows 556,759 unmet seats across route‑months in the 2025‑07 to 2026‑06 window, while the annual airport‑level figure is zero because the overall load factor of 0.8227 is below the 0.85 threshold.  
>
> Top routes by unmet seats are: EWR: 54,372 unmet seats, peak 2025‑08, load factor 0.9509; JFK: 49,419 unmet seats, peak 2026‑06, load factor 0.9476; ORD: 34,459 unmet seats, peak 2025‑08, load factor 0.9426; HNL: 30,766 unmet seats, peak 2025‑07, load factor 0.9659; DFW: 27,499 unmet seats, peak 2025‑08, load factor 0.9306; HKG: 21,466 unmet seats, peak 2026‑03, load factor 0.9745.  
>
> Peak months are: 2026‑06: 126,730 unmet seats, top route JFK; 2025‑07: 81,448 unmet seats, top route HNL; 2025‑08: 78,936 unmet seats, top route ORD.  
>
> The unmet‑demand numbers are a proxy for demand above an 85 % load‑factor comfort level, not observed turned‑away passengers, and the airport‑level unmet figure is zero because the load factor (0.8227) does not exceed the threshold.  
>
> Flags note that the estimate is inferred and that 2026 data are only partial‑year, which limits precision.

**Checks:** PASS
- (a) ungrounded numbers: none (20 numbers checked)
- (b) methodology issues: none
- (c) missing caveats: none
- expected values missing: none
- style issues: none

## What the checks can and cannot show
- **The number check is lexical.** It proves a number exists somewhere in the tool output, not that it is attached to the right airport or metric. The expected-value patterns catch this for the headline figures, and each answer was also read against the tool output by hand. Answers to new questions can still contain small slips, such as a wrong rank count or list order, even when every number is real.
- **The E2E drives the API, not the browser.** It calls the same endpoint as the UI. The UI was exercised by hand with the example questions and follow-ups.
- **Q2 headline.** The model says LAX is more congested on most measures. The answer states that the departure delayed-15+ shares are essentially equal (19.96% vs 19.98%), so the headline is hedged correctly.
- **Free-tier pacing.** Groq's free tier allows 8,000 tokens per minute per request and 200,000 per day per organization. The runner waits 10 s between questions and retries once after a rate-limit failure. See the README "Known limits" section for what this means for users.

## Changes made while building the E2E
Prompt (`server/src/agent/systemPrompt.ts`):
- **Completeness:** Q3 now needs all three cutoff bands (passenger-only and with cargo) plus the cargo share; Q4 needs the top 6 routes and the 3 peak months; Q2 follows a congestion template (NAS delay rate, delayed-15+ share, departures per open runway); every ranking answer states the highest load factor against 0.85.
- **Q1 structure:** an explicit "The two views disagree:" sentence, and a closing verdict sentence naming the strongest candidate and its component drivers.
- **Style:** tables only for 3 or more airports; no flag codes, field names or function names; ASCII digits with comma thousands separators; no dashes or dangling punctuation; lists as "label: value"; dates as YYYY-MM.
- **Scope:** the 16 airports and data sources are listed in the prompt, so "which airports do you have data for" is answered without a tool call.

Tools and infrastructure:
- `getRouteMix`'s schema (`cutoffMi: positive()`) was emitted with boolean `exclusiveMinimum`, which Groq rejects as invalid JSON Schema. Fixed by using `target: "jsonSchema7"` in `server/src/tools/index.ts`.
- `rankAirports` now treats an empty `airports` array as all 16 (Groq rejected the model's empty-array call against `minItems: 1`).
- The unused fallback model (`llama-3.3-70b-versatile`, which does not exist for this Groq key and only masked the real error) was removed. A Groq error is shown to the user in plain language.
- Provider failures are classified on the server (rate limit, too large, auth, model, unavailable) and returned without codes or raw provider text.

## Compact tool payloads
The model receives `compactForModel(...)` output (`server/src/tools/compact.ts`); the UI still gets the full result. Tokens sent to the model (estimated as chars/4):

| Tool | Full result | To the model |
|---|---|---|
| rankAirports (16 airports) | 7,400 | 1,986 |
| rankAirports (New England) | 3,474 | 1,328 |
| getUnmetDemand | 3,487 | 1,708 |
| compareAirports | 1,787 | 1,207 |
| getAirportProfile | 1,698 | 1,235 |
| getRouteMix | 1,555 | 777 |
