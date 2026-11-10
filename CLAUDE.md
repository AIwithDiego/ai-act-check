# AI Act Check

**What:** A pay-per-call API (Stripe Machine Payments Protocol) that tells an AI agent where an AI use case sits under the EU AI Act: tier, articles, obligations by role, dates. Rule-based, no LLM.
**Who:** Diego (demos it) · built by Devin during the MPP Hackathon Dublin (Stripe, Tue 10 Nov 2026, 13:00 to 14:30) · Smith reviews every PR · Hank owns the legal content.
**Type:** lab (hackathon)
**Status:** Won the MPP Hackathon Dublin, 10 Nov 2026 (1st on the leaderboard, 9 votes). Live at https://ai-act-check-flame.vercel.app, card payments at 0.60 USD visible in the Stripe dashboard. Demo console and live screen run on the Mac.
**Next:** Merge PR #13 (scan warnings). Then decide: hosted console + live screen (needs a shared store and, for the agent mode, a Claude API budget), the paid MCP tool (AAC-4), and Chile's Ley 21.719.

**Truth lives in:** tickets = `tickets.md` · plan = `docs/run-sheet.md` · how it works = `docs/how-it-works.html` · demo console = `console/` · the fixed spec = `docs/contract.md` · legal content = `data/` (Hank only).

## Rules
- `docs/contract.md` is fixed once the build starts. Changes only before 13:00.
- `data/` and `fixtures/` are Hank's. Devin never edits them; a disagreement goes in the PR description.
- No secrets in the repo, chat or Devin. Stripe sandbox key, profile and Tempo deposit address live in the Keychain (`stripe-sandbox-secret`, `stripe-sandbox-profile`, `stripe-sandbox-tempo-address`); the paying wallet is the `mppx` account `demo-agent`; `.env` is gitignored and written on the Mac only.
- The API never stores the use case or the answers. Receipts log = time, tier, amount, receipt id.
- Pinned versions: `mppx` 0.17.1, paying client = `mppx` 0.17.1 CLI. No `latest`.
- Merging to main is Diego's word. The API runs on Vercel (project `ai-act-check`, Diego's projects): Smith deploys production with `vercel deploy --prod` from main, only after Diego's merge. Git is disconnected from Vercel and `vercel.json` sets `git.deploymentEnabled: false`, so a push never deploys. Secrets live in Vercel env vars (sandbox only), never in the repo. The live screen and console stay on the Mac.
- Not legal advice; the disclaimer ships in every verdict.
