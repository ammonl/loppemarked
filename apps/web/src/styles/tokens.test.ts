import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { colors, shadows } from "./theme";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parity test: every `--flea-*` custom property in `tokens.css` must match a
 * token in `theme.ts`, and every declared CSS variable must appear in the
 * pairs array below. The checks run in both directions so a typo
 * (`--flea-wod-floor`) or an orphan CSS var can't sneak in.
 */

const cssPath = path.resolve(moduleDir, "tokens.css");
const cssSource = readFileSync(cssPath, "utf8");

function readCssVar(name: string): string {
  const match = cssSource.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`CSS variable --${name} not found in tokens.css`);
  return match[1].trim();
}

const colorPairs: Array<[string, string]> = [
  ["flea-ink", colors.fleaInk],
  ["flea-ink-soft", colors.fleaInkSoft],
  ["flea-pen-ink", colors.fleaPenInk],
  ["flea-cream", colors.fleaCream],
  ["flea-sand", colors.fleaSand],
  ["flea-sand-light", colors.fleaSandLight],
  ["flea-paper-aged", colors.fleaPaperAged],
  ["flea-paper-aged-shade", colors.fleaPaperAgedShade],
  ["flea-paper-edge", colors.fleaPaperEdge],
  ["flea-note-paper", colors.fleaNotePaper],
  ["flea-note-paper-warm", colors.fleaNotePaperWarm],
  ["flea-note-paper-light", colors.fleaNotePaperLight],
  ["flea-terracotta", colors.fleaTerracotta],
  ["flea-terracotta-dark", colors.fleaTerracottaDark],
  ["flea-accent-ink", colors.fleaAccentInk],
  ["flea-accent-glow", colors.fleaAccentGlow],
  ["flea-accent-pressed", colors.fleaAccentPressed],
  ["flea-accent-edge", colors.fleaAccentEdge],
  ["flea-pin-light", colors.fleaPinLight],
  ["flea-pin-dark", colors.fleaPinDark],
  ["flea-sage", colors.fleaSage],
  ["flea-sage-dark", colors.fleaSageDark],
  ["flea-green-dark", colors.fleaGreenDark],
  ["flea-green-darker", colors.fleaGreenDarker],
  ["flea-forest-deep", colors.fleaForestDeep],
  ["flea-green-divider", colors.fleaGreenDivider],
  ["flea-cork", colors.fleaCork],
  ["flea-cork-dark", colors.fleaCorkDark],
  ["flea-cork-frame", colors.fleaCorkFrame],
  ["flea-cork-frame-dark", colors.fleaCorkFrameDark],
  ["flea-wood-floor", colors.fleaWoodFloor],
  ["flea-wood-floor-deep", colors.fleaWoodFloorDeep],
  ["flea-wood-floor-low", colors.fleaWoodFloorLow],
  ["flea-wood-floor-warm", colors.fleaWoodFloorWarm],
  ["flea-floor-shadow", colors.fleaFloorShadow],
  ["flea-brass", colors.fleaBrass],
  ["flea-brass-dark", colors.fleaBrassDark],
  ["flea-scene-light-warm", colors.fleaSceneLightWarm],
  ["flea-shadow-warm", colors.fleaShadowWarm],
  ["flea-shadow-deep", colors.fleaShadowDeep],
  ["flea-shadow-contact", colors.fleaShadowContact],
];

const shadowPairs: Array<[string, string]> = [
  ["flea-shadow-warm-drop", shadows.warmDrop],
  ["flea-shadow-warm-cast", shadows.warmCast],
  ["flea-shadow-warm-contact", shadows.warmContact],
];

function listCssVars(): string[] {
  const names: string[] = [];
  const pattern = /--(flea-[a-z0-9-]+):/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cssSource)) !== null) {
    names.push(match[1]);
  }
  return names;
}

describe("tokens.css", () => {
  it.each(colorPairs)("exposes color token --%s matching theme.ts", (name, value) => {
    expect(readCssVar(name)).toBe(value);
  });

  it.each(shadowPairs)("exposes shadow token --%s matching theme.ts", (name, value) => {
    expect(readCssVar(name)).toBe(value);
  });

  it("has no orphan CSS variables without a matching TS token", () => {
    const declared = new Set(listCssVars());
    const expected = new Set([
      ...colorPairs.map(([name]) => name),
      ...shadowPairs.map(([name]) => name),
    ]);
    const orphans = [...declared].filter((name) => !expected.has(name));
    expect(orphans).toEqual([]);
  });
});
