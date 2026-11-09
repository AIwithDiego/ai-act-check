# AI Act Check

**What:** A pay-per-call API (Stripe Machine Payments Protocol) that tells an AI agent where an AI use case sits under the EU AI Act: tier, articles, obligations by role, dates. Rule-based, no LLM.
**Who:** Diego (demos it) · built by Devin during the MPP Hackathon Dublin (Stripe, Tue 10 Nov 2026, 13:00 to 14:30) · Smith reviews every PR · Hank owns the legal content.
**Type:** lab (hackathon)
**Status:** Prep pack written 9 Nov: brief, contract, three Devin prompts, run sheet, pitch. Hank writing questions, rules and test cases. Repo AIwithDiego/ai-act-check (private) to be created once the pack is complete.
**Next:** Diego sets up the Stripe sandbox (run sheet, Before). Smith runs the sandbox 402 check, pushes the pack. Build tomorrow.

**Truth lives in:** tickets = `tickets.md` · plan = `docs/run-sheet.md` · the fixed spec = `docs/contract.md` · legal content = `data/` (Hank only).

## Rules
- `docs/contract.md` is fixed once the build starts. Changes only before 13:00.
- `data/` and `fixtures/` are Hank's. Devin never edits them; a disagreement goes in the PR description.
- No secrets in the repo, chat or Devin. Stripe sandbox key and profile live in the Keychain (`stripe-sandbox-secret`, `stripe-sandbox-profile`); `.env` is gitignored and written on the Mac only.
- The API never stores the use case or the answers. Receipts log = time, tier, amount, receipt id.
- Pinned versions: `mppx` 0.17.1, `@stripe/link-cli` 1.3.0. No `latest`.
- Merging to main is Diego's word. Nothing deploys from main (localhost only).
- Not legal advice; the disclaimer ships in every verdict.
