## Analysis

### Current State
- Existing theme tokens are tuned for the lighter flat aesthetic.
- The redesign needs more nuanced material and contrast tokens.

### Target State
- Theme tokens cover forest greens, wood tones, aged paper, warm shadow states, and related surfaces.
- The token system is reusable across landing, map, and admin pages.

### Approach
- Extend the color/surface/type token set.
- Keep naming stable and reusable for follow-on redesign tickets.

## Task Checklist
- [x] Create GitHub issue #30
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-30-plan.md`
- [ ] Add or revise palette/material tokens
- [ ] Add any required surface/shadow/type tokens
- [ ] Align token names to future public/admin reuse
- [ ] Audit landing implementation against the new token set

## Implementation Summary
- Primary areas: `apps/web`, possibly `packages/shared`, supporting docs
- Estimated impact: token expansion for the redesign system
