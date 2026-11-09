# 03 · Agent kit and demo script

Paste everything below the line into a Devin session. Runs **at the same time** as 01 and 02.

---

You are writing the agent-facing kit for **AI Act Check** in the repo `AIwithDiego/ai-act-check`.

**Read first:** `docs/brief.md`, `docs/contract.md`, `data/questions.json`, `fixtures/cases.json`, and https://docs.stripe.com/payments/machine/mpp.md (the "Test manually" part with `@stripe/link-cli`).

**Your job:** everything a coding agent (Claude Code) needs to use this API and pay for it, plus the scripted demo. No server code.

**You own these files (create or edit only these):**
- `agent/SKILL.md`: a Claude Code skill. Frontmatter `name: ai-act-check`, `description:` (when to use it: the user is building or deploying an AI feature for people in the EU and wants to know its AI Act risk tier). Body: the steps (GET /questions; map the use case to answers, asking the user only for what can't be inferred; POST /classify; on 402 pay with `npx @stripe/link-cli@1.3.0 mpp pay <url> -X POST -d '<json>' --context "<one line>"`; show the user the tier, the articles and the obligations for their role, and the disclaimer). Base URL from env `AI_ACT_CHECK_URL`, default `http://localhost:4242`. Under 80 lines.
- `demo/run-sheet.md`: the live demo, three cases (the CV screening, website chatbot and call-centre emotion cases from `fixtures/cases.json`). For each: the exact sentence Diego types to Claude Code, what should happen on screen (402, payment, verdict), and the one line Diego says about it. Plus a fallback per case if the payment step fails (show the 402 with `curl -i`, then the verdict from `npm test` output).
- `demo/requests/*.json`: one request body per demo case (`{ use_case, answers }`, copied from the fixtures), so the fallback can `curl -d @demo/requests/cv-screening.json`.
- `README.md`: rewrite it (keep any "Run" section another session added, merge, don't drop it). Sections: what it is (3 lines), how an agent pays (the 402 flow in 4 lines and a small text diagram), the API table from the contract, example response (use a real case from fixtures, write the verdict by hand following the rules), disclaimer, "Built at the MPP Hackathon Dublin, 10 Nov 2026, with Devin". No badges, no emoji.

**Done when:** every file above exists; the three request bodies are valid JSON and match the fixtures; SKILL.md has valid frontmatter; the README example response matches what the rules give for that case (check by reading `data/rules.json`).

**Do not:** write server or engine code, edit `data/` or `fixtures/`, invent API routes that aren't in the contract.

**Finish:** open one PR titled `Agent kit` with a 5-line summary.
