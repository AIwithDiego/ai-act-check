import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classify, defaultRules, validate } from "../src/engine.js";
import type { Answers, Questions, Rules } from "../src/types.js";

interface Case {
  id: string;
  use_case: string;
  answers: Answers;
  expect: { tier: string; matched: string[] };
}

const cases = JSON.parse(
  readFileSync(new URL("../fixtures/cases.json", import.meta.url), "utf8"),
) as Case[];

const byId = (id: string) => {
  const c = cases.find((x) => x.id === id);
  if (!c) throw new Error(`fixture ${id} not found`);
  return c;
};

describe("fixtures/cases.json", () => {
  for (const c of cases) {
    it(c.id, () => {
      const v = classify(c.answers);
      expect(v.tier).toBe(c.expect.tier);
      const ids = v.matched.map((m) => m.id);
      for (const id of c.expect.matched) expect(ids).toContain(id);
    });
  }
});

const miniQuestions: Questions = {
  version: "test",
  questions: [
    { id: "role", text: "", type: "enum", options: ["provider", "deployer", "both"], required: true },
    { id: "a", text: "", type: "boolean", required: true },
    { id: "b", text: "", type: "boolean", required: true },
    { id: "c", text: "", type: "enum", options: ["x", "y", "z"], required: true },
    { id: "exempt", text: "", type: "boolean", required: false },
  ],
};

const miniRules = (rules: Rules["rules"]): Rules => ({
  version: "test",
  law: "test",
  checked_by: "test",
  disclaimer: "test",
  tier_order: ["prohibited", "high", "limited", "minimal"],
  rules,
});

const base: Answers = { role: "provider", a: false, b: false, c: "x" };

describe("validate", () => {
  it("unknown question id is invalid", () => {
    const r = validate({ ...base, not_a_question: true });
    expect(r.invalid).toContain("not_a_question");
  });

  it("enum value outside options is invalid", () => {
    const r = validate({ ...byId("cv-screening").answers, essential_services: "pizza" });
    expect(r.invalid).toEqual(["essential_services"]);
  });

  it("wrong type is invalid", () => {
    const r = validate({ ...byId("cv-screening").answers, employment: "yes" });
    expect(r.invalid).toEqual(["employment"]);
  });

  it("ask_if decides whether a question is required", () => {
    const answers = { ...byId("cv-screening").answers };
    delete answers.profiling;
    expect(validate(answers).missing).toEqual(["profiling"]);
    expect(validate(byId("bakery-forecast-no-personal-data").answers).missing).toEqual([]);
  });

  it("missing required answers give tier incomplete and no obligations", () => {
    const v = classify(byId("incomplete").answers);
    expect(v.tier).toBe("incomplete");
    expect(v.missing.length).toBeGreaterThan(0);
    expect(v.obligations).toEqual([]);
    expect(v.matched).toEqual([]);
  });
});

describe("conditions", () => {
  const rules = miniRules([
    {
      id: "r-unless",
      tier: "high",
      title: "unless",
      article: "A",
      when: { all: [{ q: "a", is: true }] },
      unless: { any: [{ q: "exempt", is: true }] },
      obligations: [],
      applies_from: "2025-01-01",
    },
    {
      id: "r-nested",
      tier: "limited",
      title: "nested",
      article: "B",
      when: { all: [{ q: "b", is: true }, { any: [{ q: "a", is: true }, { q: "c", in: ["y", "z"] }] }] },
      obligations: [],
      applies_from: "2025-01-01",
    },
  ]);
  const ids = (a: Answers) => classify(a, rules, miniQuestions).matched.map((m) => m.id);

  it("unless blocks a match", () => {
    expect(ids({ ...base, a: true })).toContain("r-unless");
    expect(ids({ ...base, a: true, exempt: true })).not.toContain("r-unless");
    expect(classify({ ...base, a: true, exempt: true }, rules, miniQuestions).tier).toBe("minimal");
  });

  it("nested any inside all", () => {
    expect(ids({ ...base, b: true, c: "y" })).toContain("r-nested");
    expect(ids({ ...base, b: true, a: true })).toContain("r-nested");
    expect(ids({ ...base, b: true, c: "x" })).not.toContain("r-nested");
    expect(ids({ ...base, b: false, c: "z" })).not.toContain("r-nested");
  });

  it("a clause on an unanswered question is false", () => {
    const optional = miniRules([
      {
        id: "r-opt",
        tier: "high",
        title: "opt",
        article: "C",
        when: { any: [{ q: "exempt", is: false }] },
        obligations: [],
        applies_from: "2025-01-01",
      },
    ]);
    expect(classify(base, optional, miniQuestions).matched).toEqual([]);
  });
});

