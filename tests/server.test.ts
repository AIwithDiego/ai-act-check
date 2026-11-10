import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/server.js";

const ENV = ["STRIPE_SECRET_KEY", "STRIPE_PROFILE_ID", "TEMPO_DEPOSIT_ADDRESS", "PRICE_USD", "MPP_SECRET_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const withDummyStripe = () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_not_a_real_key";
  process.env.STRIPE_PROFILE_ID = "profile_test_dummy";
};

const json = (res: Response): Promise<any> => res.json();

const classify = (body: string) =>
  app.request("/classify", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("free routes", () => {
  for (const path of ["/", "/health", "/questions", "/llms.txt", "/openapi.json"]) {
    it(`GET ${path} → 200`, async () => {
      const res = await app.request(path);
      expect(res.status).toBe(200);
    });
  }

  it("GET /health has rules_version", async () => {
    const body = await json(await app.request("/health"));
    expect(body.ok).toBe(true);
    expect(typeof body.rules_version).toBe("string");
  });

  it("GET /llms.txt is plain text under 40 lines with the price", async () => {
    process.env.PRICE_USD = "0.50";
    const res = await app.request("/llms.txt");
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    const text = await res.text();
    expect(text.trimEnd().split("\n").length).toBeLessThan(40);
    expect(text).toContain("0.50 USD");
  });

  it("GET / links tokens.css and uses no external assets", async () => {
    const html = await (await app.request("/")).text();
    expect(html).toContain('href="/public/tokens.css"');
    expect(html).not.toMatch(/(src|href)="https?:/);
  });
});

describe("GET /openapi.json", () => {
  it("is OpenAPI 3.1 with x-payment-info on POST /classify", async () => {
    process.env.PRICE_USD = "0.75";
    const doc = await json(await app.request("/openapi.json"));
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/classify"].post["x-payment-info"]).toEqual({
      price: "0.75",
      currency: "USD",
      protocol: "mpp",
      description: "EU AI Act tier, articles, obligations by role, GDPR duties, receipt",
    });
    for (const p of ["/", "/health", "/questions", "/llms.txt", "/openapi.json", "/live", "/live/feed"]) {
      expect(doc.paths[p]).toBeDefined();
    }
  });

  it("defaults the price to 0.50", async () => {
    const doc = await json(await app.request("/openapi.json"));
    expect(doc.paths["/classify"].post["x-payment-info"].price).toBe("0.50");
  });
});

describe("POST /classify", () => {
  it("bad JSON → 400", async () => {
    withDummyStripe();
    const res = await classify("{not json");
    expect(res.status).toBe(400);
  });

  it("missing answers → 400", async () => {
    withDummyStripe();
    expect((await classify("{}")).status).toBe(400);
  });

  it("invalid answers → 400 with the list, and no 402", async () => {
    withDummyStripe();
    const res = await classify(JSON.stringify({ answers: { role: "wizard", not_a_question: true } }));
    expect(res.status).toBe(400);
    expect(res.headers.get("www-authenticate")).toBeNull();
    const body = await json(res);
    expect(body.invalid).toEqual(expect.arrayContaining(["role", "not_a_question"]));
  });

  it("use_case over 1000 chars → 400", async () => {
    withDummyStripe();
    const res = await classify(JSON.stringify({ use_case: "x".repeat(1001), answers: { role: "deployer" } }));
    expect(res.status).toBe(400);
  });

  it("payments not configured → 503", async () => {
    const res = await classify(JSON.stringify({ answers: { role: "deployer" } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments not configured" });
  });

  it("valid body without payment → 402 with WWW-Authenticate: Payment", async () => {
    withDummyStripe();
    const res = await classify(JSON.stringify({ use_case: "A chatbot on our website", answers: { role: "deployer" } }));
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toMatch(/^Payment /);
  });
});
