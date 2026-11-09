# 02 · Paid server

Paste everything below the line into a Devin session. Runs **at the same time** as 01.

---

You are building the paid HTTP server for **AI Act Check** in the repo `AIwithDiego/ai-act-check`.

**Read first, in this order:** `docs/brief.md`, `docs/contract.md` (sections 0 and 3 are yours), then Stripe's MPP guide https://docs.stripe.com/payments/machine/mpp.md?lang=node and https://mpp.dev/docs (server quickstart). Do not start coding until you have read them.

**Your job:** a Hono server on port 4242 that serves the free routes and charges `PRICE_USD` (default 0.50) per `POST /classify` over MPP, using `mppx` with Stripe.

**Session 04 is building `src/live.ts` in parallel.** Until it lands, create `src/live-stub.ts` exporting `recordCheck` (no-op) and an empty Hono `live`, imported through one line in `src/server.ts`, and mount it with `app.route('/', live)` as contract 3.1 says.

**Session 01 is building `src/engine.ts` in parallel.** Until it lands, create `src/engine-stub.ts` that exports `classify` and `validate` with the signatures in contract section 2 and returns a fixed `minimal` verdict. Import the engine through one line in `src/server.ts` so switching to the real one is a one-line change.

**You own these files (create or edit only these):**
- `src/server.ts` (the app: routes, MPP, receipts log; export `app` for tests and start listening only when run directly)
- `src/payments.ts` (all `mppx` / Stripe setup in one place)
- `src/engine-stub.ts`
- `src/live-stub.ts`
- `tests/server.test.ts`
- `.env.example` (names only, from contract section 0)
- `.gitignore` (add `node_modules/`, `out/`, `.env`, `dist/`)
- If `package.json` doesn't exist yet when you start, create a minimal one; when 01's lands, resolve by keeping both sets of deps and scripts. Add to it: `hono`, `@hono/node-server`, `mppx` **pinned to exactly `0.17.1`**, `stripe` (exact current version), `dotenv`.

**Build:**
1. `src/payments.ts`: follow the Stripe guide, **with two differences for mppx 0.17.1 (checked by the reviewer, the guide is behind):** `stripe.create` needs a `store`, and `defaultMethods()` returns a promise when no deposit address is given. This exact shape is verified to return a 402 offline with a dummy `sk_test_` key:

   ```ts
   import crypto from 'node:crypto';
   import StripeClient from 'stripe';
   import { Mppx, Store, stripe } from 'mppx/server';
   const key = process.env.STRIPE_SECRET_KEY!;
   const secretKey = crypto.createHmac('sha256', key).update('mpp-challenge-signing').digest('base64');
   const sm = stripe.create({ client: new StripeClient(key), networkId: process.env.STRIPE_PROFILE_ID!, livemode: !key.includes('_test_'), store: Store.memory() });
   const mppx = Mppx.create({ methods: await sm.defaultMethods(), secretKey });
   // in the route: const r = await mppx.charge({ amount: '0.50' })(c.req.raw); if (r.status === 402) return r.challenge; return r.withReceipt(Response.json(verdict));
   ```

   Add `depositAddresses: { tempo: TEMPO_DEPOSIT_ADDRESS }` only when that env var is set. Build the `mppx` instance lazily (first paid request) so tests can set env first. If env vars are missing, the server still starts and the free routes work; `POST /classify` returns 503 `{ error: "payments not configured" }`.
2. Routes exactly as contract section 3. Order inside `POST /classify`: parse JSON (400 on failure) → `validate(answers)` (400 with `invalid` if any) → MPP charge (402 challenge if unpaid) → `classify` → append to `out/receipts.jsonl` (create `out/` if needed; fields from the contract only; never the answers or the use case) → `recordCheck(...)` from `src/live.ts` → return the verdict with the receipt.
3. `use_case` over 1000 chars → 400.
4. `GET /llms.txt`: plain text, under 40 lines: what this is, price, the three steps (GET /questions, map your use case, POST /classify and pay over MPP), the response shape, the disclaimer.
5. `GET /`: one small HTML page linking `/public/tokens.css` and using its classes (no external assets): name, one-line description, price, link to /questions and /llms.txt, and a table of the last 10 receipts (time, tier, amount). Plain, readable, no framework.

**Done when:**
- `npm test` passes with tests that use `app.request(...)` (no network, no real Stripe): free routes return 200; bad JSON → 400; invalid answers → 400 and **no** 402; valid body without payment → 402 with a `WWW-Authenticate: Payment ...` header (use a dummy `sk_test_` key and `profile_test_` id in the test env; no mock needed, the challenge is built offline); payments not configured → 503.
- `npm run dev` starts on 4242 and `curl -i -X POST localhost:4242/classify -H 'content-type: application/json' -d '{"answers":{"role":"deployer"}}'` returns 402 when a sandbox key is set (you won't have one; the reviewer runs this).
- README gets a "Run" section: `npm install`, copy `.env.example` to `.env`, `npm run dev`, then `npx mppx@0.17.1 validate http://localhost:4242`.

**Do not:** touch `src/engine.ts`, `src/live.ts`, `public/`, `data/`, `fixtures/`; store request bodies anywhere; add a database, auth, or a frontend framework; use `latest` for any package.

**If stuck:** after two failed attempts at the same problem, stop and write what you tried and what failed in the PR description.

**Finish:** open one PR titled `Paid server` with a 5-line summary and the `npm test` output.
