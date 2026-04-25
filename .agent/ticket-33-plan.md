## Analysis

### Current State
- The public landing page has been redesigned (tickets #44/#62/#64) with a warm, material-first visual system: aged paper, terracotta accents, wood-floor gradient, pressed CTA, layered shadows, display/marker typography. Tokens live in `apps/web/src/styles/tokens.css` and `apps/web/src/styles/theme.ts`.
- `TableMapPage.tsx` still uses an inline-style, light-cream layout with plain headings, basic cards, and a solid green "Book Now" CTA. It does not reuse the landing scene tokens, typography, or pressed-material CTA look.
- `RegistrationForm` and `WaitlistForm` also use the older visual language and green rounded buttons.

### Target State
- The table-map page reads as part of the same visual system as the redesigned landing page:
  - Aged-paper surfaces and terracotta accents.
  - Display/marker typography for headings.
  - Pressed terracotta CTAs for primary actions (Book Now, Join Waitlist, submit buttons) mirroring the landing hero CTA.
  - Map frame styled like a tangible paper scene in a cork frame.
  - Detail panel and "all booked" notice use the same paper-card materials and shadow stack.
- Mobile remains usable — bottom-sheet detail, responsive padding.
- Registration interactions must continue to work — no structural or validation changes.

### Approach
- Introduce a single `table-map.css` stylesheet mirroring `landing.css` patterns: local `--scene-*` aliases bound to the global `--flea-*` material tokens. Reuse the pressed-CTA button treatment so the two pages share one visual language without sharing markup.
- Replace inline style objects in `TableMapPage.tsx` with CSS classes. Keep component structure, test IDs, and translation keys identical.
- Apply a shared `flea-scene-cta` style to the primary actions in `TableMapPage`, `RegistrationForm`, `WaitlistForm`, and `FullCapacityNotice` so the pressed-terracotta CTA becomes the canonical primary-action look.
- Restyle the `TableMap` SVG frame to match (paper background, cork frame stroke, warm shadow stack). Tile colors map to paper/terracotta accents so the chosen/available/reserved states stay recognizable and accessible.
- Restyle form card surfaces (info card, fieldset, detail summary) to use aged paper + cork edge + warm drop shadow.
- Keep tests green — avoid renaming/moving test-facing strings or data-testids.

## Task Checklist
- [x] Read issue #33 and add `agent active` + `claude` labels.
- [x] Record scope in `.agent/ticket-33-plan.md`.
- [ ] Add `apps/web/src/styles/table-map.css` with scene-aligned tokens and shared CTA/card classes.
- [ ] Convert `TableMapPage.tsx` to consume the new classes; swap inline styles.
- [ ] Update `TableMap.tsx` frame and tile palette to match.
- [ ] Update `RegistrationForm.tsx` and `WaitlistForm.tsx` primary CTAs + card surfaces for consistency.
- [ ] Run tests, lint, build.
- [ ] Push branch, open PR, run pr-reviewer agent, address feedback, finalize ticket.

## Implementation Summary
- Files to modify:
  - `apps/web/src/styles/table-map.css` (new)
  - `apps/web/src/components/TableMapPage.tsx`
  - `apps/web/src/components/TableMap.tsx`
  - `apps/web/src/components/RegistrationForm.tsx`
  - `apps/web/src/components/WaitlistForm.tsx`
- Estimated impact: visual restyle of the public table-map experience and its two child forms; no behavior or validation changes.
