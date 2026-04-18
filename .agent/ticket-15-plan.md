## Analysis

### Current State
- The public registration flow is still based on the greenhouse planter-box model.
- The current product assumptions include two greenhouse entry points, per-box naming and imagery, and greenhouse-oriented public copy.
- The next public page for the flea market needs to become a single interactive registration screen tied to the Fælledhuset layout.

### Target State
- After the landing page, users reach one registration page for the flea market.
- The page centers on an interactive map of the Fælledhuset flea-market space with numbered tables.
- Users can inspect a table's number, approximate size, and price, then complete the existing registration form.
- When all tables are taken, the page shifts into a waitlist flow with warm, user-friendly messaging.

### Approach
- Replace greenhouse-specific public registration framing with a single hall-based table-booking page.
- Reuse the landing-page visual language so the transition feels cohesive.
- Keep the existing registration form fields unless implementation reveals a small required schema adjustment.
- Update the smallest viable web, shared, API, and docs surfaces needed to support table-based public booking.

## Task Checklist
- [x] Create GitHub issue #15 for the registration-page update
- [x] Add `agent active` and `claude` labels to issue #15
- [x] Create branch `ammonl/ticket-15-registration-page` from latest `main`
- [x] Record the registration-page scope in `.agent/ticket-15-plan.md`
- [ ] Replace greenhouse public registration entry points with one Fælledhuset table-registration page
- [ ] Implement the interactive hall map with numbered table states
- [ ] Add the reservation details panel behavior for desktop and mobile
- [ ] Reuse or adapt the existing registration form for table booking
- [ ] Add the full-capacity waitlist experience and copy
- [ ] Update any support/contact copy to `Ammon Larson (ammonl@hotmail.com)` where relevant
- [ ] Validate with tests, lint, build, and interaction QA during implementation

## Implementation Summary
- Primary implementation areas: `apps/web`, likely `packages/shared`, and possibly `apps/api`
- Documentation updates may be needed if product assumptions or public-flow contracts change
- Estimated impact: replacement of greenhouse-specific public booking UI with a single interactive table-map registration experience for desktop and mobile
