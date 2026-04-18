## Analysis

### Current State
- The landing page is built around a flat inline SVG hero plus small decorative icons.
- The current rendering model is optimized for lightweight illustration, not a layered photorealistic scene.

### Target State
- The landing page supports a layered composition with raster assets and live DOM overlays.
- Later visual iterations can swap assets without rewriting the page structure again.

### Approach
- Remove the inline-SVG-first assumption.
- Introduce a scene architecture with background, midground, foreground, and overlay content layers.

## Task Checklist
- [x] Create GitHub issue #24
- [x] Add `agent active` and `claude` labels
- [x] Create branch `ammonl/ticket-24-redesign-backlog` from latest `main`
- [x] Record scope in `.agent/ticket-24-plan.md`
- [ ] Replace the flat hero rendering strategy
- [ ] Establish layered landing-page composition primitives
- [ ] Validate the new structure supports later asset swaps cleanly

## Implementation Summary
- Primary area: `apps/web`
- Estimated impact: landing-page structural refactor enabling higher-fidelity visuals
