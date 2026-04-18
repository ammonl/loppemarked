## Analysis

### Current State
- The landing page already has working copy, CTA wiring, translations, and entry-flow behavior.
- A visual rewrite can accidentally break those behaviors.

### Target State
- The landing page looks new but keeps its current CTA behavior, translations, and accessibility wiring intact.

### Approach
- Reconnect the existing content logic after the visual refactor.
- Treat behavior preservation as an explicit verification step.

## Task Checklist
- [x] Create GitHub issue #31
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-31-plan.md`
- [ ] Preserve CTA entry behavior in the new layout
- [ ] Preserve translation-key usage and labels
- [ ] Preserve accessibility semantics where practical
- [ ] Validate behavior after the visual rewrite

## Implementation Summary
- Primary areas: `apps/web`, potentially `packages/shared`
- Estimated impact: behavior-preservation pass for the landing-page redesign
