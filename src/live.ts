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

export function recordCheck(c: LiveCheck): void {
  checks.unshift(c);
  if (checks.length > MAX_CHECKS) checks.length = MAX_CHECKS;
}

export const live = new Hono();

live.get("/live", serveStatic({ root: publicDir, path: "live.html" }));
live.get("/live/feed", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ checks });
});
live.get("/public/*", serveStatic({ root: repoRoot }));
