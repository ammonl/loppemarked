## Analysis

### Current State
- The public header is centered, light, and minimal.
- The target design needs a darker, more branded top navigation treatment.

### Target State
- The public header becomes a dark green branded nav bar with left-aligned identity and explicit navigation.

### Approach
- Restyle the public header chrome.
- Preserve language-switching and admin-link behavior while changing presentation.

## Task Checklist
- [x] Create GitHub issue #27
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-27-plan.md`
- [ ] Replace header styling with dark green bar treatment
- [ ] Align branding/logo to the left
- [ ] Add/support navigation links
- [ ] Validate responsive header behavior

## Implementation Summary
- Primary area: `apps/web`
- Estimated impact: top-level public navigation redesign
