# Changelog

## Unreleased · 11 Nov 2026 (Agentic Dev Day)
- Hosted live screen: paid checks are written to a shared Upstash Redis store (last 20 verdicts, kept 24 hours), so `/live` works on serverless hosting and not only on one machine.
- Hosted console at `/console`: anyone runs one of three prepared cases from a phone. The server pays the API itself from a Tempo testnet wallet (test money only), one check at a time with a daily ceiling, and each run lands on the live screen. `/console?run=<case id>` starts a case directly.
- Infrastructure through Stripe Projects: Upstash Redis and a Vercel project, tracked in `.projects/`.
- Second deployment for the event: https://ai-act-check-projects.vercel.app

## v0.1.0 · 10 Nov 2026
- First public release, built at the Stripe MPP Hackathon Dublin and ranked 1st on the leaderboard.
- Rule-based EU AI Act classifier (34 rules, 33 questions, 14 test cases), GDPR overlap, duties by role and dates.
- Paid API over Stripe's Machine Payments Protocol: free questions, 402, 0.60 USD by Stripe test card or Tempo testnet, verdict with a receipt.
- Claude Code skill that pays, shows the verdict and saves a compliance record; a live screen for the room; a demo console.
- Live at https://ai-act-check-flame.vercel.app, with `/openapi.json` and `/llms.txt` for agents.
