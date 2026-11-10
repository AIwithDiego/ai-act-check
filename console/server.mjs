// Demo console for AI Act Check: a control page on http://localhost:4343.
// Starts the API, runs a check with a real agent (Claude Code, headless) or without AI,
// and streams every step to the page. Node built-ins only, nothing to install.
// Run: node console/server.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const API = (process.env.AI_ACT_CHECK_URL || 'http://localhost:4242').replace(/\/$/, '');
const PORT = Number(process.env.CONSOLE_PORT || 4343);
const WALLET = process.env.DEMO_WALLET || 'demo-agent';
const AGENT_MODEL = process.env.AGENT_MODEL || 'sonnet';
// How the agent pays: 'card' (Stripe test Visa via a Shared Payment Token, shows in the Stripe dashboard)
// or 'tempo' (testnet stablecoin from the demo-agent wallet).
const PAY_METHOD = process.env.PAY_METHOD === 'tempo' ? 'tempo' : 'card';
const TEST_CARD = 'pm_card_visa';
const MPPX = 'mppx@0.17.1';
const WORKSPACE = path.join(REPO, 'out', 'agent-project'); // the agent's "project"; out/ is gitignored
const PRESET_IDS = ['cv-screening', 'website-chatbot', 'callcentre-emotion'];
const PRESET_LABELS = { 'cv-screening': 'CV shortlisting', 'website-chatbot': 'Website chatbot', 'callcentre-emotion': 'Call-centre emotions' };

const cases = JSON.parse(fs.readFileSync(path.join(REPO, 'fixtures', 'cases.json'), 'utf8'));
const presets = PRESET_IDS.map((id) => {
  const c = cases.find((x) => x.id === id);
  return { id, label: PRESET_LABELS[id], text: c.use_case, expect: c.expect.tier };
});

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, opts = {}, ms = 2000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: REPO, env: { ...process.env, ...(opts.env || {}) }, timeout: opts.timeout || 120000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function b64json(s) {
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { return null; }
}

// "0.50 USD" from a WWW-Authenticate: Payment ... header (stripe method in cents, tempo in 6 decimals).
function priceFromChallenge(header) {
  if (!header) return null;
  const reqs = [...header.matchAll(/method="(\w+)"[^]*?request="([^"]+)"/g)];
  for (const [, method, req] of reqs) {
    const r = b64json(req);
    if (!r) continue;
    if (method === 'stripe' && r.currency === 'usd') return (Number(r.amount) / 100).toFixed(2) + ' USD';
    if (method === 'tempo') return (Number(r.amount) / 1e6).toFixed(2) + ' USD';
  }
  return null;
}

