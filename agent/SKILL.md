---
name: ai-act-check
description: Use when the user is building or deploying an AI feature for people in the EU and wants to know its EU AI Act risk tier (prohibited, high, limited, minimal) and the GDPR duties that come with it. Calls the paid AI Act Check API (0.60 USD per check over Stripe MPP), shows the verdict and saves a compliance record in the project.
---

# AI Act Check

Rule-based EU AI Act + GDPR classification of one AI use case. Discovery is free, the verdict is paid per call over Stripe's Machine Payments Protocol (MPP), with a Stripe test card (sandbox).

Base URL: `$AI_ACT_CHECK_URL`, default `http://localhost:4242`. Each command below expands it inline (`${AI_ACT_CHECK_URL:-http://localhost:4242}`), because shell variables don't carry over between separate Bash calls.

## 1. Get the questions (free)

```bash
curl -s "${AI_ACT_CHECK_URL:-http://localhost:4242}/questions"
```

Each question has an `id`, a `type` (`boolean` or `enum` with `options`), `required`, `help` (the article it maps to) and maybe `ask_if` (only relevant when that condition holds).

## 2. Map the use case to answers

- Answer every required question whose `ask_if` holds (or has no `ask_if`). Booleans are `true`/`false`; enums use one of the listed `options` exactly.
- Infer from what the user told you and from the code you are working on. The business is the `deployer` unless it builds the AI system or offers it under its own name (`provider`); both → `both`. Using a model API (Claude, GPT, Gemini) is `gpai_model: "no"`.
- Ask the user only for what you cannot infer, in one short batch. Don't ask about prohibited practices that plainly don't apply.
- State your main assumptions to the user in one line before paying.

## 3. Classify and pay

```bash
npx mppx@0.17.1 "${AI_ACT_CHECK_URL:-http://localhost:4242}/classify" -i -J '{"use_case":"<a few words>","answers":{...}}' --currency usd -M paymentMethod=pm_card_visa
```

`mppx` sends the request, gets the HTTP 402 challenge, pays with Stripe's test Visa through a Shared Payment Token and retries. It needs `MPPX_STRIPE_SECRET_KEY` (a Stripe sandbox key) in the environment; never print it. The payment shows in the Stripe dashboard and the receipt reference is a `pi_...` id. `-i` prints the headers, so you can read the 402 price and the `Payment-Receipt` header of the final 200.

No Stripe key in the environment: pay on Tempo testnet instead, with `-a demo-agent --network testnet` in place of the two card flags.

- **400**: the body lists `invalid` answer ids. Nothing was paid. Fix those answers and run again.
- **200**: the body is the verdict: `tier`, `role`, `matched` (id, title, article, note), `obligations` (law, text, article, role, applies_from), `gdpr_short`, `missing`, `rules_version`, `disclaimer`.
- `tier: "incomplete"`: `missing` lists required questions you skipped. Tell the user, get the answers, and only re-run (another paid check) if they agree.
- Receipt: `Payment-Receipt` is base64url JSON; its `reference` is the receipt id. The amount is the price in the 402 challenge (0.60 USD unless the server says otherwise).
- If `mppx` fails to pay (card declined, wallet empty, network down), stop and tell the user. Do not invent a verdict.

## 4. Show the user

In this order, short:

1. The tier in words: Prohibited, High-risk, Limited (transparency), Minimal, or Incomplete.
2. Why: the matched rules with their articles.
3. What they must do: the obligations returned (already filtered to their role), AI Act first, then GDPR, each with its article and the date it applies from. Say plainly which dates are in the future.
4. Anything in `missing`.
5. The disclaimer, word for word.

## 5. Save the record

After a paid verdict (200), write `compliance/ai-act-<short-slug>.md` in the user's project:

- `<short-slug>`: 2 to 4 lowercase words from the use case, hyphenated (e.g. `cv-screening`).
- Create `compliance/` if it doesn't exist. Never overwrite: if the file exists, use `-2`, `-3`, and so on (`ls compliance/` first).
- Markdown only. Nothing the user wasn't shown. No dump of the answers or the request body.

Contents, in this order (see `example-record.md` next to this file):

```markdown
# AI Act check: <use case in a few words>

Date: <YYYY-MM-DD>

Tier: <tier in words>

## Matched rules
- <title> (<article>)

## What you must do
### AI Act
- <text> (<article>, applies from <applies_from>)
### GDPR
- <text> (<article>, applies from <applies_from>)

## Missing
- <question id>: <question text>   (or "None.")

## Receipt
Receipt: <reference> · Amount: <price> · Rules version: <rules_version>

---
<disclaimer>
```

List every obligation in the verdict, none dropped or reworded. Omit a law's heading if it has no obligations.

## Rules

- Never pay twice for the same answers. Never skip the disclaimer.
- Only these routes exist: `GET /`, `/health`, `/questions`, `/llms.txt`, `/openapi.json`, `/live`, `/live/feed`, `/public/*`, and paid `POST /classify`.
- The verdict is a first pass from the answers given, not legal advice. Wrong answers give a wrong tier.
