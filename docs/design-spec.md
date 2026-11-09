# Design spec: live screen (`/live`)

For session 04. Target: `docs/live-screen-mock.html` (keys 1-6 switch state, R replays the arrival). Classes and tokens: `public/tokens.css`, documented in `docs/design-system.html` (section numbers below). Your job is to make the mock live: `live.js` builds the same markup from `/live/feed`; `live.css` should stay near empty.

## Page
- `live.html`: `<html lang="en">`, `<body class="ac-stage">`, one `<div class="ac-screen" id="screen" aria-live="polite">` as a **direct child of body**. Link Google Fonts Archivo exactly as the mock, then `/public/tokens.css`, then `/public/live.css`.
- Copy the mock's `<style>:root{--logo:url("data:image/png;base64,…")}</style>` line as is (the site logo).
- The screen is a fixed 1920x1080 canvas; `--u` scales it. Never add media queries or scrolling.
- Fit guard: after render, if `.ac-answer` is wider than `.ac-verdict`, scale its `font-size` down to fit (only matters if the fallback font loads).

## Layout (design-system §24)
`.ac-bar` (84) / `.ac-main` (3 columns: `.ac-verdict` 560, `.ac-col` AI Act 820, `.ac-col` GDPR rest) / `.ac-feed` (140).
- Bar: logo, `h1.ac-bar__product` "AI Act Check", then `.ac-bar__end`: "**0.50 USD** per check", "Earned **X USD** from N checks" (sum of `amount` over the feed; none: "No checks yet"), `.ac-status` "Live".
- Verdict column, in this order: `.ac-paid` (§14), `h2.ac-answer` (§11), `.ac-answer-line`, up to two `.ac-rule` (matched rules with `tier === verdict.tier`, articles split on ", " into `.ac-chip`), one `.ac-date` "Applies from …" (latest `applies_from` among AI Act duties), `.ac-disclaimer` (`disclaimer` + " Rules version " + `rules_version`).
- AI Act column: `.ac-law[data-law="ai-act"]` with count "N duties" + " for the deployer" / " for the provider" / " for provider and deployer"; then one `.ac-when` per distinct `applies_from` (date tag + "N duties"), each followed by `ul.ac-obs` of `li.ac-ob`.
- GDPR column: `.ac-law[data-law="gdpr"]` "N duties" (none: "None in this answer", nothing else; when the tier is `prohibited`: "Not checked: the use itself is banned."); one `.ac-when` (earliest date); one `li.ac-ob.ac-ob--rule.ac-ob--stack` per matched rule whose id starts with `gdpr-` (drop the "GDPR " / "GDPR: " prefixes, capitalise the first letter only); `p.ac-more` "All N are in the agent's answer."
- Feed: newest check is the main card; the next 4 go in `.ac-feed` as `li.ac-feed__item` (newest left). Empty: `li.ac-feed__empty` "Paid checks line up here."

## Long lists (22 obligations): AI Act in full, GDPR collapsed to its matched rules
Why: the AI Act duties are what the agent paid for and change per tier; GDPR is the same baseline whenever personal data is used, so the room needs the names (DPIA, Art. 22), not 12 lines.
Overflow: after render, while the AI Act `.ac-col` has `scrollHeight > clientHeight`, set `hidden` on its last visible `.ac-ob` and show `p.ac-more` "+ k more in the agent's answer". Rows are date-sorted, so in-force duties are never the ones cut. Never shrink type or scroll.

## Derived values
- Role: `verdict.role` (provider / deployer / both; null = no role text). Show `.ac-ob__role` (inside `.ac-ob__art`, "Provider"/"Deployer") only when both.
- Dates: `Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short',year:'numeric'})` gives "2 Dec 2027". `.is-now` "In force since …" when `applies_from` ≤ today, else `.is-later` "From …". Times: `HH:MM:SS`, `timeZone:'Europe/Dublin'`, 24 h.
- `data-tier` = `verdict.tier` on `.ac-answer`, `.ac-answer-line`, `.ac-tier`. `--chars` on `.ac-answer`: prohibited 10, high 9, limited 7, minimal 7.6, incomplete 11.4.
- Feed key article: first article of the first winning-tier rule; incomplete: "N questions open". Duties: "N duty/duties".

## Words (fixed microcopy; checked by Smith 9 Nov)
| tier | `.ac-answer` | `.ac-answer-line` |
|---|---|---|
| prohibited | Prohibited | Banned in the EU. |
| high | High-risk | Allowed, with strict duties. |
| limited | Limited | Allowed if people know it's AI. |
| minimal | Minimal | Allowed. Few AI Act duties. |
| incomplete | Incomplete | Not enough answers to decide. |
Paid: "Paid 0.50 USD" + `<span>over Stripe MPP</span>`; "Receipt " + id in full; time.

## States
- Idle (no checks): mock state 5, markup as is (`.ac-idle`, `.ac-steps`). Status still "Live".
- Incomplete: mock state 4. `.ac-main.ac-main--wide`; right side `.ac-law` "Still to answer" / "N questions", `ul.ac-missing` of `missing` ids with `_` → space, `p.ac-more` "The agent got this list back. It answers these and checks again."
- Offline: after 2 failed polls in a row, replace `.ac-status` with the mock's `.ac-banner` ("Can't reach the server." / "Last check stays up."). Keep the last render. Next good poll restores "Live".

## Arrival (design-system §07)
Track the newest `receipt_id`. When it changes: render, then `screen.classList.remove('is-new'); void screen.offsetWidth; screen.classList.add('is-new')`. tokens.css does the rest: paid line fades in (0 ms), marker sweeps the word (160 ms, 34 ms per letter), the rest fades (520 ms), the new feed cell slides in. Same receipt on the next poll: do not re-render, so nothing re-animates. Reduced motion is handled by tokens.css.

## Must not
Use-case text anywhere. `innerHTML` with data (build with `createElement` + `textContent`). New colours, fonts or radii (add to `live.css` only if missing, and name it in the PR). Any idle animation, pulsing dot or per-row stagger.

## Check before the PR
Screenshots at 1920x1080 and 1280x720 must match the mock (same picture, scaled). Run the CV-screening, chatbot and call-centre verdicts plus the `incomplete` fixture through `recordCheck`. All AI Act rows show for the deployer CV case; nothing overlaps the feed.
