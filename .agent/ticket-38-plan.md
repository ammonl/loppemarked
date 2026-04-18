## Analysis

### Current State
- The public header currently renders the site identity as styled text rather than a distinct logo mark.
- The app favicon is still configured as `favicon.ico` rather than a simplified brand icon derived from the new flea-market identity.
- The updated visual direction calls for a more crafted, personal logo treatment with a small amount of celebratory interaction.

### Target State
- The public header uses a custom SVG `UN17 Village` logo with a hand-crafted wordmark and botanical/heart doodle.
- The primary logo color is Sage Green `#8DA88D` on the cream public background.
- The footer uses a simplified stamped Terracotta variant.
- A simplified heart-doodle icon is used for the favicon.
- A subtle wiggle or heartbeat animation can be triggered on successful booking.

### Approach
- Introduce the logo as an SVG-based brand asset or component in the web app.
- Update the header and footer render paths to use the new logo treatments.
- Replace or augment favicon wiring in the app layout.
- Keep the success animation isolated and easy to trigger from the booking-success path.

## Task Checklist
- [x] Create GitHub issue #38 for the logo update
- [x] Add `agent active` and `claude` labels to issue #38
- [x] Create branch `ammonl/ticket-38-logo-brand-mark` from latest `main`
- [x] Record the scope in `.agent/ticket-38-plan.md`
- [ ] Create or integrate the SVG `UN17 Village` logo with botanical/heart doodle
- [ ] Update the public header to place the logo at the top-left
- [ ] Add the simplified stamped footer logo variant
- [ ] Add the simplified heart-doodle favicon
- [ ] Add the subtle success-state doodle animation hook
- [ ] Validate desktop/mobile rendering, favicon behavior, and interaction behavior

## Implementation Summary
- Primary implementation area: `apps/web`
- Supporting docs may be updated if the logo asset or brand rules need documenting
- Estimated impact: branding-focused update to the public header, footer, favicon, and booking-success feedback path
