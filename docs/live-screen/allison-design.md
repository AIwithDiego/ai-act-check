## Allison — Design

Live screen for AI Act Check (`/live`), MPP Hackathon Dublin, Tue 10 Nov 2026. Deliverables, all on `docs/prep-pack` and uncommitted:
`public/tokens.css` · `docs/design-system.html` · `docs/live-screen-mock.html` · `docs/design-spec.md` (Devin's handoff, 51 lines).

### 1. Who it's for
- **The room** (developers and Stripe people, 5 to 10 m away, glancing between Diego's terminal and the screen while he talks). Job: *when the agent pays, I want to see at once what it bought, so I believe the payment bought something checkable.*
- **Diego**, presenting: the screen has to carry the verdict so he can talk about the payment.
- Out of scope: interaction, phones, any use-case text (privacy rule; the terminal shows the sentence).

### 2. Precedent
The look is aiwithdiego.com site v5 (`~/Brand/website`, `app/(public)/site-v5.css` on origin/main): Archivo only, width-axis contrast, ink/white plus the indigo night section, hot `#FF4F1A`, the hero highlighter marker (peach/yellow/lilac, 34 ms a letter, ±0.9° tilt), the green online dot, and hairline index rows instead of cards. The format is the AI Exposure Scan design system (sticky section nav; each component as live stage, notes and snippet; computed contrast; greyscale check; Copy CSS). Pattern references: departure boards and election-night results screens (one big answer, a list of earlier ones below).

### 3. What I took and what I extended
- **Taken as is:** Archivo and its 62/88/100/125 widths; uppercase only in the condensed display; `#14113A` / `#F1EFFA` / `#9C97C4` night; ink `#0C0C10`; hot; live `#2BD46A`; marker yellow `#FBE86A` and lilac `#D6D1FF`; the marker shape, timing and tilt; easing `cubic-bezier(.2,.8,.2,1)`; 2 px and 6 px radii; index rows.
- **Extended for the projector:**
  - Night is the stage, with `--stage-deep #0E0C2B` for the feed band.
  - Secondary text lifted to `#C9C5E8`, because the site's night grey is 6.52:1 and misses AAA; the new value is 10.79:1.
  - Rules are 2 px, because 1 px disappears on a projector.
  - Every size is in design px times `--u`, so 1280x720 is the same picture scaled.
  - New in the system: five tier tokens with CSS-mask glyphs (⊘ ▲ ⓘ ○ dashed ?), date tags and an offline banner.
- **Tier mapping, using only colours the site already has:** prohibited = hot, high = marker yellow, limited = marker lilac, minimal = live green, incomplete = a dashed night-grey outline. Hue means tier and nothing else. AI Act vs GDPR is shown by a solid vs dashed rule; in force vs later by a filled vs outlined tag.

### 4. IA and layout (1920x1080)
- **Bar:** logo, "AI Act Check", price, takings, status.
- **Main, in three columns:**
  - Verdict (560): paid line, then answer, then why (matched rules and chips), then date, then disclaimer.
  - AI Act (820): grouped by `applies_from`.
  - GDPR (the rest).
- **Feed band:** the four previous checks.
- Reading and screen-reader order follow the causal story: paid, answer, why, what to do, history.

**22-obligation decision:** AI Act in full, grouped by date (1 in force now, 9 from 2 Dec 2027). GDPR collapses to its 4 matched rules plus "12 duties". The AI Act duties are what the agent paid for and change per tier. GDPR is the same baseline whenever personal data is involved, so the room needs the names (DPIA, Art. 22), not 12 lines. Overflow (provider 12, both 21): hide rows from the end and add "+ k more in the agent's answer". Rows are date-sorted, so in-force duties are never cut. Never scroll, never shrink type.

### 5. States and microcopy (exact strings in `design-spec.md`)
- **Idle:** "Waiting for an agent to pay", plus the 4-step flow (numbered because it is a sequence), "Paid checks line up here."
- **Verdict:** "Paid 0.50 USD over Stripe MPP", receipt, time. Tier sentences: "Banned in the EU." / "Allowed, with strict duties." / "Allowed if people know it's AI." / "Allowed. Few AI Act duties." / "Not enough answers to decide." **These five need Hank's OK; they are legal content.**
- **Incomplete:** "Still to answer", "N questions", the missing ids, "The agent got this list back. It answers these and checks again."
- **Offline** (after 2 failed polls): "Can't reach the server." "Last check stays up." The last render stays. No other error can reach this screen.
- **Takings:** "Earned 1.50 USD from 3 checks"; before any check, "No checks yet".

### 6. Motion
One orchestrated arrival, under 900 ms: the paid line fades in at 0 ms; at 160 ms the site's marker sweeps behind the ink word (dark on night until the stroke passes, so the stroke reveals the answer); at 520 ms the rest fades in; the new feed cell slides in. No idle loops, no pulsing dot, no row stagger. Reduced motion: everything appears whole, instantly. Verified on a frame capture at 290 ms and under reduced motion.

### 7. Accessibility specification
- **EAA:** out of scope (a localhost hackathon demo, not a service sold to consumers). WCAG 2.2 AA is the craft floor; body text meets AAA.
- **Contrast** (computed live in the design system, §02; all pass):
  - Text 15.77:1 and text-2 10.79:1.
  - Ink on the tier fills: 5.94 (prohibited, large only), 15.67, 13.41 and 9.97.
  - Tier badges on the feed band: ≥ 5.77.
  - Incomplete outline 6.52; live dot 9.16; offline ring 6.42.
- **Not colour alone:**
  - Tier = word + glyph + lightness.
  - Colour-blind sims (§03): for protanopia and deuteranopia, minimal sits close to high-risk in hue, and both are still told apart by word, glyph and lightness (0.49 vs 0.79).
  - Law = word + rule style. Date = words + fill. Status = words + dot or ring.
- **Screen reader:** `h1` is the product; the answer is an `h2`; law groups are `h3`. `.ac-screen` is `aria-live="polite"`. Glyphs are `aria-hidden`. The logo is `role="img"` with a label.
- **Forced colours:** the marker becomes Highlight/HighlightText; glyphs, tick and dot become CanvasText.
- **Dates:** "2 Dec 2027" (en-IE), times 24 h Europe/Dublin, never MM/DD.
- **Interaction:** none on the stage. On the plain page and the design-system doc, the focus ring is hot, 3 px, and buttons are ≥ 44 px.

### 8. Acceptance criteria (for Sonny)
- [ ] `/live` at 1920x1080 and 1280x720 matches `docs/live-screen-mock.html`: same picture, scaled, no scrollbars.
- [ ] CV screening (deployer): all 10 AI Act rows visible, GDPR shows 4 rule rows and "12 duties", nothing overlaps the feed.
- [ ] A new `receipt_id` animates once; the same receipt on the next poll does not re-animate.
- [ ] With `prefers-reduced-motion: reduce`, the verdict appears with no animation.
- [ ] Two failed polls show the offline banner; the last verdict stays; the next good poll restores "Live".
- [ ] No use-case text appears in the DOM; all data goes in through `textContent`.
- [ ] The disclaimer and rules version are visible on every verdict.

### 9. Feel check
It reads as the website on a stage, not as a dashboard kit. There are no cards, pills, mono labels, middle-dot meta strings or cream-and-serif. The two moves that carry it:
1. **The site's own highlighter stroke reveals each answer**, at the hero's 34 ms a letter. It is the brand signature reused as the moment that explains itself.
2. **"Earned 1.50 USD from 3 checks"** ticks up in the bar on every arrival: the MPP point, made visible.

### Flags for Smith (outside my files)
1. **Venue wifi.** With Google Fonts blocked, the Helvetica Neue Condensed fallback runs wider (screenshot `mock-high-nofont-1920x1080.png`). tokens.css already looks for `public/fonts/archivo.woff2` first (`"Archivo Local"`), so please drop the Archivo variable woff2 (SIL OFL) there before 13:00. The spec also has a JS fit guard for the answer word. The same file gives the "no external assets" `GET /` page the real font.
2. **Hank:** the five tier sentences above. Also, `callcentre-emotion` returns no GDPR duties, so the stage will say "GDPR: None in this answer" on the prohibited case. Is that what he wants the room to see, given it is staff call audio?
3. **Contract (optional, before 13:00):** `Verdict` has no caller `role`, so the screen infers it from the obligations. Adding `role` to `Verdict` would remove the guess.
4. **Receipt id:** the mock uses a `pi_…` shape. The screen shows whatever `mppx` returns, in full.

Screenshots: `/private/tmp/claude-501/-Users-diegobauer/028407fa-5dac-493e-a20a-67014491a1cc/scratchpad/shots/`.
