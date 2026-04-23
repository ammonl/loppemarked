## Analysis

### Current State
- The public header in `apps/web/src/app/page.tsx` renders as a cream/white bar with
  the brand centered between two flex slots, a tiny faded "Admin" link, and the
  language selector on the right. The header matches the light cream landing
  background but reads as thin and minimal.
- The same header is shared with the admin view via a `publicView` branch. Admin
  chrome is explicitly out of scope for this ticket.

### Target State
- The public header becomes a dark green branded navigation bar:
  - Deep green background (new `fleaGreenDark` token in `theme.ts`) with a subtle
    inner divider so it reads as an opaque bar over any hero.
  - Left-aligned wordmark "UN17 Village Loppemarked" with a leaf/pin glyph, in
    cream/white to sit on the dark green.
  - Right cluster contains: navigation links (Home + About anchor), admin access,
    and the language selector, each restyled for dark backgrounds.
- Admin view keeps its existing cream/tan chrome (unchanged).
- The language selector already reads theme tokens; drive its tone via a `dark`
  variant prop so it renders cream labels on green without leaking into admin.

### Approach
- Extend `theme.ts` with a `fleaGreenDark` (and matching hover/divider) token.
- In `apps/web/src/app/page.tsx`:
  - Keep the header `<header>` element but swap the public-view styles: left-align
    brand, introduce a `<nav>` group, and restyle admin/language controls for the
    dark bar.
  - Add an anchor-link "About" nav item that scrolls to the existing
    `ProjectAbout` footer (give the footer an `id="about"`).
  - Preserve the existing home-button behavior for `common.appName`.
- Add `dark` variant to `LanguageSelector` so divider + label colors work on the
  green bar without breaking admin usage.
- Extend `translations.ts` with `nav.home` and `nav.about` keys (da/en).

### Task Checklist
- [x] Create GitHub issue #27
- [x] Add `agent active` and `claude` labels
- [x] Record scope in `.agent/ticket-27-plan.md`
- [ ] Add `fleaGreenDark` + supporting tokens in `theme.ts`
- [ ] Replace public header with dark green bar, left-aligned brand, and nav links
- [ ] Add `dark` variant support to `LanguageSelector`
- [ ] Add `nav.home` / `nav.about` translations (da + en)
- [ ] Ensure responsive collapse for narrow viewports
- [ ] Run web tests + lint + build

## Implementation Summary
- Primary area: `apps/web`
- Files touched:
  - `apps/web/src/app/page.tsx` (header chrome)
  - `apps/web/src/styles/theme.ts` (color tokens)
  - `apps/web/src/components/LanguageSelector.tsx` (dark variant)
  - `apps/web/src/components/ProjectAbout.tsx` (`id="about"` anchor target)
  - `apps/web/src/i18n/translations.ts` (nav translations)
- Estimated impact: visual-only for public site; admin unchanged.
