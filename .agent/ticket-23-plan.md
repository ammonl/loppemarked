## Analysis

### Current State
- The flea-market follow-up requirements introduce the event contact as `Ammon Larson (ammonl@hotmail.com)`.
- That format can lead to inconsistent output where the contact name and email are shown as separate visible text.
- The raw email address may still be needed in configuration or backend-only surfaces, but the rendered presentation should be standardized.

### Target State
- Anywhere the event contact is shown in rendered content, it appears as a single `mailto:` link with the visible text `Ammon Larson`.
- The raw email address is no longer shown as separate adjacent text in UI-facing or user-facing/admin-facing content.
- Backend-only storage can keep the email value where necessary without affecting rendered output.

### Approach
- Audit public UI, admin UI, templates, previews, and docs that drive rendered contact copy.
- Replace split contact presentations with a single linked label using `mailto:ammonl@hotmail.com`.
- Keep the change scoped to rendering and presentation unless a supporting shared utility or data shape needs a small adjustment.

## Task Checklist
- [x] Create GitHub issue #23 for contact mailto-link standardization
- [x] Add `agent active` and `claude` labels to issue #23
- [x] Create branch `ammonl/ticket-23-contact-mailto-link` from latest `main`
- [x] Record the scope in `.agent/ticket-23-plan.md`
- [ ] Update public surfaces to render `Ammon Larson` as a single `mailto:` link
- [ ] Update admin surfaces and previews to use the same linked contact presentation
- [ ] Update any relevant templates/docs that drive rendered contact content
- [ ] Preserve raw stored email values where needed for backend-only use
- [ ] Validate with tests, lint, build, and rendered-content QA during implementation

## Implementation Summary
- Primary implementation areas: `apps/web`, potentially `apps/api`, `packages/shared`, and supporting docs/templates
- Estimated impact: cross-cutting content rendering cleanup to standardize the organizer contact presentation
