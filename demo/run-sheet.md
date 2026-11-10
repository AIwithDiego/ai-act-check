# Demo run sheet: three cases, Claude Code pays

Live at the MPP Hackathon Dublin, 10 Nov 2026. Claude Code is the paying agent; it uses the `ai-act-check` skill (`agent/SKILL.md`) and the `demo-agent` wallet on Tempo testnet.

## Setup (before going on stage)

```bash
# API running on 4242 (see README "Run"), wallet funded
curl -s http://localhost:4242/health
npx mppx@0.17.1 account view -a demo-agent --network testnet   # wallet exists; needs 1.50 USD of testnet funds
# refill if needed: npx mppx@0.17.1 account fund -a demo-agent --network testnet

# A clean demo project with the skill installed
mkdir -p ~/demo-project/.claude/skills/ai-act-check ~/demo-project/compliance
cp agent/SKILL.md ~/demo-project/.claude/skills/ai-act-check/SKILL.md
cd ~/demo-project && export AI_ACT_CHECK_URL=http://localhost:4242 && claude
```

Screen layout: terminal with Claude Code on the left, `localhost:4242/live` on the projector, a Finder window on `~/demo-project/compliance/` (empty).

Price per check: 0.50 USD. Three checks = 1.50 USD of testnet money.

## Case 1: CV screening (High-risk)

**Diego types:**

> We run 12 cafés in Dublin and get hundreds of applications for barista jobs. We want to use an AI tool that reads every CV, scores each applicant and gives us a shortlist of the top 10 to interview. Check it against the EU AI Act.

**On screen:**

1. Claude loads the `ai-act-check` skill and runs `curl -s $AI_ACT_CHECK_URL/questions` (free).
2. It states its assumptions in one line (deployer, a vendor's tool, profiling, the shortlist decides who gets an interview).
3. It runs `npx mppx@0.17.1 .../classify -i -J '...' -a demo-agent --network testnet`: the output shows `HTTP/1.1 402 Payment Required` with the 0.50 USD challenge, the payment on Tempo testnet, then `HTTP/1.1 200` with a `Payment-Receipt` header.
4. Verdict: **High-risk**, Annex III point 4 (employment), plus AI literacy (Art. 4) and GDPR: lawful basis, vendor contracts, DPIA (Art. 35), Art. 22 human review. Deployer duties from Art. 26 apply from 2027-12-02.
5. The check lands on the live screen. `compliance/ai-act-cv-screening.md` appears in Finder (compare `agent/example-record.md`).

**Diego says:** "Shortlisting CVs is high-risk under the AI Act; the duties start 2 December 2027, but the GDPR ones, the DPIA and the right to a human decision, apply today."

**Fallback if payment fails:**

```bash
curl -i -X POST http://localhost:4242/classify -H 'content-type: application/json' -d @demo/requests/cv-screening.json
npm test -- --reporter=verbose -t 'cv-screening$'
```

Show the `402 Payment Required` and its `WWW-Authenticate: Payment` header ("this is the exact challenge the agent pays"), then the green `✓ fixtures/cases.json > cv-screening` line: the engine returns `high` with annex3-employment, gdpr-basics, gdpr-dpia and gdpr-automated-decisions matched.

## Case 2: Website chatbot (Limited)

**Diego types:**

> We want a chatbot on our website that answers customer questions about opening hours, delivery and returns, and hands over to a person if it can't help. We're building it ourselves on the OpenAI API. What does the AI Act say?

**On screen:**

1. Questions fetched (free); Claude assumes role `both` (they build it and run it under their own name), `gpai_model: no` (they use OpenAI's API, they don't release a model).
2. 402, payment, 200 with receipt, as in case 1.
3. Verdict: **Limited**: Art. 50(1) (tell people they are talking to an AI, from the first message) and Art. 50(2) (mark AI-generated output), from 2026-08-02; AI literacy; GDPR basics and vendor contracts (the OpenAI API is a processor outside the EEA).
4. Live screen updates. `compliance/ai-act-website-chatbot.md` appears.

**Diego says:** "A chatbot is fine, it just has to say it's an AI from the first message; that's Article 50."

**Fallback if payment fails:**

```bash
curl -i -X POST http://localhost:4242/classify -H 'content-type: application/json' -d @demo/requests/website-chatbot.json
npm test -- --reporter=verbose -t 'website-chatbot$'
```

Show the 402, then `✓ fixtures/cases.json > website-chatbot`: `limited` with art50-interaction, gdpr-basics and gdpr-processor matched.

## Case 3: Call-centre emotion recognition (Prohibited)

**Diego types:**

> Our call centre wants software that listens to our agents' calls and flags when they sound stressed, frustrated or bored, so team leads can coach them and track mood scores. Can we use this in the EU?

**On screen:**

1. Questions fetched (free); Claude answers `emotion_recognition: true`, `emotion_recognition_workplace: true`, `emotion_medical_or_safety: false` (coaching and mood scores are not a safety reason).
2. 402, payment, 200 with receipt.
3. Verdict: **Prohibited**, Art. 5(1)(f). Obligation: "Do not sell, deploy or use this in the EU." (Art. 5, since 2025-02-02), plus AI literacy. No GDPR duties are listed: there is nothing to make compliant.
4. Live screen shows the prohibited check. `compliance/ai-act-call-centre-emotion.md` appears (the slug is Claude's choice).

**Diego says:** "Reading your staff's emotions at work has been banned since February 2025; the only way out is a real medical or safety reason."

**Fallback if payment fails:**

```bash
curl -i -X POST http://localhost:4242/classify -H 'content-type: application/json' -d @demo/requests/callcentre-emotion.json
npm test -- --reporter=verbose -t 'callcentre-emotion$'
```

Show the 402, then `✓ fixtures/cases.json > callcentre-emotion`: `prohibited` with art5-emotion-workplace matched.

## If more than one case fails

Run all three fallbacks back to back, then `npm test` once (all fixture cases green). Say it plainly: "The payment rail is down; this is the exact 402 the agent pays, and these are the verdicts it gets."

To show a full verdict (tier, articles, obligations) without the server:

```bash
npx tsx -e "import {classify} from './src/engine.ts'; import fs from 'node:fs'; const b = JSON.parse(fs.readFileSync('demo/requests/cv-screening.json', 'utf8')); console.log(JSON.stringify(classify(b.answers), null, 2))"
```
