import type { Answers, Questions, Rules, Validation, Verdict } from "./types.js";

export type * from "./types.js";

export function validate(_answers: Answers, _questions?: Questions): Validation {
  return { invalid: [], missing: [] };
}

export function classify(answers: Answers, _rules?: Rules, _questions?: Questions): Verdict {
  return {
    tier: "minimal",
    role: typeof answers?.role === "string" ? answers.role : null,
    matched: [],
    obligations: [],
    gdpr_short: [],
    missing: [],
    invalid: [],
    rules_version: "stub",
    disclaimer: "A first-pass classification from your answers, not legal advice.",
  };
}
