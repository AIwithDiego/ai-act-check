# Design spec: live screen (`/live`), v2 keynote layout

For session 04. Target: `docs/live-screen-mock.html` (keys 1-6 switch state, R replays the arrival). Classes and tokens: `public/tokens.css`, shown in `docs/design-system.html` (group "Screen"; the "Library" group is not on the screen). Make the mock live: `live.js` builds the same markup from `/live/feed`; `live.css` should stay near empty. The room reads it in 3 seconds from 10 m: a keynote slide, not a dashboard.

## Page
- `<html lang="en">`, `<body class="ac-stage">`, one `<div class="ac-screen" id="screen" aria-live="polite">` as a **direct child of body**: it then fills any viewport (16:9 or not); type scales with the smaller axis. No media queries, no scrolling.
- Link Archivo from Google Fonts exactly as the mock, then `/public/tokens.css`, then `/public/live.css`. Copy the mock's `<style>:root{--logo:url("data:…")}</style>` line as is.

## Structure (copy the mock's markup)
`header.ac-bar`: logo, `h1.ac-bar__product` "AI Act Check", `.ac-bar__end`: "Earned **X USD** from N checks" (sum of `amount` over the feed; none: "No checks yet") and `.ac-status` "Live".
`main.ac-slide` > `.ac-slide__body` (hero, then todo) + `p.ac-disclaimer` (one line: `disclaimer` + " Rules version " + `rules_version`).
`footer.ac-strip`: left `p.ac-strip__paid` = tick + `<span><b>Paid {amount} USD</b> · receipt {id} · {HH:MM}</span>`, id shortened to first 8 + "…" + last 4; none yet: "Paid checks line up here." Right `.ac-strip__earlier`: "Earlier" + `ul.ac-strip__pills` of up to 4 `li.ac-pill[data-tier]` (glyph, `b` tier word, `time` HH:MM), newest first.

## Hero (`.ac-hero`)
`h2.ac-answer[data-tier][style="--chars:…"] > span.ac-mark` word; `p.ac-meaning[data-tier]` glyph + sentence; `p.ac-why`.
- Why line = short title · short article · when, joined with " · ". From the first `matched` rule with `tier === verdict.tier`: short title = title cut at " (" then at " and " ("Employment and workers management" → "Employment"); short article = "Annex X" if the article has an Annex part ("Annex III"), else its first part ("Art. 5(1)(f)"). When = latest AI Act `applies_from`: "from 2 Dec 2027" if after today, else "since 2 Feb 2025".
- Incomplete: why line "N questions unanswered".

## What you must do (`section.ac-todo[data-tier]`)
`h3.ac-todo__head` "What you must do", `ul.ac-todo__list` of at most 3 `li` (plain `text`, no article), then `p.ac-gdpr`, then `p.ac-more`.
- Duties: obligations with `key: true` (max 3). If none are marked: the first 3 AI Act obligations whose `article` is not "Art. 4".
- GDPR line, only if GDPR duties exist and tier is not prohibited: `<b>GDPR too:</b>` + short names of matched `gdpr-` rules, in `matched` order, joined with ", ".
- `+N more in the agent's answer`, N = all obligations − duties shown; omit at 0.
- Incomplete: head "Still to answer", first 3 `missing` ids (`_` → space), "+N more in the agent's answer".
- Guard: if `.ac-slide__body` overflows (`scrollHeight > clientHeight`), drop the 3rd duty and add it to N. Never shrink type. Same for the fallback font: if `.ac-answer` is wider than the slide, scale its font-size down to fit.

## Words (fixed; Hank to confirm the five sentences)
| tier | word | sentence | `--chars` |
|---|---|---|---|
| prohibited | Prohibited | Banned in the EU. | 10 |
| high | High-risk | Allowed, with strict duties. | 9 |
| limited | Limited | Allowed if people know it's AI. | 7 |
| minimal | Minimal | Allowed. Few AI Act duties. | 7.6 |
| incomplete | Incomplete | Not enough answers to decide. | 11.4 |

| `gdpr-` rule id | short name |
|---|---|
| gdpr-basics | lawful basis and notice |
| gdpr-processor | vendor contracts |
| gdpr-dpia | impact assessment |
| gdpr-automated-decisions | right to a human decision |
| gdpr-special-category | sensitive data |

## States
Idle (no checks): `.ac-slide__body` holds `h2.ac-idle-title` "Waiting for an agent to pay" + `p.ac-why` "It reads the free questions, gets a 402, pays 0.50 USD over Stripe MPP, and the verdict lands here." Offline: after 2 failed polls in a row, swap `.ac-status` for the mock's `.ac-banner` ("Can't reach the server." / "Last check stays up."), keep the last render; the next good poll restores "Live".

## Arrival
Only the highlighter moves. Track the newest `receipt_id`; when it changes, render, then `screen.classList.remove('is-new'); void screen.offsetWidth; screen.classList.add('is-new')`. Same receipt on the next poll: no re-render. Reduced motion is handled in tokens.css.

## Must not
Use-case text anywhere. `innerHTML` with data (`createElement` + `textContent`). New colours, fonts or radii. Any other motion: no fades, slides, pulses or stagger. Article columns, chips or date tags on the screen.

## Check before the PR
Screenshots at 1920x1080, 1280x720 and 1550x1050 match the mock, with no empty band at any size. Run the CV-screening, chatbot, call-centre and `incomplete` verdicts through `recordCheck`.
