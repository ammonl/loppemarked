## Analysis

### Current State
- The admin experience is still modeled around greenhouse planter-box operations.
- Current admin workflows assume two greenhouse inventories, box names, and greenhouse-specific summaries and terminology.
- The public product direction has shifted to a single Fælledhuset flea-market event with numbered tables.

### Target State
- The admin UI manages one Fælledhuset table inventory for the loppemarked.
- Reservations, waitlist assignment, summaries, and any item-specific communications use table-focused terminology and behavior.
- Existing admin capabilities such as authentication, opening-date management, and admin account management continue to work after the product-model update.

### Approach
- Update the smallest viable set of admin pages, shared types, and API/domain contracts needed to remove greenhouse assumptions.
- Preserve the core operational flows for add, move, remove, inspect, and assign actions while retargeting them to tables.
- Keep the admin UI practical and easy to scan, with responsive support for desktop and tablet layouts.

## Task Checklist
- [x] Create GitHub issue #16 for the admin-pages update
- [x] Add `agent active` and `claude` labels to issue #16
- [x] Create branch `ammonl/ticket-16-admin-pages` from latest `main`
- [x] Record the admin-pages scope in `.agent/ticket-16-plan.md`
- [ ] Replace greenhouse-specific admin terminology and summaries with flea-market table terminology
- [ ] Update reservation management flows to target numbered tables
- [ ] Update waitlist assignment flows to target tables
- [ ] Update any item-specific admin notifications or previews to reference table numbers
- [ ] Preserve opening-date controls and admin account management after the model update
- [ ] Validate with tests, lint, build, and admin workflow QA during implementation

## Implementation Summary
- Primary implementation areas: `apps/web`, likely `packages/shared`, and possibly `apps/api`
- Documentation updates may be needed if admin contracts or operational assumptions change
- Estimated impact: replacement of greenhouse-based admin workflows with table-based flea-market management across desktop and tablet admin surfaces
