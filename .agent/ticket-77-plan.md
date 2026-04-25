# Ticket 77 — Make waitlist floor/door behavior match the registration forms

## Analysis

**Current state**

- `apps/web/src/components/RegistrationForm.tsx` conditionally renders the
  `floor` and `door` fields only when the entered house number is in
  `FLOOR_DOOR_REQUIRED_NUMBERS` (via `isFloorDoorRequired`). Both fields are
  hidden entirely when not required. The floor field is required when shown.
- `apps/web/src/components/WaitlistForm.tsx` always renders both fields. Only
  the floor field becomes `required` dynamically; the door field is always
  shown but optional.

**Target state**

The waitlist form should match the registration form: hide both `floor` and
`door` entirely when the house number does not require them, and show them
with floor required when the house number does.

**Approach**

Mirror the conditional render block from `RegistrationForm.tsx` (lines
281-309) in `WaitlistForm.tsx`. No changes to shared validators, types, or
API are needed — they already use `isFloorDoorRequired` consistently.

## Task Checklist

- [x] Read ticket and add labels (already applied: `agent active`, `claude`)
- [x] Branch from latest main (`claude/ticket-77-task-HMaLU`)
- [ ] Update `WaitlistForm.tsx` to wrap the floor/door fields in
      `{needsFloorDoor && (...)}`, with floor always `required` when shown
- [ ] Run lint, tests, build
- [ ] Commit and push
- [ ] Open PR, run pr-reviewer agent, address feedback
- [ ] Add reviewer `ammonl`, comment on ticket, remove `agent active` label

## Implementation Summary

**Files to modify**

- `apps/web/src/components/WaitlistForm.tsx` — wrap the two
  `flea-scene-form__field` blocks (floor and door) in a fragment guarded by
  `needsFloorDoor`; set `required` directly on the floor input rather than
  using the dynamic prop and the `?` fallback in the label.

**Estimated impact**

Single-file UI change, ~25 lines. Validation, normalization, and API
contracts unchanged. No new translation keys. Existing test suites cover the
underlying `isFloorDoorRequired` logic.
