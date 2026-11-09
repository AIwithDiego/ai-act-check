# Run sheet: MPP Hackathon, Tue 10 Nov, 13:00 to 14:30

## Before (today and tomorrow morning)

**Diego**
1. ~~Stripe sandbox, profile, secret key in the Keychain~~ (done 9 Nov).
2. ~~Link login~~ dropped: Link's agent connection is not available in Ireland. The agent pays with a Tempo testnet wallet instead (`mppx`, free test money).
3. ~~Crypto in the dashboard~~ skipped (needs Stripe approval outside the US; not needed for a demo). The agent pays on Tempo testnet and gets the verdict with a receipt; the Stripe dashboard won't list the payment, and that's fine.
4. Merge PR #1.
5. Devin: make sure the Devin GitHub app can see `AIwithDiego/ai-act-check` (Devin → Settings → Integrations → GitHub → repository access).

**Smith**
- Repo pack pushed: brief, contract, Hank's questions, rules and test cases (AI Act + GDPR), four Devin prompts, Allison's design system and live-screen mock, this run sheet, the pitch.
- Sandbox check: done 9 Nov, see Log. Paying wallet = `mppx` account `demo-agent` on Tempo testnet (in the Mac Keychain, funded from the faucet; refill with `npx mppx@0.17.1 account fund -a demo-agent --network testnet`).
- Packages pre-downloaded on the Mac so nothing waits on the venue Wi-Fi.

## During (90 minutes)

| Time | Diego | Devin | Smith |
|---|---|---|---|
| 13:00 | Open four Devin sessions, paste `prompts/01` to `04` (one each) | Read and start | Watch the sessions, answer Devin's questions with Diego |
| 13:10 to 13:45 | Talk to people, follow along | Build, open PRs | Review each PR as it lands: read the diff, run `npm test`, check it against the contract. Say "merge" or what to fix |
| 13:45 | Say "merge" for each PR Smith passes | Fix what review found | Swap the engine stub for the real engine, wire `.env` from the Keychain, `npm run dev` |
| 13:55 | Put `localhost:4242/live` on the projector | | `npx mppx@0.17.1 validate http://localhost:4242`, then the three demo cases with Claude Code paying; each one lands on the live screen |
| 14:05 | Rehearse the three cases once | (stretch: paid MCP tool, only if all green) | Fix anything that broke |
| 14:15 | Demo | | Drive the second screen if needed |

**Merging:** Smith reviews, Diego says "merge" per PR (main is the demo, nothing deploys). If a merge breaks `main`, revert first.

**Freeze at 14:05.** After that only copy fixes and the rehearsal.

## Say this in the demo (Hank, 9 Nov)

- High-risk duties for CV screening and credit scoring apply from **2 Dec 2027** (AI Omnibus, Reg. (EU) 2026/1744, in force 27 Jul 2026). Bans, AI literacy, GPAI and Art. 50 transparency already apply. Delayed is not cancelled.
- Emotion recognition at work has been banned since Feb 2025 (fines up to EUR 35M or 7% of turnover). The only way out is a real medical or safety reason; the driver-drowsiness case shows it (it comes out high-risk, not banned).
- The verdict is only as good as the agent's answers: say "no profiling" falsely and CV screening comes back minimal. Say it out loud; it shows the rules are deterministic.
- Not legal advice, on every response. Anything using the Art. 6(3) exception or police biometrics needs a lawyer.
- If asked: Annex I products are simplified to one conservative question.

## If something fails

- **Machine payments not approved yet:** the sandbox still returns the 402 challenge. Demo the 402, then show the verdict from the fixture run. Say so plainly: "Stripe's approval is pending; this is the exact challenge an agent pays."
- **A Devin session stalls:** Smith takes that file over locally; the contract keeps the pieces independent.
- **Wi-Fi:** everything runs on localhost; only the payment needs the network. Use the phone hotspot.

## Log

- 9 Nov: pack written; Hank writing rules and cases.
- 9 Nov: spike with mppx 0.17.1 returns a 402 offline with a dummy key (card + link methods). Stripe's guide is behind: `stripe.create` needs `store: Store.memory()` and `defaultMethods()` must be awaited. Prompt 02 updated. Real sandbox payment still to test (needs Diego's keys).
- 9 Nov, 15:35: real sandbox payment works end to end with Diego's keys: 402 → `demo-agent` pays 0.50 on Tempo testnet → 200 with receipt. Link is not available in Ireland, so the demo pays over Tempo, not card. Sandbox deposit address saved to the Keychain as `stripe-sandbox-tempo-address`. Open: Stripe couldn't record the payment ("payment method type crypto is invalid") until Crypto is turned on in the sandbox.
- 9 Nov: Crypto/stablecoin payments need approval outside the US (docs: email machine-payments@stripe.com with the account ID). Diego: not needed for a demo, skipped.
