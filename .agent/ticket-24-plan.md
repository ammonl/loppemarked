## Analysis

### Current State
- `apps/web/src/components/LandingPage.tsx` renders the hero as a single 320x320 inline SVG (`HeroIllustration`) with flat vector bunting, tables, figures, and props, plus a row of small inline-SVG icon "vignettes" (`MarketScene` / `VignetteItem`).
- `apps/web/src/styles/landing.css` is written around that illustration: `.flea-hero-illustration` is a square container sized by `aspect-ratio`, and the vignettes are rigid 44px icon tiles.
- This rendering strategy cannot carry a photorealistic, composited flea-market scene — depth, overlap, and atmosphere all have to come from raster assets, not vectors.

### Target State
- The hero is a layered composition made of three optional raster layers (background / midground / foreground) plus a live DOM overlay that holds text, the corkboard, and the CTA.
- The layer definitions are data-driven so swapping an asset is a one-line config change, never a component rewrite.
- The inline-SVG `HeroIllustration` and the small inline-SVG icon "vignettes" are retired as the primary visual strategy.

### Approach
1. Add a generic, asset-agnostic `HeroScene` component under `apps/web/src/components/` that renders up to three raster layers (background, midground, foreground) with CSS-driven z-index stacking plus an overlay slot.
2. Add a data file (`apps/web/src/components/landing/sceneConfig.ts`) that declares the asset slots the landing page wants to fill. Today only a background slot is pointed at the existing `public/landing.png` placeholder; the other slots are declared but empty, proving asset swaps don't need a structural rewrite.
3. Refactor `LandingPage.tsx` so the eyebrow, title, body, corkboard, and CTA are rendered inside `HeroScene`'s overlay slot. Remove `HeroIllustration` (inline SVG hero) and `MarketScene` / `VignetteItem` (inline-SVG icon vignettes).
4. Rework `landing.css` to describe the scene via `.hero-scene`, `.hero-scene__layer`, and `.hero-scene__overlay` instead of `.flea-hero-illustration` + `.flea-vignettes`.
5. Update `LandingPage.test.tsx` to assert the new architecture (scene container present, text/corkboard/CTA are in the overlay, no inline SVG hero).
6. Add a short architecture note under `docs/` describing the layered scene and how to swap assets.

## Task Checklist
- [x] Create GitHub issue #24
- [x] Add `agent active` and `claude` labels
- [x] Create branch `claude/ticket-24-hTTnQ` from latest `main`
- [x] Record scope in `.agent/ticket-24-plan.md`
- [x] Add `HeroScene` layered composition component
- [x] Add `sceneConfig.ts` data file for asset slots
- [x] Refactor `LandingPage.tsx` to drop inline-SVG hero + icon vignettes
- [x] Update `landing.css` with `.hero-scene` layer + overlay styles
- [x] Update `LandingPage.test.tsx` to cover the new architecture
- [x] Document the layered hero architecture under `docs/`
- [x] Run tests, lint, build

## Implementation Summary
- Primary area: `apps/web`
- Docs: `docs/architecture` gets a short section describing the layered landing hero.
- Estimated impact: landing-page structural refactor only. No API, schema, or shared package changes.
