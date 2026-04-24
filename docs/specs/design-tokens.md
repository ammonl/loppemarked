# Design Tokens

The web app keeps brand material tokens in two parallel, intentionally
synchronized files:

| Source | Consumers |
|--------|-----------|
| `apps/web/src/styles/theme.ts` | TypeScript / React inline styles |
| `apps/web/src/styles/tokens.css` | Plain CSS files (e.g. `landing.css`) |

`tokens.css` is imported once from `apps/web/src/app/layout.tsx` so every
`--flea-*` custom property is available on `:root` across the app. Parity
between the two files is asserted by `apps/web/src/styles/tokens.test.ts`,
which fails the build if a token is added, renamed, or changed on one side
only.

## Naming

Tokens are surface/role-based, not page-specific, so the same palette can be
reused across the landing page, the hall map, and the admin surfaces:

- **Neutrals** — `fleaInk`, `fleaInkSoft`, `fleaPenInk`, `fleaCream`,
  `fleaSand`, `fleaSandLight`.
- **Aged paper** — `fleaPaperAged`, `fleaPaperAgedShade`, `fleaPaperEdge`,
  plus the lighter `fleaNotePaper*` family.
- **Terracotta accent** — `fleaAccent`, `fleaAccentInk`, `fleaAccentGlow`,
  `fleaAccentPressed`, `fleaAccentEdge`, `fleaTerracotta`,
  `fleaTerracottaDark`, `fleaPinLight`, `fleaPinDark`.
- **Forest greens** — `fleaSage`, `fleaSageDark`, `fleaGreenDark`,
  `fleaGreenDarker`, `fleaForestDeep`, `fleaGreenDivider`.
- **Wood tones** — `fleaCork`, `fleaCorkDark`, `fleaCorkFrame`,
  `fleaCorkFrameDark`, `fleaWoodFloor`, `fleaWoodFloorDeep`,
  `fleaWoodFloorLow`, `fleaWoodFloorWarm`, `fleaFloorShadow`.
- **Brass / pin accents** — `fleaBrass`, `fleaBrassDark`.
- **Warm light & shadow** — `fleaSceneLightWarm`, `fleaShadowWarm`,
  `fleaShadowDeep`, `fleaShadowContact`, plus the composite box-shadow
  tokens `shadows.warmDrop`, `shadows.warmCast`, `shadows.warmContact`.

## Adding a new token

1. Add the constant to `colors` (or `shadows`) in `theme.ts`.
2. Add a matching `--flea-*` entry in `tokens.css`, keeping hyphen-case
   naming (e.g. `fleaAccentGlow` → `--flea-accent-glow`).
3. Add the pair to the corresponding `colorPairs` / `shadowPairs` array in
   `tokens.test.ts`.
4. Reference the token via `colors.X` in TypeScript or `var(--flea-x)` in
   CSS. Avoid re-declaring the hex value anywhere else.

## Scoped aliases

Component stylesheets may declare local CSS variables that alias the global
tokens — for example, `landing.css` exposes `--scene-*` inside
`.flea-landing` mapped onto `--flea-*`. This keeps component-local vocabulary
(e.g. "scene ink") readable while still routing through the shared palette.
