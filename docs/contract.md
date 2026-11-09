# Contract

Fixed before the build. Every Devin session codes against this file. Changes happen before the first session starts, never during.

## 0. Stack

- TypeScript, Node 22+, ESM. `npm` only.
- HTTP: Hono + `@hono/node-server`, port `4242`.
- Payments: `mppx` + `stripe` (Stripe Machine Payments Protocol). Docs: https://docs.stripe.com/payments/machine/mpp.md?lang=node and https://mpp.dev/docs
- Tests: `vitest`. `npm test` runs everything, no network.
- Env (never committed; `.env.example` lists names only): `STRIPE_SECRET_KEY` (sandbox `sk_test_...`), `STRIPE_PROFILE_ID` (`profile_test_...`), `TEMPO_DEPOSIT_ADDRESS` (optional), `PRICE_USD` (default `0.50`).

## 1. Data files (written before the build, read-only for the build)

### `data/questions.json`

The questionnaire an agent answers about one AI use case.

```json
{
  "version": "2026-11-10",
  "questions": [
    {
      "id": "role",
      "text": "Are you the provider (you build or brand the AI system) or the deployer (you use it under your authority)?",
      "type": "enum",
      "options": ["provider", "deployer", "both"],
      "help": "Art. 3(3) provider, Art. 3(4) deployer.",
      "required": true
    },
    {
      "id": "emotion_recognition_workplace",
      "text": "Does the system infer emotions of people at work or in education?",
      "type": "boolean",
      "help": "Art. 5(1)(f).",
      "required": true
    }
  ]
}
```

- `type` is `boolean` or `enum`. `enum` has `options`.
- `required: true` means the engine cannot decide without it.
- Optional `ask_if`: a condition (same shape as rule conditions, section 1.2) that says when the question is relevant. A question whose `ask_if` is false is not required.

### `data/rules.json`

```json
{
  "version": "2026-11-10",
  "law": "Regulation (EU) 2024/1689 (AI Act)",
  "checked_by": "Hank, 2026-11-09",
  "disclaimer": "A first-pass classification from your answers, not legal advice.",
  "tier_order": ["prohibited", "high", "limited", "minimal"],
  "rules": [
    {
      "id": "art5-emotion-workplace",
      "tier": "prohibited",
      "title": "Emotion recognition at work or in education",
      "article": "Art. 5(1)(f)",
      "when": { "all": [ { "q": "emotion_recognition_workplace", "is": true } ] },
      "unless": { "any": [ { "q": "medical_or_safety_reason", "is": true } ] },
      "obligations": [
        { "role": "all", "text": "Do not place on the market or use.", "article": "Art. 5(1)(f)" }
      ],
      "applies_from": "2025-02-02",
      "note": "Exception for medical or safety reasons."
    }
  ]
}
```

#### 1.2 Conditions

- A condition is `{ "all": [clause...] }`, `{ "any": [clause...] }`, or both keys (both must hold).
- A clause is `{ "q": "<question id>", "is": <value> }` or `{ "q": "<question id>", "in": [<values>] }`. A clause may also be a nested condition.
- A clause on an unanswered question is false.
- `unless` is optional. A rule matches when `when` holds and `unless` does not.

#### 1.3 Obligations

- `role` is `provider`, `deployer` or `all`. The engine returns obligations for the caller's `role` (`both` gets everything).
- `stacks` (optional, boolean, default false) on a rule: its obligations are added even when a more severe tier wins (e.g. Art. 50 transparency on top of high-risk, GPAI obligations on top of anything).
- A rule can have tier `gpai`. GPAI is not on the tier ladder: it never sets the tier, it always stacks.

## 2. Engine (`src/engine.ts`)

```ts
export type Answers = Record<string, boolean | string>;
export interface Verdict {
  tier: "prohibited" | "high" | "limited" | "minimal" | "incomplete";
  matched: { id: string; tier: string; title: string; article: string; note?: string }[];
  obligations: { text: string; article: string; role: string; applies_from: string }[];
  missing: string[];          // required question ids not answered (after ask_if)
  invalid: string[];          // answered ids that are unknown or have a wrong type/option
  rules_version: string;
  disclaimer: string;
}
export function classify(answers: Answers, rules?: Rules, questions?: Questions): Verdict;
```

- Pure function, no I/O beyond loading the two JSON files at import.
- `missing` non-empty → `tier: "incomplete"`, no obligations.
- Tier = most severe matched tier by `tier_order`; nothing matched → `minimal`.
- Obligations: from all matched rules of the winning tier, plus every matched rule with `stacks: true`, filtered by role, de-duplicated by `text`, ordered by `applies_from`.

## 3. HTTP API (`src/server.ts`)

| Route | Paid | Returns |
|---|---|---|
| `GET /` | no | Small HTML page: what it is, price, last 10 paid calls (from `out/receipts.jsonl`, no request bodies). |
| `GET /health` | no | `{ "ok": true, "rules_version": "..." }` |
| `GET /questions` | no | `data/questions.json` as is |
| `GET /llms.txt` | no | Plain text: how an agent uses this API (free questions first, then paid classify) |
| `POST /classify` | **yes, `PRICE_USD` per call** | `Verdict` JSON + MPP receipt |

`POST /classify` body:

```json
{ "use_case": "free text, optional, max 1000 chars, echoed back, never stored", "answers": { "role": "deployer", "...": true } }
```

- No payment → HTTP 402 challenge from `mppx.charge(...)`.
- Body is checked **before** the 402: malformed JSON or `invalid` answers → HTTP 400 with the list, so an agent never pays for a request that can't be answered. `incomplete` is not checked before payment (the agent may want the list of what's missing); it returns 200 with `tier: "incomplete"`.
- After a paid call, append one line to `out/receipts.jsonl`: `{ at, tier, rules_version, amount, receipt_id }`. No answers, no use case text.

## 4. Demo cases (`fixtures/cases.json`)

```json
[
  { "id": "cv-screening", "use_case": "...", "answers": { }, "expect": { "tier": "high", "matched": ["annex3-employment"] } }
]
```

`npm test` runs every case through `classify` and checks `tier` and that every id in `expect.matched` is matched.
