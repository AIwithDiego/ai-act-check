export type AnswerValue = boolean | string;
export type Answers = Record<string, AnswerValue>;

export type Clause =
  | { q: string; is: AnswerValue }
  | { q: string; in: AnswerValue[] }
  | Condition;

export interface Condition {
  all?: Clause[];
  any?: Clause[];
}

export interface Question {
  id: string;
  text: string;
  type: "boolean" | "enum";
  options?: string[];
  help?: string;
  required?: boolean;
  ask_if?: Condition;
}

export interface Questions {
  version: string;
  questions: Question[];
}

export type ObligationRole = "provider" | "deployer" | "all";

export interface RuleObligation {
  role: ObligationRole;
  text: string;
  article: string;
  key?: boolean;
  applies_from?: string;
}

export type Tier = "prohibited" | "high" | "limited" | "minimal";
export type RuleTier = Tier | "gpai";

export interface Rule {
  id: string;
  tier: RuleTier;
  title: string;
  article: string;
  when: Condition;
  unless?: Condition;
  obligations: RuleObligation[];
  applies_from: string;
  stacks?: boolean;
  note?: string;
  short?: string;
}

export interface Rules {
  version: string;
  law: string;
  checked_by: string;
  disclaimer: string;
  tier_order: Tier[];
  rules: Rule[];
}

export interface MatchedRule {
  id: string;
  tier: string;
  title: string;
  article: string;
  note?: string;
}

export interface Obligation {
  law: "AI Act" | "GDPR";
  text: string;
  article: string;
  role: string;
  applies_from: string;
  key?: boolean;
}

export interface Verdict {
  tier: Tier | "incomplete";
  role: string | null;
  matched: MatchedRule[];
  obligations: Obligation[];
  gdpr_short: string[];
  missing: string[];
  invalid: string[];
  rules_version: string;
  disclaimer: string;
}

export interface Validation {
  invalid: string[];
  missing: string[];
}
