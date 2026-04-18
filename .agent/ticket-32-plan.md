## Analysis

### Current State
- The current responsive landing page mostly collapses the desktop layout.
- The target mobile design needs its own composition and crop strategy.

### Target State
- Mobile has a dedicated layout with controlled focal hierarchy, asset cropping, and CTA placement.

### Approach
- Design mobile as its own scene, not just a reduced desktop variant.
- Support alternate mobile assets or mobile-specific crop behavior.

## Task Checklist
- [x] Create GitHub issue #32
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-32-plan.md`
- [ ] Create mobile-specific landing composition
- [ ] Support mobile asset or crop strategy
- [ ] Reposition key elements for narrow screens
- [ ] Validate readability/performance on mobile

## Implementation Summary
- Primary area: `apps/web`
- Estimated impact: mobile-specific landing-page composition work
