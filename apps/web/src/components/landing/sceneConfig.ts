import type { SceneAsset } from "@/components/HeroScene";

/**
 * Asset slots for the landing-page layered hero. Each slot is optional and can
 * be pointed at a new raster without changing any component code — that's the
 * contract this file exists to uphold.
 *
 * The placeholder background keeps the scene visually intact while final
 * photorealistic assets are still in production (ticket #24 is explicitly
 * scoped to the architecture, not the final art).
 */
export interface LandingSceneAssets {
  background?: SceneAsset;
  midground?: SceneAsset;
  foreground?: SceneAsset;
}

export const landingSceneAssets: LandingSceneAssets = {
  background: {
    src: "/landing.png",
    alt: "",
    objectFit: "cover",
    objectPosition: "center bottom",
  },
  midground: undefined,
  foreground: undefined,
};
