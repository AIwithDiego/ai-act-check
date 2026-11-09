# 04 · Live screen

Paste everything below the line into a Devin session. Runs **at the same time** as 01, 02 and 03.

---

You are building the live screen for **AI Act Check** in the repo `AIwithDiego/ai-act-check`. It is projected next to the presenter's terminal while an AI agent pays for checks live; each paid check appears on it as it lands.

**Read first, in this order:** `docs/brief.md`, `docs/contract.md` (sections 2, 3 and 3.1 are yours), `docs/design-spec.md`, then open `docs/design-system.html` and `docs/live-screen-mock.html` in a browser. The mock is the target: your job is to make it live, not to redesign it.

**You own these files (create or edit only these):**
- `src/live.ts` (exactly the interface in contract 3.1: `LiveCheck`, `recordCheck`, the `live` Hono router with `GET /live`, `GET /live/feed`, `GET /public/*`)
- `public/live.html`, `public/live.css`, `public/live.js`
- `tests/live.test.ts`

`public/tokens.css` and everything in `docs/` are the design system: read-only. Reuse their class names and tokens; if something is missing, add it to `public/live.css` and say so in the PR.

**Build:**
1. `src/live.ts`: an in-memory array, newest first, capped at 20. `recordCheck` pushes; nothing is ever written to disk. Serve `public/` with `serveStatic` from `@hono/node-server/serve-static` (add nothing else).
2. `public/live.html` + `live.js`: plain HTML, CSS and vanilla JS, no framework, no build step. Poll `/live/feed` every 1.5 s. Render the newest check as the main verdict card and the older ones in the feed, exactly as in the mock. Animate only a newly arrived check (as the spec says), respect `prefers-reduced-motion`. States: idle (no checks yet), incomplete verdict, feed unreachable (status dot goes red, last screen stays).
3. Obligations grouped by `law`, AI Act first, following the spec's rule for long lists (CV screening has ~22).
4. Whose result is it: above the tier word, `Latest check · bought by an agent at HH:MM`; the strip says `Earlier checks`. The screen is the API owner's view, every check is a different customer (see the end of `docs/design-spec.md`).
5. Escape every string you put into the DOM (`textContent`, never `innerHTML` with data).

**Done when:**
- `npm test` passes with `tests/live.test.ts`: `recordCheck` caps at 20 and orders newest first; `GET /live/feed` returns them; `GET /live` returns HTML; `GET /public/tokens.css` returns CSS.
- With the server running (session 02, or a 10-line throwaway script that mounts `live` and calls `recordCheck` with the CV-screening verdict from the fixtures), `/live` at 1920x1080 matches `docs/live-screen-mock.html` closely. Put two screenshots in the PR (1920x1080 and 1280x720).

**Do not:** edit `docs/`, `public/tokens.css`, `data/`, `fixtures/`, `src/server.ts` or `src/engine.ts`; add a frontend framework, a bundler or web sockets; show any use-case text (there is none in the verdict, keep it that way).

**If stuck:** after two failed attempts at the same problem, stop and write what you tried and what failed in the PR description.

**Finish:** open one PR titled `Live screen` with a 5-line summary, the test output and the two screenshots.
