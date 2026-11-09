# 01 · Engine

Paste everything below the line into a Devin session.

---

You are building the classification engine for **AI Act Check** in the repo `AIwithDiego/ai-act-check`.

**Read first, in this order:** `docs/brief.md`, `docs/contract.md` (sections 0, 1, 2 and 4 are yours). Then look at `data/questions.json`, `data/rules.json` and `fixtures/cases.json`. Do not start coding until you have read all of them.

**Your job:** a pure TypeScript function `classify(answers)` that applies `data/rules.json` exactly as contract section 2 says, plus the project skeleton.

**You own these files (create or edit only these):**
- `package.json` (name `ai-act-check`, `"type": "module"`, scripts `test` = `vitest run`, `build` = `tsc`, `dev` = `tsx watch src/server.ts`, `start` = `tsx src/server.ts`; deps you add: `typescript`, `tsx`, `vitest`, `@types/node`. Exact versions, no `^`.)
- `tsconfig.json` (strict, ES2022, NodeNext)
- `src/types.ts` (types for questions, rules, conditions, answers, Verdict, matching the contract)
- `src/engine.ts`
- `tests/engine.test.ts`

**Build:**
1. Load `data/questions.json` and `data/rules.json` once at import (use `import ... with { type: "json" }` or `fs.readFileSync` + `JSON.parse`; your call, keep it simple). `classify(answers, rules?, questions?)` defaults to them.
2. Validate answers: unknown question id, wrong type, or enum value not in `options` → id goes in `invalid`. Required questions (respecting `ask_if`) not answered → `missing`.
3. Evaluate conditions as in contract 1.2 (`all`, `any`, nested, `is`, `in`; unanswered clause = false; `unless`).
4. Tier and obligations exactly as contract section 2 (tier order from `rules.tier_order`, `stacks`, `gpai` never sets the tier, role filter with `both` = everything, de-dupe by text, `law` field from the rule id prefix, AI Act before GDPR, then by `applies_from`).
5. Pass `key` through on obligations; fill `gdpr_short` with the `short` of every matched `gdpr-` rule (empty when the tier is prohibited).
6. Echo `answers.role` as `verdict.role` (`null` if not answered).
7. Export a second helper `validate(answers)` returning `{ invalid, missing }` (the server calls it before asking for payment).

**Done when:**
- `npm install && npm test` passes.
- `tests/engine.test.ts` runs **every** case in `fixtures/cases.json` (one `it` per case, named by `id`) and checks `tier` and that each id in `expect.matched` is in `matched`.
- Extra unit tests: unknown id → invalid; enum value outside options → invalid; `unless` blocks a match; nested `any` inside `all`; role `deployer` gets no provider-only obligations; `both` gets all.

**Do not:** edit anything in `data/` or `fixtures/` (if a case fails because you believe the data is wrong, say so in the PR, don't change it), add an HTTP server, add dependencies beyond the four above.

**If stuck:** after two failed attempts at the same problem, stop and write what you tried and what failed in the PR description.

**Finish:** open one PR titled `Engine` with a 5-line summary and the `npm test` output.
