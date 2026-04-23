## Analysis

### Current State
- The public header rendered the UN17 Village identity as plain styled text with a generic heart SVG.
- The favicon was the generic `favicon.ico`, not the botanical/heart doodle called for by the refreshed brand.
- The footer (`ProjectAbout`) had no logo variant to reinforce the crafted-paper feel.
- No success-state celebration was wired to the booking confirmation path.

### Target State
- A reusable `BrandLogo` component renders a hand-crafted `UN17 Village` SVG wordmark (Caveat-style signature, letter-by-letter wobble) paired with a botanical heart-and-leaf doodle drawn as SVG paths.
- Public header uses the primary Sage Green `#8DA88D` logo variant on a cream `#FDFBF7` background at the fixed top-left.
- Footer uses a faded Terracotta `#C6705D` stamped variant of the same mark.
- `app/icon.svg` is simplified to just the heart/botanical doodle and is auto-used as the site favicon.
- Successful bookings emit a `un17:booking-success` event that the header logo subscribes to, triggering a brief pulse/wiggle on the doodle.

### Approach
- Isolate the logo as a single reusable component (`BrandLogo.tsx`) with `header` / `footer` / `mark` variants.
- Implement the success animation hook via a tiny module-scoped event bus (`brandEvents.ts`) so the booking path does not need to thread a callback up through parents.
- Keep styling local to the new component and minimize other visual regressions.

## Task Checklist
- [x] Create GitHub issue #38 for the logo update
- [x] Add `agent active` and `claude` labels to issue #38
- [x] Create branch `claude/ticket-38-87m4y`
- [x] Create the SVG `UN17 Village` logo component with botanical/heart doodle
- [x] Update the public header to place the logo at the top-left on cream
- [x] Add the simplified stamped footer logo variant
- [x] Replace `app/icon.svg` with the simplified heart-doodle favicon
- [x] Add the subtle success-state doodle animation hook
- [x] Lint / typecheck / build / vitest all pass
- [ ] Desktop/mobile visual QA in browser (dev server unavailable in sandbox; build succeeds)

## Implementation Summary
- New files:
  - `apps/web/src/components/BrandLogo.tsx` — wordmark + doodle SVG component.
  - `apps/web/src/utils/brandEvents.ts` — booking-success event bus.
- Updated files:
  - `apps/web/src/app/page.tsx` — public header uses `BrandLogo` on cream background.
  - `apps/web/src/components/ProjectAbout.tsx` — stamped footer logo variant.
  - `apps/web/src/components/RegistrationForm.tsx` — emits success event on booking.
  - `apps/web/src/app/layout.tsx` — drop explicit favicon metadata (Next.js auto-uses `icon.svg`).
  - `apps/web/src/app/icon.svg` — simplified heart/botanical doodle favicon.
- Impact: branding-focused update to the public header/footer/favicon and booking-success feedback path. No API or schema changes.
