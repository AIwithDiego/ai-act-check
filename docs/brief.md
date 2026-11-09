# Brief: AI Act Check

**One line:** an API that AI agents pay per call to find out where an AI use case sits under the EU AI Act, and what that means for them.

**Event:** MPP Hackathon Dublin, Stripe office, Tue 10 Nov 2026, 13:00 to 14:30. Theme: build something AI agents can pay for, using Stripe's Machine Payments Protocol (MPP).

## The problem

Every team shipping AI in the EU has the same question: is this prohibited, high-risk, a transparency case, or fine? Today the answer is a consultant or a 400-page regulation. Agents are now writing and shipping the code, so the agent should be able to ask, at the moment it matters, and pay a few cents for a straight answer.

## What it does

1. The agent reads `GET /questions` (free): the short questionnaire.
2. It maps the use case it's working on to answers.
3. It calls `POST /classify`. The server answers HTTP 402 with the price (0.50 USD). The agent pays over MPP and retries.
4. It gets the tier, the matched articles, the obligations for its role (provider or deployer) and the dates they apply from, plus a receipt.

The classification is rule-based (`data/rules.json`, checked by Hank). Same answers, same verdict, every time; every line cites its article. Nothing about the use case is stored; the receipts log holds the tier and the amount only.

## Demo (3 cases, live, Claude Code as the paying agent)

| Use case (as a small business types it) | Expected |
|---|---|
| "We use an AI tool to shortlist CVs for our café chain" | **High-risk** (Annex III, employment), deployer obligations |
| "A chatbot answers customer questions on our website" | **Limited** (Art. 50: tell people they're talking to an AI) |
| "Software that reads our call-centre staff's emotions" | **Prohibited** (Art. 5(1)(f)) |

## Why it's interesting for this room

- An agent paying for compliance at the moment it writes the code, not a human paying for a report afterwards.
- Free discovery, paid verdict: the agent never pays for a request it can't use (bad input is rejected before the 402).
- Deterministic and cited: the thing you pay for is checkable.

## Out of scope tomorrow

Hosting, accounts, free-text classification with an LLM, other laws (GDPR, Chile's Ley 21.719 come later), any UI beyond the one status page.

## Stretch (only if everything above works)

The same check as a paid MCP tool (`mppx/mcp/server`), so Claude or ChatGPT can call it as a tool and pay inside the chat.
