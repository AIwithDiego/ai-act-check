import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Receipt } from "mppx";
import { classify, validate } from "./engine.js";
import { live, recordCheck } from "./live.js";
import { getMppx, priceUsd } from "./payments.js";
import type { Answers } from "./types.js";

const MAX_USE_CASE = 1000;
const PORT = 4242;
const questionsPath = fileURLToPath(new URL("../data/questions.json", import.meta.url));
const outDir = fileURLToPath(new URL("../out/", import.meta.url));
const receiptsPath = `${outDir}receipts.jsonl`;
const rulesVersion = classify({}).rules_version;
const DISCLAIMER = classify({}).disclaimer;

interface ReceiptLine {
  at: string;
  tier: string;
  rules_version: string;
  amount: string;
  receipt_id: string;
}

function lastReceipts(n: number): ReceiptLine[] {
  let text = "";
  try {
    text = readFileSync(receiptsPath, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n").filter(Boolean).slice(-n).reverse();
  return lines.flatMap((l) => {
    try {
      return [JSON.parse(l) as ReceiptLine];
    } catch {
      return [];
    }
  });
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function homePage(base: string): string {
  const rows = lastReceipts(10)
    .map(
      (r) =>
        `<tr><td>${esc(r.at)}</td><td><span class="ac-tier ac-tier--s" data-tier="${esc(r.tier)}"><span class="ac-glyph"></span>${esc(r.tier)}</span></td><td>${esc(r.amount)} USD</td></tr>`,
    )
    .join("");
  const price = esc(priceUsd());
  const wallet = "npx mppx@0.17.1 account create -a me && npx mppx@0.17.1 account fund -a me --network testnet";
  const ask = `Read ${base}/llms.txt and check this under the EU AI Act: <describe the AI feature>. Pay with: npx mppx@0.17.1 <url> -a me --network testnet`;
  const block = (id: string, text: string) =>
    `<div class="cmd"><pre id="${id}">${esc(text)}</pre><button type="button" data-copy="${id}">Copy</button></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Act Check</title>
<link rel="stylesheet" href="/public/tokens.css">
<style>
body{margin:0;min-height:100vh}
main{max-width:52rem;margin:0 auto;padding:48px 20px 64px;font-size:19px;line-height:1.45}
main>*+*{margin-top:22px}
a{color:var(--text)}
h1{font-size:clamp(48px,9vw,96px);margin:0}
.lede{font-size:clamp(20px,2.6vw,26px);color:var(--text);font-weight:600;margin:0}
.note{border-left:6px solid var(--aiwd-hot);background:var(--stage-deep);padding:16px 20px;border-radius:6px}
.note b{color:var(--aiwd-mark-yellow)}
.ac-stage main>h2{font-size:15px;color:var(--text-3);margin-top:48px;font-stretch:var(--w-wide);font-weight:600;letter-spacing:var(--ls-wide)}
.ac-stage main ol{padding-left:28px;margin:12px 0 0;list-style:decimal}
.ac-stage main ol li::marker{color:var(--aiwd-hot);font-weight:800}
.ac-stage main ol li{margin-bottom:18px}
.cmd{display:flex;gap:8px;align-items:stretch;margin-top:8px}
.cmd pre{flex:1;margin:0;background:var(--stage-deep);border:2px solid var(--rule);border-radius:6px;padding:12px 14px;font-size:15px;white-space:pre-wrap;word-break:break-word;color:var(--text)}
.cmd button{font:inherit;font-size:15px;font-weight:600;background:var(--aiwd-hot);color:var(--on-fill);border:0;border-radius:6px;padding:0 16px;cursor:pointer;min-height:44px}
table{border-collapse:collapse;width:100%;font-size:16px}
th,td{text-align:left;padding:8px 16px 8px 0;border-bottom:2px solid var(--rule-soft)}
th{color:var(--text-2)}
code{font-size:.9em;background:var(--stage-deep);padding:1px 6px;border-radius:4px}
</style>
</head>
<body class="ac-stage">
<main>
<h1 class="ac-cond">AI Act Check</h1>
<p class="lede">Where does an AI use case sit under the EU AI Act? Risk tier, articles, duties for your role, GDPR overlap and dates. ${price} USD per check.</p>
<p class="note"><b>This is an API for AI agents, not a website.</b> There is no form here. Your coding agent (Claude Code, Cursor, Codex or any agent that can run commands) reads the questions, answers them for your use case, pays over Stripe's Machine Payments Protocol and gets the verdict with a receipt.</p>

<h2>TRY IT WITH YOUR AGENT, 2 MINUTES, FREE TEST MONEY</h2>
<ol>
<li>Create a test wallet with free testnet money (run it in your terminal):${block("c1", wallet)}</li>
<li>Paste this to your agent, with your own use case:${block("c2", ask)}</li>
<li>Watch it work: it reads the free questions, gets an HTTP 402 asking for ${price} USD, pays with test money, and gives you the tier, the articles and what you must do.</li>
</ol>

<h2>FOR DEVELOPERS</h2>
<p><a href="/llms.txt">/llms.txt</a> how an agent uses it &middot; <a href="/openapi.json">/openapi.json</a> the API &middot; <a href="/questions">/questions</a> the questionnaire (free) &middot; <code>POST /classify</code> paid, ${price} USD over MPP</p>
${rows ? `<h2>LAST PAID CHECKS</h2><table><thead><tr><th>Time</th><th>Tier</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
<p class="ac-disclaimer">${esc(DISCLAIMER)} Nothing about your use case is stored. Built at the MPP Hackathon Dublin, 10 Nov 2026, by Diego Bauer (AI with Diego) with Devin.</p>
</main>
<script>
document.querySelectorAll("[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    var t = document.getElementById(b.getAttribute("data-copy")).textContent;
    navigator.clipboard.writeText(t).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); });
  });
});
</script>
</body>
</html>
`;
}

function llmsTxt(): string {
  return `# AI Act Check