// Splits `mppx -i` output into the 402 it was asked, and the final response it got after paying.
function parseMppxOutput(out) {
  const blocks = out.split(/(?=^HTTP\/[\d.]+ \d{3})/m).filter((b) => /^HTTP\//.test(b));
  const parsed = blocks.map((b) => {
    const status = Number(b.match(/^HTTP\/[\d.]+ (\d{3})/)[1]);
    const sep = b.search(/\r?\n\r?\n/);
    const head = sep >= 0 ? b.slice(0, sep) : b;
    const body = sep >= 0 ? b.slice(sep).trim() : '';
    const headers = {};
    for (const line of head.split(/\r?\n/).slice(1)) {
      const i = line.indexOf(':');
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    return { status, headers, body };
  });
  const challenge = parsed.find((p) => p.status === 402) || null;
  const final = parsed.length ? parsed[parsed.length - 1] : null;
  let verdict = null, receipt = null;
  if (final && final.status === 200) {
    try { verdict = JSON.parse(final.body); } catch {}
    const r = b64json(final.headers['payment-receipt'] || '');
    if (r) receipt = { method: r.method, reference: r.reference, at: r.timestamp, status: r.status };
  }
  return { challenge, final, verdict, receipt, price: challenge ? priceFromChallenge(challenge.headers['www-authenticate']) : null };
}

const TIER_WORD = { prohibited: 'Prohibited', high: 'High-risk', limited: 'Limited', minimal: 'Minimal', incomplete: 'Incomplete' };
let cardKey = '', accountId = '';
async function payEnv() {
  if (PAY_METHOD !== 'card') return {};
  if (!cardKey) cardKey = await keychain('stripe-sandbox-secret');
  if (!cardKey) throw new Error('Stripe sandbox key not found in the Keychain');
  if (!accountId) {
    try { accountId = (await (await fetch('https://api.stripe.com/v1/account', { headers: { authorization: `Bearer ${cardKey}` } })).json()).id || ''; } catch {}
  }
  return { MPPX_STRIPE_SECRET_KEY: cardKey };
}
const PAY_FLAGS = PAY_METHOD === 'card' ? `--currency usd -M paymentMethod=${TEST_CARD}` : `-a ${WALLET} --network testnet`;
const payerLabel = PAY_METHOD === 'card' ? 'Stripe test card (Visa)' : `Wallet ${WALLET} (Tempo testnet)`;
const methodLabel = (m) => (m === 'stripe' ? 'Stripe card' : m === 'tempo' ? 'Tempo testnet' : m || 'MPP');
const short = (s, a = 8, b = 4) => (s && s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s || '');

// ---------- status ----------

let walletCache = { at: 0, value: null };
async function walletBalance() {
  if (Date.now() - walletCache.at < 60000 && walletCache.value) return walletCache.value;
  const r = await run('npx', ['-y', MPPX, 'account', 'view', '-a', WALLET, '--network', 'testnet'], { timeout: 30000 });
  const m = r.stdout.match(/Balance\s+([\d_.]+)\s+PathUSD/);
  const value = m ? { ok: true, name: WALLET, balance: Number(m[1].replace(/_/g, '')) } : { ok: false, name: WALLET, error: 'wallet not found' };
  walletCache = { at: Date.now(), value };
  return value;
}

let payCache = { at: 0, value: null };
async function paymentsProbe() {
  // An unpaid POST costs nothing: a ready API answers 402 with the price.
  if (Date.now() - payCache.at < 15000 && payCache.value) return payCache.value;
  let value;
  try {
    const c = cases.find((x) => x.id === 'cv-screening');
    const res = await fetchWithTimeout(`${API}/classify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: c.answers }) });
    if (res.status === 402) value = { ok: true, price: priceFromChallenge(res.headers.get('www-authenticate')) };
    else if (res.status === 503) value = { ok: false, error: 'payments not configured (.env missing?)' };
    else value = { ok: false, error: `unexpected ${res.status}` };
  } catch { value = { ok: false, error: 'no answer' }; }
  payCache = { at: Date.now(), value };
  return value;
}

async function status() {
  let api = { up: false };
  try {
    const r = await fetchWithTimeout(`${API}/health`, {}, 1500);
    const j = await r.json();
    api = { up: r.ok, rules_version: j.rules_version };
    api.live = (await fetchWithTimeout(`${API}/live`, {}, 1500)).ok;
  } catch {}
  const [payments, wallet] = await Promise.all([api.up ? paymentsProbe() : { ok: false, error: 'API down' }, PAY_METHOD === 'card' ? { ok: true, name: 'Stripe test card', card: true } : walletBalance()]);
  return {
    api: { ...api, url: API, managed: !!apiProc, built: fs.existsSync(path.join(REPO, 'package.json')) },
    payments, wallet,
    agentKit: fs.existsSync(path.join(REPO, 'agent', 'SKILL.md')),
    payMethod: PAY_METHOD,
    log: apiLog.slice(-12),
  };
}

// ---------- start / stop the API ----------

let apiProc = null;
const apiLog = [];
const logLine = (s) => { for (const l of String(s).split(/\r?\n/)) if (l.trim()) apiLog.push(l.slice(0, 300)); apiLog.splice(0, Math.max(0, apiLog.length - 200)); };

async function keychain(service) {
  const r = await run('security', ['find-generic-password', '-a', 'diego', '-s', service, '-w']);
  return r.code === 0 ? r.stdout.trim() : '';
}

async function ensureEnv() {
  const envPath = path.join(REPO, '.env');
  if (fs.existsSync(envPath)) return 'kept';
  const key = await keychain('stripe-sandbox-secret');
  const profile = await keychain('stripe-sandbox-profile');
  const tempo = await keychain('stripe-sandbox-tempo-address');
  if (!key || !profile) throw new Error('Stripe sandbox values not found in the Keychain');
  fs.writeFileSync(envPath, `STRIPE_SECRET_KEY=${key}\nSTRIPE_PROFILE_ID=${profile}\n${tempo ? `TEMPO_DEPOSIT_ADDRESS=${tempo}\n` : ''}PRICE_USD=0.60\n`, { mode: 0o600 });
  return 'written';
}

async function startApi() {
  try { if ((await fetchWithTimeout(`${API}/health`, {}, 1000)).ok) return { ok: true, note: 'already running' }; } catch {}
  if (apiProc) return { ok: true, note: 'starting' };
  if (!fs.existsSync(path.join(REPO, 'package.json'))) return { ok: false, error: 'The API is not built yet (Devin builds it from 13:00).' };
  const env = await ensureEnv();
  logLine(`.env ${env} (values from the Keychain, never shown)`);
  const cmd = fs.existsSync(path.join(REPO, 'node_modules')) ? 'npm run dev' : 'npm install && npm run dev';
  logLine(`$ ${cmd}`);
  apiProc = spawn('sh', ['-c', cmd], { cwd: REPO, detached: true, env: { ...process.env, FORCE_COLOR: '0' } });
  apiProc.stdout.on('data', logLine);
  apiProc.stderr.on('data', logLine);
  apiProc.on('exit', (code) => { logLine(`API stopped (exit ${code})`); apiProc = null; payCache.at = 0; });
  payCache.at = 0;
  return { ok: true, note: 'starting' };
}

function stopApi() {
  if (!apiProc) return { ok: false, error: 'The console did not start this API; stop it where it was started.' };
  try { process.kill(-apiProc.pid, 'SIGTERM'); } catch {}
  return { ok: true };
}

// ---------- a run, streamed to the page ----------

const STEPS = ['questions', 'answers', 'challenge', 'pay', 'verdict', 'record'];

function answerSummary(answers) {
  const yes = Object.entries(answers).filter(([k, v]) => v === true).map(([k]) => k.replace(/_/g, ' '));
  const picks = answers.role ? [`role: ${answers.role}`] : [];
  return { count: Object.keys(answers).length, yes, picks };
}

const answerDetail = (a) => `${a.count} answers · ${a.picks.join(' · ')}${a.yes.length ? ` · yes to: ${a.yes.slice(0, 4).join(', ')}` : ' · all no'}`;

async function runDirect(c, send) {
  const body = { use_case: c.use_case, answers: c.answers };
  send({ type: 'say', who: 'console', text: 'No AI this time: the prepared answers for this case, same API, same payment.' });

  send({ type: 'step', id: 'questions', state: 'active' });
  const q = await (await fetchWithTimeout(`${API}/questions`)).json();
  await sleep(700);
  send({ type: 'step', id: 'questions', state: 'done', detail: `GET /questions · ${q.questions.length} questions · free` });

  send({ type: 'step', id: 'answers', state: 'active' });
  await sleep(900);
  const a = answerSummary(c.answers);
  send({ type: 'step', id: 'answers', state: 'done', detail: answerDetail(a), answers: a });

  send({ type: 'step', id: 'challenge', state: 'active' });
  const unpaid = await fetchWithTimeout(`${API}/classify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await sleep(700);
  if (unpaid.status !== 402) throw new Error(`Expected a 402, got ${unpaid.status}`);
  send({ type: 'step', id: 'challenge', state: 'done', detail: `POST /classify → 402 Payment Required · ${priceFromChallenge(unpaid.headers.get('www-authenticate')) || ''}` });

  send({ type: 'step', id: 'pay', state: 'active', detail: `${payerLabel} is paying over Stripe MPP…` });
  const r = await run('npx', ['-y', MPPX, `${API}/classify`, '-i', ...PAY_FLAGS.split(' '), '-J', JSON.stringify(body)], { timeout: 90000, env: await payEnv() });
  handlePaidOutput(r.stdout + (r.code ? `\n${r.stderr}` : ''), send, true);
  send({ type: 'step', id: 'record', state: 'skip', detail: 'Only the agent saves a record' });
}

function handlePaidOutput(out, send, challengeShown = false) {
  const p = parseMppxOutput(out);
  if (p.challenge && !challengeShown) send({ type: 'step', id: 'challenge', state: 'done', detail: `402 Payment Required · ${p.price || ''}` });
  if (!p.final || p.final.status !== 200 || !p.verdict) {
    send({ type: 'step', id: 'pay', state: 'error', detail: p.final ? `The API answered ${p.final.status}: ${p.final.body.slice(0, 160)}` : out.trim().split('\n').slice(-2).join(' ').slice(0, 200) });
    return false;
  }
  send({ type: 'step', id: 'pay', state: 'done', detail: `Paid ${p.price || ''} · ${methodLabel(p.receipt?.method)} · receipt ${short(p.receipt?.reference)}` });
  const v = p.verdict;
  send({ type: 'step', id: 'verdict', state: 'done', detail: `${TIER_WORD[v.tier] || v.tier} · ${v.matched.map((m) => m.article).join(', ') || 'no rule matched'}` });
  const dashboard = p.receipt?.reference?.startsWith('pi_') ? `https://dashboard.stripe.com/${accountId ? accountId + '/' : ''}test/payments/${p.receipt.reference}` : null;
  send({ type: 'verdict', verdict: v, receipt: p.receipt, price: p.price, dashboard });
  return true;
}

const AGENT_BRIEF = (api) => `You are a coding agent working for a small business, and a room of people is watching your steps on a projector. The user describes an AI use case. Find out where it sits under the EU AI Act by calling the AI Act Check API at ${api} and paying for the check.

Before each step, say what you are about to do in one short plain sentence.
1. Get the free questions: \`curl -s ${api}/questions\`
2. Map the use case to an answer for every question that applies. Never ask the user anything: infer from the description, assume the business is the deployer unless it builds or sells the AI, and state your main assumptions in one short line.
3. Pay and classify in one command (it gets the 402, pays and retries; -i shows the 402 and the receipt):
   \`npx -y ${MPPX} ${api}/classify -i ${PAY_FLAGS} -J '<{"use_case": "...", "answers": {...}} as JSON>'\`
   Use exactly these payment flags (${PAY_METHOD === 'card' ? 'a Stripe test card; the key it needs is already in your environment, never print it' : 'the demo-agent testnet wallet'}).
   If it returns 400, fix the answers it lists and run it again.
4. Save the record: write compliance/ai-act-<short-slug>.md with: title "AI Act check: <use case in a few words>", today's date, the tier in words, the matched rules with articles, "What you must do" (obligations grouped AI Act then GDPR, each with its article and date), the receipt reference and amount, rules_version, and the disclaimer last.
5. Finish with 3 to 5 short lines for the user: the tier, why, the top duties, the disclaimer.
If the ai-act-check skill is available, follow it, but use the payment command above (with -i) instead of the one in the skill. Do not use any other tool or website.`;

function prepareWorkspace() {
  fs.mkdirSync(path.join(WORKSPACE, 'compliance'), { recursive: true });
  const skillSrc = path.join(REPO, 'agent', 'SKILL.md');
  const skillDir = path.join(WORKSPACE, '.claude', 'skills', 'ai-act-check');
  if (fs.existsSync(skillSrc)) {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.copyFileSync(skillSrc, path.join(skillDir, 'SKILL.md'));
    return true;
  }
  fs.rmSync(skillDir, { recursive: true, force: true });
  return false;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n');
  return '';
}

async function runAgent(text, send, onChild) {
  const extraEnv = await payEnv();
  return new Promise((resolve) => {
    const withSkill = prepareWorkspace();
    send({ type: 'say', who: 'console', text: withSkill ? 'Agent starts, with the ai-act-check skill installed.' : 'Agent starts (the skill from session 03 is not in yet; it follows the console brief).' });
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project,local', '--model', AGENT_MODEL,
      '--append-system-prompt', AGENT_BRIEF(API),
      '--permission-mode', 'acceptEdits',
      '--disallowedTools', 'WebFetch', 'WebSearch', 'Agent', 'Task',
      '--allowedTools', 'Bash(curl:*)', `Bash(npx -y ${MPPX}:*)`, `Bash(npx ${MPPX}:*)`, 'Bash(mkdir:*)', 'Bash(ls:*)', 'Read', 'Write', 'Skill'];
    const child = spawn('claude', args, { cwd: WORKSPACE, env: { ...process.env, AI_ACT_CHECK_URL: API, ...extraEnv } });
    onChild(child);
    child.stdin.end(text);
    const tools = new Map(); // tool_use id -> kind
    let questionsDone = false, verdictSeen = false, buf = '', errTail = '';
    const kill = setTimeout(() => { send({ type: 'say', who: 'console', text: 'The agent took over 4 minutes; stopped.' }); child.kill('SIGTERM'); }, 240000);

    const onEvent = (ev) => {
      if (ev.type === 'assistant') {
        for (const b of ev.message?.content || []) {
          if (b.type === 'text' && b.text.trim()) send({ type: 'say', who: 'agent', text: b.text.trim() });
          if (b.type !== 'tool_use') continue;
          const cmd = b.name === 'Bash' ? String(b.input?.command || '') : '';
          if (b.name === 'Bash' && /mppx/.test(cmd) && /\/classify/.test(cmd)) {
            tools.set(b.id, 'pay');
            const m = cmd.match(/-J\s+'([^]*)'/);
            let detail = 'Answers ready';
            try { const body = JSON.parse(m[1]); const a = answerSummary(body.answers || {}); detail = answerDetail(a); send({ type: 'step', id: 'answers', state: 'done', detail, answers: a }); } catch { send({ type: 'step', id: 'answers', state: 'done', detail }); }
            send({ type: 'step', id: 'challenge', state: 'active', detail: 'POST /classify without paying…' });
            send({ type: 'step', id: 'pay', state: 'active', detail: `${payerLabel} pays when asked` });
          } else if (b.name === 'Bash' && /\/questions/.test(cmd)) {
            tools.set(b.id, 'questions');
            send({ type: 'step', id: 'questions', state: 'active', detail: `GET /questions` });
          } else if (b.name === 'Bash' && /\/classify/.test(cmd)) {
            tools.set(b.id, 'probe');
            send({ type: 'step', id: 'challenge', state: 'active' });
          } else if (b.name === 'Write' && /compliance\//.test(String(b.input?.file_path || ''))) {
            tools.set(b.id, { kind: 'record', file: String(b.input.file_path) });
            send({ type: 'step', id: 'record', state: 'active', detail: path.basename(String(b.input.file_path)) });
          } else if (b.name === 'Skill') {
            send({ type: 'say', who: 'console', text: 'Agent loaded the ai-act-check skill.' });
          }
          send({ type: 'log', text: `${b.name}: ${cmd || JSON.stringify(b.input).slice(0, 200)}` });
        }
      } else if (ev.type === 'user') {
        for (const b of ev.message?.content || []) {
          if (b.type !== 'tool_result') continue;
          const kind = tools.get(b.tool_use_id);
          const out = textOf(b.content);
          if (kind === 'questions') {
            let n = '';
            try { n = `${JSON.parse(out).questions.length} questions · `; } catch {}
            questionsDone = true;
            send({ type: 'step', id: 'questions', state: b.is_error ? 'error' : 'done', detail: `GET /questions · ${n}free` });
            send({ type: 'step', id: 'answers', state: 'active', detail: 'The agent is reading the use case against each question…' });
          } else if (kind === 'pay') {
            if (handlePaidOutput(out, send)) verdictSeen = true;
          } else if (kind === 'probe') {
            if (/\b402\b/.test(out)) send({ type: 'step', id: 'challenge', state: 'done', detail: '402 Payment Required' });
          } else if (kind && kind.kind === 'record') {
            const file = path.isAbsolute(kind.file) ? kind.file : path.join(WORKSPACE, kind.file);
            const inside = path.resolve(file).startsWith(WORKSPACE + path.sep);
            let content = '';
            try { if (inside) content = fs.readFileSync(file, 'utf8'); } catch {}
            send({ type: 'step', id: 'record', state: b.is_error ? 'error' : 'done', detail: `Saved compliance/${path.basename(file)}` });
            if (content) send({ type: 'record', file: `compliance/${path.basename(file)}`, content });
          }
          send({ type: 'log', text: `→ ${out.slice(0, 300)}` });
        }
      } else if (ev.type === 'result') {
        if (ev.is_error) send({ type: 'say', who: 'console', text: `Agent error: ${String(ev.result || '').slice(0, 200)}` });
      }
    };

    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        try { onEvent(JSON.parse(line)); } catch {}
      }
    });
    child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-400); });
    child.on('exit', (code) => {
      clearTimeout(kill);
      if (!questionsDone && !verdictSeen && code) send({ type: 'say', who: 'console', text: `The agent stopped (exit ${code}). ${errTail.trim().slice(-200)}` });
      resolve(verdictSeen);
    });
    child.on('error', (e) => { clearTimeout(kill); send({ type: 'say', who: 'console', text: `Could not start Claude Code: ${e.message}` }); resolve(false); });
  });
}

