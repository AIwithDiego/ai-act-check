import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import type { Verdict } from "./engine.js";
import { sendFile, sendFrom } from "./static.js";
import { hasStore, pipeline } from "./store.js";

export interface LiveCheck {
  at: string;
  amount: string;
  receipt_id: string;
  verdict: Verdict;
}

const MAX_CHECKS = 20;
const checks: LiveCheck[] = [];
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

// Serverless instances share nothing in memory, so the hosted live screen
// reads the last checks from the shared store when there is one.
const STORE_KEY = "aac:live:checks";
const STORE_TTL_S = 60 * 60 * 24;

export async function recordCheck(c: LiveCheck): Promise<void> {
  checks.unshift(c);
  if (checks.length > MAX_CHECKS) checks.length = MAX_CHECKS;
  if (!hasStore()) return;
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
  if (!hasStore()) return checks;
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

live.get("/live", (c) => sendFile(c, `${publicDir}/live.html`));
live.get("/live/feed", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ checks: await recentChecks() });
});
live.get("/public/*", sendFrom(publicDir, "/public/"));
