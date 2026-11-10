# AI Act Check

**What:** A pay-per-call API (Stripe Machine Payments Protocol) that tells an AI agent where an AI use case sits under the EU AI Act: tier, articles, obligations by role, dates. Rule-based, no LLM.
**Who:** Diego (demos it) · built by Devin during the MPP Hackathon Dublin (Stripe, Tue 10 Nov 2026, 13:00 to 14:30) · Smith reviews every PR · Hank owns the legal content.
**Type:** lab (hackathon)
**Status:** Prep pack merged (PR #1, #2). Demo console + How it works page merged (PR #3), tested end to end on a stand-in API with real testnet payments.
**Next:** Build 13:00 with four Devin sessions (Diego gives Devin repo access). From 13:45 Diego runs the demo from the console (`node console/server.mjs`, localhost:4343). Smith stops the morning's stand-in API on 4242 before the real one starts.

**Truth lives in:** tickets = `tickets.md` · plan = `docs/run-sheet.md` · how it works = `docs/how-it-works.html` · demo console = `console/` · the fixed spec = `docs/contract.md` · legal content = `data/` (Hank only).

## Rules
- `docs/contract.md` is fixed once the build starts. Changes only before 13:00.
- `data/` and `fixtures/` are Hank's. Devin never edits them; a disagreement goes in the PR description.
- No secrets in the repo, chat or Devin. Stripe sandbox key, profile and Tempo deposit address live in the Keychain (`stripe-sandbox-secret`, `stripe-sandbox-profile`, `stripe-sandbox-tempo-address`); the paying wallet is the `mppx` account `demo-agent`; `.env` is gitignored and written on the Mac only.
- The API never stores the use case or the answers. Receipts log = time, tier, amount, receipt id.
- Pinned versions: `mppx` 0.17.1, paying client = `mppx` 0.17.1 CLI. No `latest`.
- Merging to main is Diego's word. Nothing deploys from main (localhost only).
- Not legal advice; the disclaimer ships in every verdict.
