# 03 · Agent kit and demo script

Paste everything below the line into a Devin session. Runs **at the same time** as 01, 02 and 04.

---

You are writing the agent-facing kit for **AI Act Check** in the repo `AIwithDiego/ai-act-check`.

**Read first:** `docs/brief.md`, `docs/contract.md`, `data/questions.json`, `fixtures/cases.json`, and https://docs.stripe.com/payments/machine/mpp.md (the "Test with a Stripe sandbox" and Crypto parts; we pay over Tempo testnet, not Link).

**Your job:** everything a coding agent (Claude Code) needs to use this API and pay for it, plus the scripted demo. No server code.

**You own these files (create or edit only these):**
- `agent/SKILL.md`: a Claude Code skill. Frontmatter `name: ai-act-check`, `description:` (when to use it: the user is building or deploying an AI feature for people in the EU and wants to know its AI Act risk tier and the GDPR duties that come with it). Body: the steps (GET /questions; map the use case to answers, asking the user only for what can't be inferred; POST /classify; pay with `npx mppx@0.17.1 <url> -J '<json>' -a demo-agent --network testnet` (it handles the 402, pays and retries); show the user the tier, the articles and the obligations for their role, and the disclaimer; then save the record, see below). Base URL from env `AI_ACT_CHECK_URL`, default `http://localhost:4242`. Under 100 lines.
  **The record:** after a paid verdict, the skill writes `compliance/ai-act-<short-slug>.md` in the user's project (create `compliance/` if needed; never overwrite, add `-2`, `-3`). Contents, in this order: title "AI Act check: <use case in a few words>", date, the tier in words, the matched rules with their articles, then "What you must do": every obligation for the role, grouped AI Act then GDPR, each with its article and `applies_from` date, then anything in `missing`, then the receipt id, amount and `rules_version`, and the disclaimer last. Markdown only, no answers dump, nothing the user didn't see. Put an example of this file for the CV case in `agent/example-record.md`.
- `demo/run-sheet.md`: the live demo, three cases (the CV screening, website chatbot and call-centre emotion cases from `fixtures/cases.json`). For each: the exact sentence Diego types to Claude Code, what should happen on screen (402, payment, verdict, the record file appears in `compliance/`), and the one line Diego says about it. Plus a fallback per case if the payment step fails (show the 402 with `curl -i`, then the verdict from `npm test` output).
- `agent/example-record.md`: the example record (see above).
- `demo/requests/*.json`: one request body per demo case (`{ use_case, answers }`, copied from the fixtures), so the fallback can `curl -d @demo/requests/cv-screening.json`.
- `README.md`: rewrite it (keep the "Demo" section and any "Run" section another session added, merge, don't drop them). Sections: what it is (3 lines), how an agent pays (the 402 flow in 4 lines and a small text diagram), the API table from the contract, example response (use a real case from fixtures, write the verdict by hand following the rules), disclaimer, "Built at the MPP Hackathon Dublin, 10 Nov 2026, with Devin". No badges, no emoji.

**Done when:** every file above exists; the three request bodies are valid JSON and match the fixtures; SKILL.md has valid frontmatter; the README example response matches what the rules give for that case (check by reading `data/rules.json`).

**Do not:** write server or engine code, edit `data/` or `fixtures/`, invent API routes that aren't in the contract.

**Finish:** open one PR titled `Agent kit` with a 5-line summary.
