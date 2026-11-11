import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classify } from "../src/engine.js";
import type { Answers } from "../src/engine.js";
import { live, recordCheck, type LiveCheck } from "../src/live.js";

const cases = JSON.parse(
  readFileSync(new URL("../fixtures/cases.json", import.meta.url), "utf8"),
) as { id: string; answers: Answers }[];
const cv = cases.find((c) => c.id === "cv-screening")!;

const check = (i: number): LiveCheck => ({
  at: new Date(Date.UTC(2026, 10, 10, 13, i)).toISOString(),
  amount: "0.50",
  receipt_id: `pi_test_${String(i).padStart(4, "0")}`,
  verdict: classify(cv.answers),
});

describe("live screen", () => {
  it("recordCheck keeps the last 20, newest first; GET /live/feed returns them", async () => {
    for (let i = 1; i <= 25; i++) await recordCheck(check(i));
    const res = await live.request("/live/feed");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { checks: LiveCheck[] };
    expect(body.checks).toHaveLength(20);
    expect(body.checks[0].receipt_id).toBe("pi_test_0025");
    expect(body.checks[19].receipt_id).toBe("pi_test_0006");
    expect(body.checks.map((c) => c.receipt_id)).toEqual(
      Array.from({ length: 20 }, (_, k) => `pi_test_${String(25 - k).padStart(4, "0")}`),
    );
    expect(body.checks[0].verdict.tier).toBe("high");
    expect(JSON.stringify(body)).not.toContain("use_case");
  });

  it("GET /live returns the HTML page", async () => {
    const res = await live.request("/live");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('class="ac-screen"');
    expect(html).toContain("/public/live.js");
  });

  it("GET /public/tokens.css returns CSS", async () => {
    const res = await live.request("/public/tokens.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
    expect(await res.text()).toContain(".ac-screen");
  });

  it("GET /public/live.js and /public/live.css are served", async () => {
    const js = await live.request("/public/live.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("javascript");
    const css = await live.request("/public/live.css");
    expect(css.status).toBe(200);
  });

  it("does not serve files outside public/", async () => {
    const res = await live.request("/public/../package.json");
    expect(res.status).toBe(404);
  });
});

describe("live screen shared store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("writes each check to the store and serves the feed from it", async () => {
    vi.stubEnv("UPSTASH_REST_URL", "https://store.test/");
    vi.stubEnv("UPSTASH_REST_TOKEN", "t0ken");
    vi.stubEnv("LIVE_STORE_IN_TESTS", "1");
    const list: string[] = [];
    const calls: { url: string; auth: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).authorization });
      const cmds = JSON.parse(init.body as string) as (string | number)[][];
      return Response.json(
        cmds.map(([op, , a, b]) => {
          if (op === "LPUSH") return { result: list.unshift(a as string) };
          if (op === "LTRIM") return { result: (list.length = Math.min(list.length, (b as number) + 1), "OK") };
          if (op === "LRANGE") return { result: list.slice(0, (b as number) + 1) };
          return { result: 1 };
        }),
      );
    });
    for (let i = 1; i <= 22; i++) await recordCheck(check(i));
    expect(list).toHaveLength(20);
    expect(calls[0]).toEqual({ url: "https://store.test/pipeline", auth: "Bearer t0ken" });
    const body = (await (await live.request("/live/feed")).json()) as { checks: LiveCheck[] };
    expect(body.checks).toHaveLength(20);
    expect(body.checks[0].receipt_id).toBe("pi_test_0022");
    expect(JSON.stringify(body)).not.toContain("use_case");
  });

  it("falls back to memory when the store is down", async () => {
    vi.stubEnv("UPSTASH_REST_URL", "https://store.test");
    vi.stubEnv("UPSTASH_REST_TOKEN", "t0ken");
    vi.stubEnv("LIVE_STORE_IN_TESTS", "1");
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    await recordCheck(check(40));
    const res = await live.request("/live/feed");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checks: LiveCheck[] };
    expect(body.checks[0].receipt_id).toBe("pi_test_0040");
  });
});