> Pay-per-call API: where an AI use case sits under the EU AI Act (Regulation (EU) 2024/1689), plus overlapping GDPR duties. Rule-based, no LLM. Same answers, same verdict.

Price: ${priceUsd()} USD per POST /classify, paid over MPP (Machine Payments Protocol, HTTP 402). Everything else is free.

## How to use it

1. GET /questions (free): the questionnaire. Each question has an id, a type (boolean or enum with options), and may have ask_if.
2. Map your use case to answers: { "<question id>": true | false | "<option>" }. Answer every required question you can.
3. POST /classify with JSON { "use_case": "optional, max 1000 chars, never stored", "answers": { ... } }.
   - Bad JSON or invalid answers: 400 with the list, before any payment.
   - Otherwise 402 with a WWW-Authenticate: Payment challenge. Pay over MPP and retry (e.g. npx mppx@0.17.1 <url>).
   - Paid: 200 with the verdict and a Payment-Receipt header.

## Response (Verdict)

{ "tier": "prohibited" | "high" | "limited" | "minimal" | "incomplete",
  "role": string | null,
  "matched": [{ "id", "tier", "title", "article", "note"? }],
  "obligations": [{ "law": "AI Act" | "GDPR", "text", "article", "role", "applies_from", "key"? }],
  "gdpr_short": string[], "missing": string[], "invalid": string[],
  "rules_version": string, "disclaimer": string }

tier "incomplete" means required answers are missing (listed in "missing"); it is still a paid 200.

Other routes: GET /health, GET /openapi.json, GET /live, GET /live/feed.

Nothing about your use case or answers is stored; the receipts log holds time, tier, amount and receipt id only.

