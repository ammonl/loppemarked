import type { SceneAsset } from "@/components/HeroScene";

/**
 * Asset slots for the landing-page layered hero. Each slot is optional and can
 * be pointed at a new raster without changing any component code — that's the
 * contract this file exists to uphold.
 */
export interface LandingSceneAssets {
  background?: SceneAsset;
  midground?: SceneAsset;
  foreground?: SceneAsset;
}

export const LANDING_MOBILE_MEDIA_QUERY = "(max-width: 760px)";

export const landingSceneAssets: LandingSceneAssets = {
  background: {
    src: "/landing/landing-hero-desktop.webp",
    sources: [
      {
        srcSet: "/landing/landing-hero-mobile.webp",
        media: LANDING_MOBILE_MEDIA_QUERY,
        type: "image/webp",
      },
    ],
    alt: "",
    objectFit: "cover",
    objectPosition: "center bottom",
  },
  midground: undefined,
  foreground: {
    src: "/landing/landing-props-foreground.webp",
    alt: "",
    style: {
      position: "absolute",
      bottom: 0,
      left: 0, 
      width: "100%",
      height: "auto",
      transform: "translateY(15%)",
    },
  },
};
