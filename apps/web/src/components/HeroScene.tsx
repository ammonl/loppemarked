import type { CSSProperties, ReactNode } from "react";

/**
 * One raster layer in a layered hero composition. An asset is optional; when
 * `src` is not provided, `placeholder` is rendered instead so that the layer
 * slot stays addressable while final art is still in production.
 */
export interface SceneAsset {
  src?: string;
  alt?: string;
  objectFit?: CSSProperties["objectFit"];
  objectPosition?: CSSProperties["objectPosition"];
  placeholder?: ReactNode;
  style?: CSSProperties;
}

export interface HeroSceneProps {
  background?: SceneAsset;
  midground?: SceneAsset;
  foreground?: SceneAsset;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Layered hero composition primitive. Renders up to three raster layers
 * (background, midground, foreground) behind a live-DOM overlay slot so the
 * landing page can composite photography plus real text/controls without
 * rebuilding the page structure whenever assets change.
 */
export function HeroScene({
  background,
  midground,
  foreground,
  children,
  className,
  ariaLabel,
}: HeroSceneProps) {
  const rootClassName = ["hero-scene", className].filter(Boolean).join(" ");
  return (
    <div
      className={rootClassName}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      data-testid="hero-scene"
    >
      <SceneLayer asset={background} variant="bg" />
      <SceneLayer asset={midground} variant="mid" />
      <SceneLayer asset={foreground} variant="fg" />
      {children !== undefined && (
        <div className="hero-scene__overlay" data-testid="hero-scene-overlay">
          {children}
        </div>
      )}
    </div>
  );
}

interface SceneLayerProps {
  asset?: SceneAsset;
  variant: "bg" | "mid" | "fg";
}

function SceneLayer({ asset, variant }: SceneLayerProps) {
  if (!asset) return null;
  return (
    <div
      className={`hero-scene__layer hero-scene__layer--${variant}`}
      aria-hidden="true"
      data-testid={`hero-scene-layer-${variant}`}
    >
      {asset.src ? (
        <img
          src={asset.src}
          alt={asset.alt ?? ""}
          loading={variant === "bg" ? "eager" : "lazy"}
          decoding="async"
          style={{
            objectFit: asset.objectFit ?? "cover",
            objectPosition: asset.objectPosition,
            ...asset.style,
          }}
        />
      ) : (
        asset.placeholder ?? null
      )}
    </div>
  );
}
