# Demo console

`node console/server.mjs`, then open http://localhost:4343. Nothing to install.

- **Start API** runs `npm run dev` (writes `.env` from the Keychain first if it's missing).
- **Run with agent**: Claude Code runs headless in `out/agent-project/`, reads the questions, pays 0.60 USD with Stripe’s test card (set `PAY_METHOD=tempo` to pay from the `demo-agent` testnet wallet instead) and saves a record in `compliance/`.
- **Run without AI**: the same API and payment with a prepared case's answers. The fallback.

Env (optional): `AI_ACT_CHECK_URL` (default http://localhost:4242), `CONSOLE_PORT` (4343), `DEMO_WALLET` (demo-agent), `AGENT_MODEL` (sonnet).
