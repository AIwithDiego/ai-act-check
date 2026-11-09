## Allison — Design

Live screen for AI Act Check (`/live`), MPP Hackathon Dublin, Tue 10 Nov 2026. Files on `docs/prep-pack`:
`public/tokens.css` · `docs/design-system.html` · `docs/live-screen-mock.html` · `docs/design-spec.md` (Devin's handoff, 54 lines).

**v2, 9 Nov (Diego: "that looks very busy").** The v1 three-column screen was a reading wall. v2 is a keynote slide: the tier word is most of the screen, then one meaning line, one why/when line, at most three duties, one GDPR line, a count of the rest, and a thin strip for the payment and earlier checks. About a third of the text. The look, tokens, brand, highlighter and tier colours are unchanged. v1 stays in the design system's Library group as the example of what not to put on stage.

### 1. Who it's for
The room: 5 to 10 m away, glancing between Diego's terminal and the screen for about 3 seconds per check. Job: *when the agent pays, I want to see at once what it bought.* Diego talks over it, so the screen carries one answer, not the full report. No use-case text, by the privacy rule.

### 2. Source of the look (unchanged)
aiwithdiego.com site v5 (`site-v5.css`):
- Archivo with width-axis contrast.
- The night section as the stage, with ink and hot orange.
- The hero highlighter (34 ms a letter, -0.9° tilt).
- The green online dot.
- Square corners.

What I extended for the projector:
- Secondary text lifted to `#C9C5E8` (AAA).
- 2 px rules.
- `--u` scaling.
- Tier tokens with glyphs. Tiers map to colours the site already has: prohibited = hot, high = marker yellow, limited = marker lilac, minimal = live green, incomplete = dashed outline.

### 3. Layout
`ac-bar` (logo, "AI Act Check", "Earned X USD from N checks", Live), then `main.ac-slide` (hero, then "What you must do", then a one-line disclaimer), then `footer.ac-strip` (on the left "Paid 0.50 USD · receipt pi_3SQ9f…bXc4 · 14:04"; on the right, earlier checks as tier pills).

The non-16:9 band bug is fixed:
- **Cause:** `.ac-screen` was a fixed 16:9 box scaled by `min()`, so any other ratio left an empty band.
- **Fix:** as a direct child of `body` it is now `100vw x 100vh`. Type still scales with the smaller axis; the hero row takes any extra height and the gutters take extra width.
- **Verified** at 1920x1080, 1280x720 and 1550x1050.

**22-obligation decision:** three duties, one GDPR line, and a number for the rest.
- **Which three:** the duties Hank marks `key: true`; if none are marked, the first three AI Act duties that are not Art. 4.
- **GDPR line:** "GDPR too:" plus the short names of the matched rules. There is no GDPR line for prohibited.
- **The rest:** "+19 more in the agent's answer".

Why: the room needs the answer and its consequence; the full list is already in the JSON on Diego's terminal next to the screen.

### 4. Microcopy (exact strings in the spec)
- **Tier sentences** (Hank to confirm): "Banned in the EU." / "Allowed, with strict duties." / "Allowed if people know it's AI." / "Allowed. Few AI Act duties." / "Not enough answers to decide."
- **Why line:** derived from the matched rule and date, e.g. "Employment · Annex III · from 2 Dec 2027".
- **GDPR short names**, from the rule titles: lawful basis and notice, vendor contracts, impact assessment, right to a human decision, sensitive data.
- **Idle:** "Waiting for an agent to pay" / "It reads the free questions, gets a 402, pays 0.50 USD over Stripe MPP, and the verdict lands here."
- **Incomplete:** "N questions unanswered" / "Still to answer" + three question ids + "+N more in the agent's answer".
- **Offline:** "Can't reach the server." "Last check stays up."
- **Empty strip:** "Paid checks line up here."

### 5. Motion
Only the highlighter moves: the site's marker sweeps behind the tier word (120 ms delay, 34 ms a letter). Everything else is already there, with no fades, slides or pulses. Reduced motion: no animation.

### 6. Accessibility
- **EAA:** out of scope (localhost demo). WCAG 2.2 AA is the floor; body text meets AAA.
- **Contrast:** all pairs pass, computed live in the design system's Contrast section. Ink on the tier fills is ≥ 5.94:1, at very large sizes.
- **Not colour alone:** tier = word + glyph + lightness. Pills carry the word, and incomplete is dashed.
- **Screen reader:** `.ac-screen` is `aria-live="polite"`; the answer is an `h2` and the duties heading an `h3`; glyphs are `aria-hidden`.
- **Forced colours:** handled in tokens.css.
- **Dates:** 2 Dec 2027 (en-IE), times 24 h Europe/Dublin.

### 7. Acceptance criteria (for Sonny)
- [ ] `/live` matches the mock at 1920x1080, 1280x720 and 1550x1050, with no empty band and no scrollbars.
- [ ] At most 3 duties show. The GDPR line is absent for prohibited. The +N count equals all obligations minus the duties shown.
- [ ] A new receipt runs the marker stroke once; nothing else animates; the same receipt does not re-animate.
- [ ] If the slide body overflows, the third duty is dropped into the count; type never shrinks.
- [ ] No use-case text in the DOM; data goes in only through `textContent`.

### 8. Feel check
It's calm now. One yellow (or orange, or lilac) stroke with one word on it, and a lot of night around it. The two moves that carry it: the site's own highlighter revealing the answer, and "Earned 1.50 USD from 3 checks" ticking up. Diego's brief asked for "pills" for earlier checks; I kept them square-cornered like the site's tabs, because round pills are on his list of AI tells.

### Flags for Smith
1. **Venue wifi:** drop the Archivo variable woff2 at `public/fonts/archivo.woff2` before 13:00. tokens.css loads it first; the fallback font runs wider.
2. **Hank:** mark `key: true` duties. Without them the CV case falls back to "Use it according to the provider's instructions" first, which is true but weak on stage. Hank should also confirm the five sentences.
3. **Receipt id** format is whatever mppx returns; the strip shortens it to first 8 + last 4.

Screenshots: `/private/tmp/claude-501/-Users-diegobauer/028407fa-5dac-493e-a20a-67014491a1cc/scratchpad/shots/v2-*`.
