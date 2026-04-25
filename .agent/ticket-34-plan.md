## Analysis

### Current State
- Admin pages are visually separate from the desired new public-site brand system.
- They still need to remain efficient and easy to scan.

### Target State
- Admin pages share the updated palette, typography, and surface language in a restrained way while keeping operational clarity.

### Approach
- Reuse the new brand foundations selectively across admin surfaces.
- Favor readability and workflow clarity over visual flourish.

## Task Checklist
- [x] Create GitHub issue #34
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-34-plan.md`
- [x] Apply updated brand primitives to admin pages
- [x] Keep admin workflows easy to scan and operate
- [x] Align shared components/admin chrome with the new system
- [x] Validate desktop/tablet usability

## Implementation Summary
- Re-bound the legacy semantic color tokens in `apps/web/src/styles/theme.ts`
  (cream/parchment/borderTan/sage/warmBrown/inkBrown/dustyRose/...) to match
  the material `flea*` palette, so every admin surface that already references
  role-based names re-themes consistently with the redesigned public site.
- Refreshed shared style helpers (`cardStyle`, `sectionStyle`, `dialogStyle`,
  `shadows`) to lean on the brand cream surface and warm ink shadow values.
- Re-themed admin chrome:
  - `apps/web/src/app/page.tsx`: admin background now uses brand cream and the
    `AdminHeader` matches the public header (sand hairline, cream surface,
    Montserrat uppercase wordmark).
  - `apps/web/src/components/AdminPage.tsx`: back-link adopts the brand
    Montserrat uppercase microcopy treatment.
  - `apps/web/src/components/AdminDashboard.tsx`: tabs adopt the brand sans
    type stack with terracotta active underline; legacy `plant_separator`
    chrome image removed in favor of a quieter sand hairline.
  - `apps/web/src/components/AdminLogin.tsx`: card surface, label microcopy
    treatment, and primary CTA align with the brand terracotta button.
- Estimated impact: low risk — token re-bind is centralized; admin chrome edits
  are scoped and preserve all existing controls and information density.
