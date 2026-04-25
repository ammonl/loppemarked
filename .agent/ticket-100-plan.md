# Ticket 100 — Remove remaining greenhouse-era terminology

## Analysis

### Current state
The previous task (ticket 97) renamed `boxes` routes/components to `tables`, but several pieces of greenhouse-era terminology remain:

1. **Shared types** — `BoxState`, `BOX_STATES`, `PUBLIC_BOX_STATES`, `PublicBoxState` (semantically "planter box state").
2. **Web components** — `BoxStateLegend` (unused dead code), `boxStateColors.ts` / `BOX_STATE_COLORS`, `boxStates`/`fetchBoxStates`/etc. local variables in admin tables/registrations/waitlist.
3. **i18n** — Unused `email.confirmationSubject`, `email.switchNote`, `email.careGuidelines`, and all `guidelines.*` keys with planter-box / gardening copy. The `I18N_KEYS.email` group in shared is also unused.
4. **CancellationInfo** — Web cancel page declares `boxId` field that's never used (API actually returns `tableId`).
5. **Test names / comments** — `audit.test.ts` ("planter_box entity events", "before/after box_id fields"), `messaging.test.ts` ("greenhouse-specific audience values"), `email-templates.test.ts` ("instead of a planter box"), `useHistoryState.test.ts` ("greenhouse map scenario"), BrandLogo comments ("Botanical stem", "botanical leaf").
6. **Docs** — `docs/specs/loppemarked-2026-spec.md` is fully out of date (entire premise is planter boxes in greenhouses). `docs/runbooks/launch-checklist.md` has "Greenhouse summaries" comment.

### Target state
- All `Box*` types/constants renamed to `Table*` equivalents.
- Dead `BoxStateLegend` deleted.
- Unused email + guidelines i18n keys removed.
- Stale `boxId` field removed from CancellationInfo.
- Test names and code comments cleaned up.
- Stale spec doc rewritten/removed.

### Approach
Mechanical rename + dead-code removal. Keep regression-guard tests in `PreOpenPage.test.tsx`/`LandingPage.test.tsx` and `email-templates.test.ts` that assert greenhouse terminology never reappears in user-facing markup.

## Task Checklist
- [ ] Rename `BoxState` → `TableState`, `BOX_STATES` → `TABLE_STATES`, `PUBLIC_BOX_STATES` → `PUBLIC_TABLE_STATES`, `PublicBoxState` → `PublicTableState` in `packages/shared/src/{enums,types,index}.ts` + tests.
- [ ] Delete unused `apps/web/src/components/BoxStateLegend.tsx`.
- [ ] Rename `boxStateColors.ts` → `tableStateColors.ts`, `BOX_STATE_COLORS` → `TABLE_STATE_COLORS`; update `AdminTables.tsx`.
- [ ] Update local `boxStates`/`fetchBoxStates` in `AdminRegistrations.tsx`, `AdminWaitlist.tsx` to `tableStates`/`fetchTableStates`.
- [ ] Remove dead `boxId` from `CancellationInfo` in `apps/web/src/app/cancel/page.tsx`.
- [ ] Remove `email.*` and `guidelines.*` translation keys + `I18N_KEYS.email` group + corresponding test in `apps/web/src/app/page.test.tsx`.
- [ ] Update stale test comments (`audit.test.ts`, `messaging.test.ts`, `email-templates.test.ts`, `useHistoryState.test.ts`).
- [ ] Soften `BrandLogo.tsx` "Botanical" comments to neutral "leaf" descriptions.
- [ ] Replace `docs/specs/loppemarked-2026-spec.md` with a current spec (or delete and reference architecture.md).
- [ ] Update `docs/runbooks/launch-checklist.md` "Greenhouse summaries" comment.
- [ ] Update `docs/architecture.md` `BoxStateLegend` reference.

## Implementation Summary
- Files modified: ~15
- Estimated impact: low risk; mostly rename + dead-code removal. Behavior unchanged.
