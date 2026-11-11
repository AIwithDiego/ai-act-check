import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { Receipt } from "mppx";
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";
import { priceUsd } from "./payments.js";
import { hasStore, pipeline } from "./store.js";
import type { Answers } from "./types.js";

// Hosted console: anyone in the room runs one of three prepared cases from a
// phone. The server pays for the check itself, from a Tempo testnet wallet
// that only holds test money, by calling its own /classify like any agent.

interface ConsoleCase {
  id: string;
  label: string;
  use_case: string;
  answers: Answers;
}

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const cases = JSON.parse(readFileSync(`${publicDir}/console-cases.json`, "utf8")) as ConsoleCase[];

const LOCK_KEY = "aac:console:lock";
const LOCK_S = 10;
const DAILY_CAP = 400;
const BUSY = "Someone else is running a check. Try again in a few seconds.";

type Client = ReturnType<typeof createClient>;
let client: Client | undefined;

function createClient(key: `0x${string}`) {
  return Mppx.create({ methods: [tempo({ account: privateKeyToAccount(key) })], polyfill: false });
}

function getClient(): Client | null {
  const key = process.env.CONSOLE_WALLET_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  client ??= createClient(key as `0x${string}`);
  return client;
}

/** One run at a time and a daily ceiling, so a public button can't be hammered. */
async function admit(): Promise<string | null> {
  if (!hasStore()) return null;
  const day = `aac:console:day:${new Date().toISOString().slice(0, 10)}`;
  try {
    const [lock, count] = await pipeline([
      ["SET", LOCK_KEY, "1", "NX", "EX", LOCK_S],
      ["INCR", day],
      ["EXPIRE", day, 60 * 60 * 48],
    ]);
    if (lock?.result !== "OK") return BUSY;
    if (typeof count?.result === "number" && count.result > DAILY_CAP) return "The console has done its checks for today.";
  } catch (err) {
    console.error("console limiter failed:", err);
  }
  return null;
}

export const consoleApp = new Hono();

consoleApp.get("/console", serveStatic({ root: publicDir, path: "console.html" }));

consoleApp.get("/console/cases", (c) =>
  c.json({ price: priceUsd(), cases: cases.map(({ id, label, use_case }) => ({ id, label, use_case })) }),
);

consoleApp.post("/console/run", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "malformed JSON" }, 400);
  }
  const id = body && typeof body === "object" ? (body as { case?: unknown }).case : undefined;
  const chosen = cases.find((x) => x.id === id);
  if (!chosen) return c.json({ error: "unknown case" }, 400);

  const mppx = getClient();
  if (!mppx) return c.json({ error: "The console wallet is not set up on this deployment." }, 503);
  const refused = await admit();
  if (refused) return c.json({ error: refused, busy: refused === BUSY }, 429);

  const url = `${process.env.CONSOLE_TARGET || new URL(c.req.url).origin}/classify`;
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: chosen.answers }),
  };
  const t0 = Date.now();
  try {
    const asked = await mppx.rawFetch(url, init);
    await asked.body?.cancel();
    const t1 = Date.now();
    if (asked.status !== 402) return c.json({ error: `The API answered ${asked.status} before payment.` }, 502);

    const paid = await mppx.fetch(url, init);
    const t2 = Date.now();
    if (!paid.ok) return c.json({ error: `The payment did not go through (${paid.status}).` }, 502);
    let receipt_id = "";
    try {
      receipt_id = Receipt.fromResponse(paid).reference;
    } catch {}
    const verdict = await paid.json();
    c.header("Cache-Control", "no-store");
    return c.json({
      case: chosen.id,
      amount: priceUsd(),
      network: "Tempo testnet",
      receipt_id,
      asked_ms: t1 - t0,
      paid_ms: t2 - t1,
      verdict,
    });
  } catch (err) {
    console.error("console run failed:", err);
    return c.json({ error: "The check failed on the way. Try again." }, 502);
  } finally {
    // The lock exists so two payments never leave the wallet at once; free it as soon as this one is done.
    if (hasStore()) await pipeline([["DEL", LOCK_KEY]]).catch(() => {});
  }
});