async function handleRun(req, res, url) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  let child = null, closed = false;
  const send = (ev) => { if (!closed) res.write(`data: ${JSON.stringify(ev)}\n\n`); };
  req.on('close', () => { closed = true; if (child) child.kill('SIGTERM'); });
  const mode = url.searchParams.get('mode');
  const caseId = url.searchParams.get('case');
  const text = (url.searchParams.get('text') || '').trim().slice(0, 1000);
  send({ type: 'start', mode, steps: STEPS });
  let ok = false;
  try {
    const h = await fetchWithTimeout(`${API}/health`, {}, 1500).catch(() => null);
    if (!h || !h.ok) throw new Error(`The API is not running at ${API}. Press Start API first.`);
    if (mode === 'direct') {
      const c = cases.find((x) => x.id === caseId);
      if (!c) throw new Error('Pick one of the three prepared cases to run without AI.');
      await runDirect(c, send);
      ok = true;
    } else {
      if (!text) throw new Error('Type a use case in the box first.');
      ok = await runAgent(text, send, (c) => { child = c; });
    }
  } catch (e) {
    send({ type: 'say', who: 'console', text: e.message });
  }
  send({ type: 'end', ok });
  closed = true;
  res.end();
}

// ---------- http ----------

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
function sendFile(res, file) {
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/') return sendFile(res, path.join(HERE, 'index.html'));
    if (req.method === 'GET' && p === '/how') return sendFile(res, path.join(REPO, 'docs', 'how-it-works.html'));
    if (req.method === 'GET' && p.startsWith('/public/')) {
      const file = path.resolve(REPO, '.' + p);
      if (!file.startsWith(path.join(REPO, 'public') + path.sep)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }
    if (req.method === 'GET' && p === '/api/status') return json(res, 200, await status());
    if (req.method === 'GET' && p === '/api/presets') return json(res, 200, { presets, api: API, model: AGENT_MODEL });
    if (req.method === 'POST' && p === '/api/start') return json(res, 200, await startApi());
    if (req.method === 'POST' && p === '/api/stop') return json(res, 200, stopApi());
    if (req.method === 'POST' && p === '/api/open-records') { fs.mkdirSync(path.join(WORKSPACE, 'compliance'), { recursive: true }); spawn('open', [path.join(WORKSPACE, 'compliance')]); return json(res, 200, { ok: true }); }
    if (req.method === 'GET' && p === '/api/run') return handleRun(req, res, url);
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: e.message }); else res.end();
  }
});

process.on('SIGINT', () => { if (apiProc) try { process.kill(-apiProc.pid, 'SIGTERM'); } catch {} process.exit(0); });
server.listen(PORT, '127.0.0.1', () => console.log(`Demo console: http://localhost:${PORT}  (API: ${API})`));
