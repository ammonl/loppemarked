# Ticket 97 — Server-side floor/door normalization

## Analysis

### Current state

`apps/api/src/routes/public.ts` calls `normalizeApartmentKey(...)` with whatever
`floor` / `door` the client sends. For house numbers where
`isFloorDoorRequired(houseNumber)` is `false`, a malicious or buggy client can
submit `floor: "2"` and end up with a different apartment dedupe key than a
neighbor at the same address who omits floor — the same bypass that #88 fixed
client-side in #95.

Affected handlers (server-side):

- `handlePublicRegister` — registration endpoint (line ~178)
- `handleJoinWaitlist` — waitlist endpoint (line ~428)
- `handleValidateRegistration` — pre-submit validator (line ~143) — exposes
  the apartment key back to the client and should mirror the same rule so the
  preview matches the resulting register key.
- `handleValidateAddress` — public eligibility check (line ~107) — same.

### Target state

For all four handlers, when `isFloorDoorRequired(houseNumber)` is `false`,
coerce `floor` and `door` to `null` before computing the apartment key and,
in the register/waitlist endpoints, before persisting to the DB.

### Approach

Add a small private helper inside `public.ts` that returns the effective
`floor` / `door` pair given the `houseNumber`. Apply it at the top of each of
the four handlers, replacing local `body.floor ?? null` / `body.door ?? null`
references.

Persisted columns (`floor`, `door` on `registrations` and `waitlist_entries`)
follow the same normalization so a future query that re-derives the key from
the row will not drift.

## Task checklist

- [ ] Add `effectiveFloorDoor` helper in `apps/api/src/routes/public.ts`
- [ ] Use helper in `handleValidateAddress`
- [ ] Use helper in `handleValidateRegistration`
- [ ] Use helper in `handlePublicRegister` (apartment key + insert values)
- [ ] Use helper in `handleJoinWaitlist` (apartment key + insert values)
- [ ] Add regression tests covering the bypass in `public.test.ts`
- [ ] Run `npm test`, `npm run lint`, `npm run build` from `apps/api` and root
- [ ] Push, open PR, run pr-reviewer agent, address feedback, finalize ticket

## Files to modify

- `apps/api/src/routes/public.ts` (~10 lines changed)
- `apps/api/src/routes/public.test.ts` (new regression tests)

## Estimated impact

Low. Pure server-side normalization that aligns with the existing client-side
rule. No schema changes; existing rows with `floor`/`door` set on
non-floor-required addresses remain as-is (this is a forward-fix to prevent
new mismatches; back-fill is out of scope for this ticket).