Disclaimer: ${DISCLAIMER}
`;
}

function openapi() {
  const json = (schema: object) => ({ "application/json": { schema } });
  const error = { type: "object", properties: { error: { type: "string" }, invalid: { type: "array", items: { type: "string" } } } };
  const verdict = {
    type: "object",
    required: ["tier", "role", "matched", "obligations", "gdpr_short", "missing", "invalid", "rules_version", "disclaimer"],
    properties: {
      tier: { type: "string", enum: ["prohibited", "high", "limited", "minimal", "incomplete"] },
      role: { type: ["string", "null"] },
      matched: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, tier: { type: "string" }, title: { type: "string" }, article: { type: "string" }, note: { type: "string" } },
        },
      },
      obligations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            law: { type: "string", enum: ["AI Act", "GDPR"] },
            text: { type: "string" },
            article: { type: "string" },
            role: { type: "string" },
            applies_from: { type: "string" },
            key: { type: "boolean" },
          },
        },
      },
      gdpr_short: { type: "array", items: { type: "string" } },
      missing: { type: "array", items: { type: "string" } },
      invalid: { type: "array", items: { type: "string" } },
      rules_version: { type: "string" },
      disclaimer: { type: "string" },
    },
  };
  const ok = (description: string, content?: object) => ({ "200": { description, ...(content ? { content } : {}) } });
  return {
    openapi: "3.1.0",
    info: {
      title: "AI Act Check",
      version: rulesVersion,
      description: "Where an AI use case sits under the EU AI Act: tier, articles, obligations by role, dates, GDPR duties. Not legal advice.",
    },
    paths: {
      "/": { get: { summary: "Status page: what it is, price, last 10 paid calls", responses: ok("HTML page", { "text/html": { schema: { type: "string" } } }) } },
      "/health": {
        get: {
          summary: "Health check",
          responses: ok("OK", json({ type: "object", properties: { ok: { type: "boolean" }, rules_version: { type: "string" } } })),
        },
      },
      "/questions": { get: { summary: "The questionnaire (data/questions.json)", responses: ok("Questions", json({ type: "object" })) } },
      "/llms.txt": { get: { summary: "How an agent uses this API", responses: ok("Plain text", { "text/plain": { schema: { type: "string" } } }) } },
      "/openapi.json": { get: { summary: "This document", responses: ok("OpenAPI 3.1", json({ type: "object" })) } },
      "/classify": {
        post: {
          summary: "Classify an AI use case under the EU AI Act (paid)",
          "x-payment-info": {
            price: priceUsd(),
            currency: "USD",
            protocol: "mpp",
            description: "EU AI Act tier, articles, obligations by role, GDPR duties, receipt",
          },
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["answers"],
              properties: {
                use_case: { type: "string", maxLength: MAX_USE_CASE, description: "Optional, echoed back, never stored" },
                answers: { type: "object", additionalProperties: { type: ["boolean", "string"] } },
              },
            }),
          },
          responses: {
            "200": { description: "Verdict, with a Payment-Receipt header", content: json(verdict) },
            "400": { description: "Malformed JSON or invalid answers (checked before payment)", content: json(error) },
            "402": { description: "Payment required: MPP challenge in the WWW-Authenticate: Payment header" },
            "503": { description: "Payments not configured", content: json(error) },
          },
        },
      },
      "/live": { get: { summary: "Live screen for the room", responses: ok("HTML page", { "text/html": { schema: { type: "string" } } }) } },
      "/live/feed": {
        get: {
          summary: "Recent paid checks, newest first, max 20",
          responses: ok("Feed", json({ type: "object", properties: { checks: { type: "array", items: { type: "object" } } } })),
        },
      },
      "/public/{path}": {
        get: {
          summary: "Static files from public/",
          parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
          responses: ok("File"),
        },
      },
    },
  };
}

export const app = new Hono();

app.get("/", (c) => c.html(homePage(new URL(c.req.url).origin)));
app.get("/health", (c) => c.json({ ok: true, rules_version: rulesVersion }));
app.get("/questions", (c) => c.body(readFileSync(questionsPath, "utf8"), 200, { "content-type": "application/json; charset=utf-8" }));
app.get("/llms.txt", (c) => c.text(llmsTxt()));
app.get("/openapi.json", (c) => c.json(openapi()));

app.post("/classify", async (c) => {
  let body: unknown;
  try {
    body = JSON.parse(await c.req.raw.clone().text());
  } catch {
    return c.json({ error: "malformed JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return c.json({ error: "body must be a JSON object" }, 400);
  const { use_case, answers } = body as { use_case?: unknown; answers?: unknown };
  if (use_case !== undefined && typeof use_case !== "string") return c.json({ error: "use_case must be a string" }, 400);
  if (typeof use_case === "string" && use_case.length > MAX_USE_CASE) {
    return c.json({ error: `use_case is over ${MAX_USE_CASE} characters` }, 400);
  }
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return c.json({ error: "answers must be an object" }, 400);
  const { invalid } = validate(answers as Answers);
  if (invalid.length > 0) return c.json({ error: "invalid answers", invalid }, 400);

  const mppxReady = getMppx();
  if (!mppxReady) return c.json({ error: "payments not configured" }, 503);
  const mppx = await mppxReady;
  const amount = priceUsd();
  const r = await mppx.charge({ amount })(c.req.raw);
  if (r.status === 402) return r.challenge;

  const verdict = classify(answers as Answers);
  const res = r.withReceipt(Response.json(typeof use_case === "string" ? { ...verdict, use_case } : verdict));
  let receipt_id = "";
  try {
    receipt_id = Receipt.fromResponse(res).reference;
  } catch {}
  const at = new Date().toISOString();
  const line: ReceiptLine = { at, tier: verdict.tier, rules_version: verdict.rules_version, amount, receipt_id };
  try {
    mkdirSync(outDir, { recursive: true });
    appendFileSync(receiptsPath, `${JSON.stringify(line)}\n`);
  } catch (err) {
    console.error("receipts log write failed:", err);
  }
  recordCheck({ at, amount, receipt_id, verdict });
  return res;
});

app.route("/", live);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, (info) => {
    console.log(`AI Act Check on http://localhost:${info.port}`);
  });
}
