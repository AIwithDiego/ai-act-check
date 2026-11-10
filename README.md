# AI Act Check

A pay-per-call API that tells an AI agent where an AI use case sits under the EU AI Act. Agents pay over Stripe's Machine Payments Protocol (MPP).

Built at the MPP Hackathon Dublin, 10 Nov 2026. Start with `docs/brief.md`.

Not legal advice.

## Demo

- How it works, with diagrams: `docs/how-it-works.html`
- Demo console: `node console/server.mjs`, then http://localhost:4343 (see `console/README.md`)

## Run

```bash
npm install
cp .env.example .env   # fill in the Stripe sandbox key and profile id
npm run dev            # http://localhost:4242
npx mppx@0.17.1 validate http://localhost:4242
```
