## Analysis

### Current State
- The landing stylesheet assumes airy spacing, simple stacking, and light procedural shadows.
- That system cannot produce the density and materiality of the target scene.

### Target State
- The landing page styling supports overlap, richer depth, stronger contrast, and scene-based layout behavior.

### Approach
- Rewrite most of the landing CSS instead of incrementally tuning it.
- Support layered positioning, heavier material cues, and responsive scene behavior.

## Task Checklist
- [x] Create GitHub issue #29
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-29-plan.md`
- [ ] Replace the current landing-page CSS/layout rules
- [ ] Introduce scene-based spacing and overlap behavior
- [ ] Add richer shadows and material treatments
- [ ] Validate maintainability and responsiveness

## Implementation Summary
- Primary area: `apps/web`
- Estimated impact: full rewrite of landing-page styling foundations
