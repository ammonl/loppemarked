## Analysis

### Current State
- Existing theme tokens are tuned for the lighter flat aesthetic.
- `landing.css` declared the scene-based material palette as `--scene-*` local
  vars with hard-coded hex/rgba values duplicated across declarations.

### Target State
- Theme tokens cover forest greens, wood tones, aged paper, warm shadow
  states, and brass/pin accents.
- Token names are surface/role-based (not page-specific) so the map and admin
  pages can reuse the same palette.
- Landing CSS pulls from the shared token layer rather than hard-coding hex
  values, with a parity test that keeps TS and CSS in lockstep.

### Approach
- Extend `colors` and `shadows` in `apps/web/src/styles/theme.ts` with the new
  material tokens.
- Add `apps/web/src/styles/tokens.css` exposing the same values as
  `--flea-*` custom properties on `:root`, and import it once from
  `apps/web/src/app/layout.tsx` so the variables are globally available.
- Refactor `apps/web/src/styles/landing.css` so the `--scene-*` vars inside
  `.flea-landing` alias the global `--flea-*` tokens, and inline hex values
  (wood-floor gradient, CTA edge color, contact shadow) are replaced with
  tokens.
- Add `apps/web/src/styles/tokens.test.ts` to fail the build if any TS token
  and CSS variable drift out of sync.
- Document the token system in `docs/specs/design-tokens.md` and link it from
  `docs/README.md`.

## Task Checklist
- [x] Read ticket #30 and confirm `agent active` + `claude` labels present.
- [x] Record scope in `.agent/ticket-30-plan.md`.
- [x] Extend `theme.ts` colors (forest deep, wood tones, aged paper, brass,
      warm shadow colors) and shadows (warm drop/cast/contact).
- [x] Add `tokens.css` with matching `--flea-*` custom properties.
- [x] Import `tokens.css` from `layout.tsx`.
- [x] Refactor `landing.css` to consume the tokens (scene gradient, copy card
      shadows, contact shadow, CTA edge colors).
- [x] Add `tokens.test.ts` parity test.
- [x] Add `docs/specs/design-tokens.md` and update `docs/README.md`.
- [x] Validate: workspace lint, typecheck, test (331 tests), build.

## Implementation Summary
- **Files added**:
  - `apps/web/src/styles/tokens.css` — `:root { --flea-*: ... }` definitions.
  - `apps/web/src/styles/tokens.test.ts` — parity with `theme.ts`.
  - `docs/specs/design-tokens.md` — token reference and extension guide.
- **Files modified**:
  - `apps/web/src/styles/theme.ts` — new `colors` + `shadows` tokens.
  - `apps/web/src/styles/landing.css` — references tokens instead of hex.
  - `apps/web/src/app/layout.tsx` — imports `tokens.css`.
  - `docs/README.md` — links the new design-tokens doc.
- **Estimated impact**: additive palette changes only; the landing page
  renders with identical values (same hex / rgba) because tokens.css mirrors
  the previously inlined literals. No runtime or API surface changes.
