## Analysis

### Current State
- The flea-market direction now treats table booking as free, but some follow-up tickets and likely parts of the product still mention table prices.
- Example copy currently includes pricing in table summaries such as `Bord #12 (2 meters, 50 DKK)`.
- Price-related language may still exist across public booking UI, admin surfaces, shared types, and docs.

### Target State
- The product no longer implies that residents pay for or purchase tables.
- Public and admin workflows describe tables by details that still matter, such as number and size, without showing prices.
- Any leftover backend compatibility fields are hidden from the UI and documented if they cannot be removed immediately.

### Approach
- Audit the public flow, admin flow, shared contracts, and docs for price/cost/payment references.
- Remove pricing language where possible rather than replacing it with `0 DKK`.
- Preserve existing booking and waitlist behavior while simplifying item summaries to non-price details.

## Task Checklist
- [x] Create GitHub issue #22 for removing table pricing references
- [x] Add `agent active` and `claude` labels to issue #22
- [x] Create branch `ammonl/ticket-22-remove-table-pricing` from latest `main`
- [x] Record the scope in `.agent/ticket-22-plan.md`
- [ ] Remove price/cost references from the public booking flow
- [ ] Remove price/cost references from admin pages and admin messaging
- [ ] Remove or hide price-oriented table details from shared summaries and UI models
- [ ] Update any relevant docs to state that table booking is free
- [ ] Validate with tests, lint, build, and public/admin QA during implementation

## Implementation Summary
- Primary implementation areas: `apps/web`, likely `packages/shared`, possibly `apps/api`, and supporting docs
- Estimated impact: cross-cutting copy/model cleanup to remove price references while preserving booking behavior
