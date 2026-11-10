# AI Act Check

A pay-per-call API that tells an AI agent where an AI use case sits under the EU AI Act: the tier, the articles, the obligations for its role and the dates they apply from, plus the GDPR duties that come with it.
The agent reads a short questionnaire for free, answers it, and pays 0.60 USD per verdict over Stripe's Machine Payments Protocol (MPP).
The classification is rule-based (`data/rules.json`), with no LLM: same answers, same verdict, every line cited. Nothing about the use case is stored.

## How an agent pays

1. The agent calls `POST /classify` with its answers and no payment.
2. The server checks the body (bad input → 400, nothing to pay), then answers HTTP 402 with an MPP challenge: 0.60 USD.
3. The agent's wallet pays the challenge on Tempo testnet and retries the same request with the payment credential.
4. The server verifies the payment and returns the verdict with a `Payment-Receipt` header.

```text
Agent                                  AI Act Check                 Tempo testnet
  | GET /questions  (free)                  |                            |
  |---------------------------------------->|                            |
  | POST /classify  {use_case, answers}     |                            |
  |---------------------------------------->|                            |
  |<-------- 402 Payment Required (0.60) ---|                            |
  | pay the challenge ------------------------------------------------->|
  | POST /classify  + payment credential    |                            |
  |---------------------------------------->|                            |
  |<-------- 200 verdict + Payment-Receipt -|                            |
```

With the `mppx` CLI, steps 1 to 4 are one command:

```bash
npx mppx@0.17.1 http://localhost:4242/classify -J "$(cat demo/requests/cv-screening.json)" -a demo-agent --network testnet
```

For Claude Code, install `agent/SKILL.md` as a skill (`.claude/skills/ai-act-check/SKILL.md`). It fetches the questions, maps the use case to answers, pays, shows the verdict and saves a record in `compliance/` (example: `agent/example-record.md`).

## API

| Route | Paid | Returns |
|---|---|---|
| `GET /` | no | Small HTML page: what it is, price, last 10 paid calls (from `out/receipts.jsonl`, no request bodies). |
| `GET /health` | no | `{ "ok": true, "rules_version": "..." }` |
| `GET /questions` | no | `data/questions.json` as is |
| `GET /llms.txt` | no | Plain text: how an agent uses this API (free questions first, then paid classify) |
| `GET /openapi.json` | no | OpenAPI 3.1 for every route here. `POST /classify` carries `x-payment-info` (price, currency, protocol `mpp`). |
| `POST /classify` | **yes, `PRICE_USD` per call** (default 0.60) | `Verdict` JSON + MPP receipt |
| `GET /live` | no | The live screen for the room |
| `GET /live/feed` | no | `{ "checks": LiveCheck[] }`, newest first, max 20 |
| `GET /public/*` | no | Static files from `public/` |

`POST /classify` body: `{ "use_case": "free text, optional, max 1000 chars", "answers": { "role": "deployer", ... } }`. Malformed JSON or invalid answers → 400 before any payment. Unanswered required questions → 200 with `tier: "incomplete"` and the list in `missing`. Full spec: `docs/contract.md`.

## Example response

The `callcentre-emotion` case from `fixtures/cases.json` (body in `demo/requests/callcentre-emotion.json`): "Our call centre wants software that listens to our agents' calls and flags when they sound stressed, frustrated or bored, so team leads can coach them and track mood scores." Role `deployer`, emotion recognition at work, no medical or safety reason.

```json
{
  "role": "deployer",
  "missing": [],
  "invalid": [],
  "rules_version": "2026-11-10",
  "disclaimer": "A first-pass classification from your answers, not legal advice.",
  "tier": "prohibited",
  "matched": [
    {
      "id": "art5-emotion-workplace",
      "tier": "prohibited",
      "title": "Emotion recognition at work or in education",
      "article": "Art. 5(1)(f)",
      "note": "Exception for medical or safety reasons only."
    },
    {
      "id": "annex3-biometrics",
      "tier": "high",
      "title": "Biometrics (remote identification, categorisation, emotion recognition)",
      "article": "Art. 6(2), Annex III point 1",
      "note": "Annex III high-risk obligations apply from 2 Dec 2027 (moved from 2 Aug 2026 by Reg. (EU) 2026/1744, fixed date). Conservative: any emotion inference from biometric data is treated as Annex III 1(c). Biometrics often needs a notified body (Art. 43(1))."
    },
    {
      "id": "art4-ai-literacy",
      "tier": "minimal",
      "title": "AI literacy",
      "article": "Art. 4",
      "note": "Applies to every provider and deployer. Wording softened by Reg. (EU) 2026/1744; no specific literacy level is required."
    }
  ],
  "obligations": [
    {
      "law": "AI Act",
      "text": "Do not sell, deploy or use this in the EU.",
      "article": "Art. 5",
      "role": "all",
      "applies_from": "2025-02-02",
      "key": true
    },
    {
      "law": "AI Act",
      "text": "Train staff who run or use the AI, and keep a record.",
      "article": "Art. 4",
      "role": "all",
      "applies_from": "2025-02-02",
      "key": true
    }
  ],
  "gdpr_short": []
}
```

Why: `art5-emotion-workplace` matches (`emotion_recognition_workplace` is true and `emotion_medical_or_safety` is false), so the tier is `prohibited`. `annex3-biometrics` also matches but doesn't stack, so its duties are dropped; `art4-ai-literacy` stacks and stays. The `art50-` disclosure and all `gdpr-` rules carry an `unless` for prohibited uses, so they don't match: there is nothing to make compliant. The receipt comes in the `Payment-Receipt` response header.

## Run

```bash
npm install
cp .env.example .env        # fill in the Stripe sandbox values; never commit .env
npm run dev                 # http://localhost:4242
npx mppx@0.17.1 validate http://localhost:4242
```

`npm test` runs the engine against every case in `fixtures/cases.json`, with no network.

## Demo

- Live demo script, three cases with fallbacks: `demo/run-sheet.md`
- How it works, with diagrams: `docs/how-it-works.html`
- Demo console: `node console/server.mjs`, then http://localhost:4343 (see `console/README.md`)

## Disclaimer

A first-pass classification from your answers, not legal advice. The verdict is only as good as the answers given. Anything relying on the Art. 6(3) exception, or involving law-enforcement biometrics, needs a lawyer.

Built at the MPP Hackathon Dublin, 10 Nov 2026, with Devin.