describe("tier and obligations", () => {
  const screening = byId("cv-screening-vendor").answers;
  const providerOnly = new Set(
    defaultRules.rules.flatMap((r) => r.obligations.filter((o) => o.role === "provider").map((o) => o.text)),
  );

  it("role deployer gets no provider-only obligations", () => {
    const v = classify({ ...screening, role: "deployer" });
    expect(v.role).toBe("deployer");
    expect(v.obligations.length).toBeGreaterThan(0);
    for (const o of v.obligations) {
      expect(o.role).not.toBe("provider");
      expect(providerOnly.has(o.text) && o.role !== "all").toBe(false);
    }
  });

  it("role both gets every obligation of provider and deployer", () => {
    const texts = (role: string) => classify({ ...screening, role }).obligations.map((o) => o.text);
    const both = texts("both");
    const union = new Set([...texts("provider"), ...texts("deployer")]);
    expect(new Set(both)).toEqual(union);
    expect(both.length).toBe(union.size);
    const roles = new Set(classify({ ...screening, role: "both" }).obligations.map((o) => o.role));
    expect(roles).toEqual(new Set(["provider", "deployer", "all"]));
  });

  it("orders AI Act before GDPR, then by applies_from, de-duplicated by text", () => {
    const v = classify(byId("cv-screening").answers);
    const laws = v.obligations.map((o) => o.law);
    expect(laws.indexOf("GDPR")).toBeGreaterThan(laws.lastIndexOf("AI Act"));
    for (const law of ["AI Act", "GDPR"] as const) {
      const dates = v.obligations.filter((o) => o.law === law).map((o) => o.applies_from);
      expect(dates).toEqual([...dates].sort());
    }
    const texts = v.obligations.map((o) => o.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("a duty shared by several rules keeps the earliest applies_from and its key flag", () => {
    const v = classify({ ...byId("cv-screening-vendor").answers, role: "both", annex1_safety_component: true });
    const annex1 = defaultRules.rules.find((r) => r.id === "annex1-product-safety")!;
    const annex3 = defaultRules.rules.find((r) => r.id === "annex3-employment")!;
    const shared = annex3.obligations.filter((o) => annex1.obligations.some((a) => a.text === o.text));
    expect(shared.length).toBeGreaterThan(0);
    for (const o of shared) {
      const out = v.obligations.find((x) => x.text === o.text)!;
      expect(out.applies_from).toBe(annex3.applies_from);
      const key = Boolean(o.key || annex1.obligations.find((a) => a.text === o.text)?.key);
      expect(Boolean(out.key)).toBe(key);
    }
  });

  it("stacking rules add obligations on top of the winning tier; gpai never sets the tier", () => {
    const v = classify({ ...byId("cv-screening").answers, gpai_model: "yes", interacts_with_people: true });
    expect(v.tier).toBe("high");
    const articles = v.obligations.map((o) => o.article).join(" ");
    expect(articles).toMatch(/Art\. 50/);
    expect(articles).toMatch(/Art\. 53/);
    expect(classify(byId("gpai-provider").answers).tier).toBe("minimal");
  });

  it("passes key through and fills gdpr_short", () => {
    const v = classify(byId("cv-screening").answers);
    expect(v.obligations.some((o) => o.key === true)).toBe(true);
    expect(v.gdpr_short).toEqual(
      defaultRules.rules.filter((r) => v.matched.some((m) => m.id === r.id) && r.id.startsWith("gdpr-")).map((r) => r.short),
    );
    expect(v.gdpr_short.length).toBeGreaterThan(0);
  });

  it("prohibited tier has empty gdpr_short", () => {
    const v = classify(byId("callcentre-emotion").answers);
    expect(v.tier).toBe("prohibited");
    expect(v.gdpr_short).toEqual([]);
  });

  it("echoes role, null when unanswered", () => {
    expect(classify({}).role).toBeNull();
    expect(classify({}).tier).toBe("incomplete");
    expect(classify(byId("website-chatbot").answers).role).toBe("both");
  });
});
