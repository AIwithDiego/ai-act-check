import { readFileSync } from "node:fs";
import type {
  AnswerValue,
  Answers,
  Clause,
  Condition,
  MatchedRule,
  Obligation,
  Question,
  Questions,
  Rule,
  Rules,
  Validation,
  Verdict,
} from "./types.js";

export type * from "./types.js";

function loadJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(new URL(relPath, import.meta.url), "utf8")) as T;
}

export const defaultQuestions: Questions = loadJson<Questions>("../data/questions.json");
export const defaultRules: Rules = loadJson<Rules>("../data/rules.json");

function isValidAnswer(question: Question, value: unknown): boolean {
  if (question.type === "boolean") return typeof value === "boolean";
  if (question.type === "enum") {
    return typeof value === "string" && (question.options ?? []).includes(value);
  }
  return false;
}

function validAnswersOnly(answers: Answers, questions: Questions): Answers {
  const byId = new Map(questions.questions.map((q) => [q.id, q]));
  const valid: Answers = {};
  for (const [id, value] of Object.entries(answers ?? {})) {
    const q = byId.get(id);
    if (q && isValidAnswer(q, value)) valid[id] = value;
  }
  return valid;
}

function isCondition(clause: Clause): clause is Condition {
  return !("q" in clause);
}

function evalClause(clause: Clause, answers: Answers): boolean {
  if (isCondition(clause)) return evalCondition(clause, answers);
  if (!Object.hasOwn(answers, clause.q)) return false;
  const value: AnswerValue = answers[clause.q];
  if ("in" in clause) return clause.in.includes(value);
  return value === clause.is;
}

export function evalCondition(cond: Condition, answers: Answers): boolean {
  if (cond.all && !cond.all.every((c) => evalClause(c, answers))) return false;
  if (cond.any && !cond.any.some((c) => evalClause(c, answers))) return false;
  return true;
}

function ruleMatches(rule: Rule, answers: Answers): boolean {
  if (!evalCondition(rule.when, answers)) return false;
  return !(rule.unless && evalCondition(rule.unless, answers));
}

export function validate(answers: Answers, questions: Questions = defaultQuestions): Validation {
  const byId = new Map(questions.questions.map((q) => [q.id, q]));
  const invalid: string[] = [];
  for (const [id, value] of Object.entries(answers ?? {})) {
    const q = byId.get(id);
    if (!q || !isValidAnswer(q, value)) invalid.push(id);
  }
  const valid = validAnswersOnly(answers, questions);
  const missing = questions.questions
    .filter((q) => q.required && !Object.hasOwn(valid, q.id))
    .filter((q) => !q.ask_if || evalCondition(q.ask_if, valid))
    .map((q) => q.id);
  return { invalid, missing };
}

function roleAllows(callerRole: string | null, obligationRole: string): boolean {
  if (obligationRole === "all" || callerRole === "both") return true;
  return obligationRole === callerRole;
}

export function classify(
  answers: Answers,
  rules: Rules = defaultRules,
  questions: Questions = defaultQuestions,
): Verdict {
  const { invalid, missing } = validate(answers, questions);
  const role = typeof answers?.role === "string" ? answers.role : null;
  const base = {
    role,
    missing,
    invalid,
    rules_version: rules.version,
    disclaimer: rules.disclaimer,
  };

  if (missing.length > 0) {
    return { ...base, tier: "incomplete", matched: [], obligations: [], gdpr_short: [] };
  }

  const valid = validAnswersOnly(answers, questions);
  const matchedRules = rules.rules.filter((r) => ruleMatches(r, valid));

  const tier =
    rules.tier_order.find((t) => matchedRules.some((r) => r.tier === t)) ?? "minimal";

  const matched: MatchedRule[] = matchedRules.map((r) => ({
    id: r.id,
    tier: r.tier,
    title: r.title,
    article: r.article,
    ...(r.note !== undefined ? { note: r.note } : {}),
  }));

  const seen = new Set<string>();
  const obligations: Obligation[] = [];
  for (const rule of matchedRules) {
    if (rule.tier !== tier && !rule.stacks && rule.tier !== "gpai") continue;
    const law = rule.id.startsWith("gdpr-") ? "GDPR" : "AI Act";
    for (const o of rule.obligations) {
      if (!roleAllows(role, o.role) || seen.has(o.text)) continue;
      seen.add(o.text);
      obligations.push({
        law,
        text: o.text,
        article: o.article,
        role: o.role,
        applies_from: o.applies_from ?? rule.applies_from,
        ...(o.key !== undefined ? { key: o.key } : {}),
      });
    }
  }
  const lawRank = (law: Obligation["law"]) => (law === "AI Act" ? 0 : 1);
  obligations.sort(
    (a, b) => lawRank(a.law) - lawRank(b.law) || a.applies_from.localeCompare(b.applies_from),
  );

  const gdpr_short =
    tier === "prohibited"
      ? []
      : matchedRules
          .filter((r) => r.id.startsWith("gdpr-") && r.short)
          .map((r) => r.short as string);

  return { ...base, tier, matched, obligations, gdpr_short };
}
