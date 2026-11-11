import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Verdict } from "./engine.js";

export interface LiveCheck {
  at: string;
  amount: string;
  receipt_id: string;
  verdict: Verdict;
}

const MAX_CHECKS = 20;
const checks: LiveCheck[] = [];
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

// Shared store: Upstash Redis over REST, provisioned with Stripe Projects.
// Serverless instances share nothing in memory, so the hosted live screen
// reads the last checks from here. Without the env vars (local dev, tests)
// the in-memory list is the store.
const STORE_KEY = "aac:live:checks";
const STORE_TTL_S = 60 * 60 * 24;
const STORE_TIMEOUT_MS = 2500;

function store(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REST_URL;
  const token = process.env.UPSTASH_REST_TOKEN;
  if (!url || !token) return null;
  if (process.env.VITEST && !process.env.LIVE_STORE_IN_TESTS) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function pipeline(cmds: (string | number)[][]): Promise<{ result?: unknown; error?: string }[]> {
  const s = store();
  if (!s) throw new Error("no store");
  const res = await fetch(`${s.url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`store answered ${res.status}`);
  return (await res.json()) as { result?: unknown; error?: string }[];
}

export async function recordCheck(c: LiveCheck): Promise<void> {
  checks.unshift(c);
  if (checks.length > MAX_CHECKS) checks.length = MAX_CHECKS;
  if (!store()) return;
  try {
    await pipeline([
      ["LPUSH", STORE_KEY, JSON.stringify(c)],
      ["LTRIM", STORE_KEY, 0, MAX_CHECKS - 1],
      ["EXPIRE", STORE_KEY, STORE_TTL_S],
    ]);
  } catch (err) {
    console.error("live store write failed:", err);
  }
}

async function recentChecks(): Promise<LiveCheck[]> {
  if (!store()) return checks;
  try {
    const [r] = await pipeline([["LRANGE", STORE_KEY, 0, MAX_CHECKS - 1]]);
    if (!Array.isArray(r?.result)) throw new Error(r?.error ?? "unexpected store reply");
    return (r.result as string[]).map((x) => JSON.parse(x) as LiveCheck);
  } catch (err) {
    console.error("live store read failed:", err);
    return checks;
  }
}

export const live = new Hono();

live.get("/live", serveStatic({ root: publicDir, path: "live.html" }));
live.get("/live/feed", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ checks: await recentChecks() });
});
live.get("/public/*", serveStatic({ root: repoRoot }));
