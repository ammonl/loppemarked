import type { CSSProperties, ReactNode } from "react";

/**
 * A single <source> entry for art-directed raster delivery. When `media` is
 * set, the browser picks this source only when the query matches, letting the
 * same layer ship a mobile crop and a desktop crop from one slot.
 */
export interface SceneAssetSource {
  srcSet: string;
  media?: string;
  type?: string;
}

/**
 * One raster layer in a layered hero composition. An asset is optional; when
 * `src` is not provided, `placeholder` is rendered instead so that the layer
 * slot stays addressable while final art is still in production.
 */
export interface SceneAsset {
  src?: string;
  sources?: SceneAssetSource[];
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
  overlayAbove?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Layered hero composition primitive. Stacks up to three raster layers around
 * a live-DOM overlay slot: `background` and `midground` sit behind the
 * overlay, `foreground` composites on top of it so props read like objects in
 * front of the scene. Overlay layers use `pointer-events: none`, so
 * interactive overlay content stays clickable through transparent parts of
 * the foreground raster.
 */
export function HeroScene({
  background,
  midground,
  foreground,
  children,
  overlayAbove,
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
      {overlayAbove !== undefined && (
        <div
          className="hero-scene__overlay hero-scene__overlay--above"
          data-testid="hero-scene-overlay-above"
        >
          {overlayAbove}
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
  // All hero layers render above the fold, so anything with a raster loads eagerly;
  // lazy-loading here would just delay the LCP.
  const loading = "eager";
  const imgStyle: CSSProperties = {
    objectFit: asset.objectFit ?? "cover",
    objectPosition: asset.objectPosition,
    ...asset.style,
  };

  const renderImg = () =>
    asset.src ? (
      <img
        src={asset.src}
        alt={asset.alt ?? ""}
        loading={loading}
        decoding="async"
        style={imgStyle}
      />
    ) : null;

  return (
    <div
      className={`hero-scene__layer hero-scene__layer--${variant}`}
      aria-hidden="true"
      data-testid={`hero-scene-layer-${variant}`}
    >
      {asset.sources && asset.sources.length > 0 ? (
        <picture>
          {asset.sources.map((source, i) => (
            <source
              key={i}
              srcSet={source.srcSet}
              media={source.media}
              type={source.type}
            />
          ))}
          {renderImg()}
        </picture>
      ) : (
        (renderImg() ?? asset.placeholder ?? null)
      )}
    </div>
  );
}
