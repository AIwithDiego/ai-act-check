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
    const offers = doc.paths["/classify"].post["x-payment-info"].offers;
    expect(offers.map((o: { method: string }) => o.method)).toEqual(["stripe", "tempo"]);
    expect(offers[0]).toMatchObject({ amount: "75", currency: "usd", intent: "charge" });
    expect(offers[1]).toMatchObject({ amount: "750000", intent: "charge" });
    expect(doc["x-service-info"].docs.llms).toMatch(/\/llms\.txt$/);
    for (const p of ["/", "/health", "/questions", "/llms.txt", "/openapi.json", "/live", "/live/feed"]) {
      expect(doc.paths[p]).toBeDefined();
    }
  });

  it("defaults the price to 0.60", async () => {
    const doc = await json(await app.request("/openapi.json"));
    expect(doc.paths["/classify"].post["x-payment-info"].offers[0].amount).toBe("60");
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

describe("hosted console", () => {
  it("GET /console returns the page and GET /console/cases the three cases without answers", async () => {
    const page = await app.request("/console");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("demo console");
    const res = await app.request("/console/cases");
    const body = (await res.json()) as { price: string; cases: Record<string, unknown>[] };
    expect(body.cases.map((c) => c.id)).toEqual(["cv-screening", "website-chatbot", "callcentre-emotion"]);
    expect(body.cases.every((c) => !("answers" in c))).toBe(true);
  });

  it("POST /console/run refuses unknown cases and says so when the wallet is missing", async () => {
    const post = (b: unknown) =>
      app.request("/console/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    expect((await post({ case: "nope" })).status).toBe(400);
    const saved = process.env.CONSOLE_WALLET_KEY;
    delete process.env.CONSOLE_WALLET_KEY;
    expect((await post({ case: "cv-screening" })).status).toBe(503);
    if (saved) process.env.CONSOLE_WALLET_KEY = saved;
  });
});

describe("static files", () => {
  it("ignore date checks, answer 304 only to a matching ETag, and stay inside public/", async () => {
    const stale = await app.request("/console", { headers: { "if-modified-since": "Sat, 20 Oct 2018 01:46:40 GMT" } });
    expect(stale.status).toBe(200);
    expect(stale.headers.get("last-modified")).toBeNull();
    expect(stale.headers.get("cache-control")).toBe("no-cache");
    const etag = stale.headers.get("etag")!;
    expect((await app.request("/console", { headers: { "if-none-match": etag } })).status).toBe(304);
    expect((await app.request("/public/live.js")).headers.get("content-type")).toContain("javascript");
    expect((await app.request("/public/%2e%2e/package.json")).status).toBe(404);
    expect((await app.request("/public/nope.css")).status).toBe(404);
  });
});
