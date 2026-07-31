# Web app (apps/web, Next.js 15 / React 19 App Router) — verified facts

### `@un17/logo` web component (#278 logo migration)
- App consumes the shared `<un17-logo>` custom element via a `"use client"`
  wrapper `Un17Logo.tsx` that defers `import("@un17/logo")` into a `useEffect`
  — the package bundle runs browser-only code (`class extends HTMLElement`,
  `customElements.define`), so a top-level/static import would `ReferenceError`
  during SSR. The effect-deferred import is the correct SSR-safe pattern.
- Consequence/tradeoff to flag on any change here: `<un17-logo>` is EMPTY in the
  SSR HTML and until the dynamic chunk resolves post-hydration → logo is absent
  on first paint, then pops in with no reserved space (FOUC/CLS). The old inline
  BrandLogo rendered its SVG server-side. No width/height reserves box space.
- Package internals (`node_modules/@un17/logo/un17-logo.js`, v1.0.3):
  `connectedCallback` sets `role="img"` + `aria-label="UN17 Village"` UNLESS the
  host already has them; guards define with `if (!customElements.get(...))`
  (double-mount safe). Header uses `#8DA88D` (=theme `fleaSage`), footer
  `#C6705D` (=`fleaTerracotta`) — colors match theme tokens. Requires the host
  page to load "Amatic SC" + "Caveat" fonts (loaded in `app/layout.tsx` Google
  Fonts link; document-level @font-face is visible inside the shadow root).
- Accessibility: header passes `aria-hidden` (parent button self-labels via
  `aria-label={t("common.appName")}`) — aria-hidden prunes the subtree so the
  component's own role/aria-label are harmlessly overridden. Footer passes
  nothing → relies on the component's default role=img/aria-label (parity with
  old BrandLogo). JSX typing uses `declare module "react" { namespace JSX {
  interface IntrinsicElements }}` — correct React 19 form (global `JSX` ns
  deprecated); a `declare module "@un17/logo";` stub covers the untyped package.
- Removed booking-success event bus (`utils/brandEvents.ts`,
  `emitBookingSuccess`/`onBookingSuccess`): its ONLY consumer was BrandLogo's
  wiggle-on-booking effect. Migration dropped both cleanly (no dangling
  consumers). `onBookingSuccess` prop in `TableMapPage.tsx` is UNRELATED (a
  local success callback), not the deleted event bus — don't confuse them.
