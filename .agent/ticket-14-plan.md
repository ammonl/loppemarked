## Analysis

### Current State
- The public site is still framed as the UN17 rooftop greenhouse planter-box registration experience.
- The landing page needs to be repurposed before the later map-based table booking page can be built.
- Existing product assumptions include two greenhouse entry points, planter boxes with names and images, and greenhouse-oriented copy.

### Target State
- The landing page becomes the front door for the UN17 Village loppemarked registration flow.
- Page one uses the "Warm Communal Flea Market Chic" visual theme across desktop and mobile.
- The page presents the provided Danish hero and corkboard copy, a single CTA into the booking flow, and the updated event contact information.

### Approach
- Update only the landing page in this ticket.
- Preserve reusable site chrome where it still fits, but remove greenhouse-specific framing from page one.
- Use the provided reference images as the visual north star for texture, lighting, and atmosphere.
- Defer the Fælledhuset table-map experience, table numbering, sizes, and waitlist UI to follow-up tickets.

## Task Checklist
- [x] Create GitHub issue #14 for the landing-page update
- [x] Add `agent active` and `claude` labels to issue #14
- [x] Create branch `ammonl/ticket-14-landing-page` from latest `main`
- [x] Record the landing-page scope in `.agent/ticket-14-plan.md`
- [ ] Re-theme the public landing page to the flea-market visual direction
- [ ] Replace greenhouse-specific landing-page copy and visuals
- [ ] Add the event corkboard with the provided date, place, and time copy
- [ ] Add the landing-page CTA for the single registration flow
- [ ] Update landing-page support/contact information to `Ammon Larson (ammonl@hotmail.com)`
- [ ] Validate with tests, lint, build, and desktop/mobile visual QA during implementation

## Implementation Summary
- Primary implementation area: `apps/web`
- No API, infrastructure, or shared-package changes are expected for the landing-page-only slice
- Estimated impact: visual redesign and content update of the public landing page, with responsive adjustments for desktop and mobile
