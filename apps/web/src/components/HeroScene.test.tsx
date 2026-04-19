import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroScene } from "./HeroScene";

describe("HeroScene", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all three layers when every slot is provided", () => {
    render(
      <HeroScene
        background={{ src: "/bg.png", alt: "" }}
        midground={{ src: "/mid.png", alt: "" }}
        foreground={{ src: "/fg.png", alt: "" }}
      />
    );

    expect(screen.getByTestId("hero-scene-layer-bg")).toBeDefined();
    expect(screen.getByTestId("hero-scene-layer-mid")).toBeDefined();
    expect(screen.getByTestId("hero-scene-layer-fg")).toBeDefined();
  });

  it("omits layers whose asset slot is undefined", () => {
    render(<HeroScene background={{ src: "/bg.png", alt: "" }} />);

    expect(screen.getByTestId("hero-scene-layer-bg")).toBeDefined();
    expect(screen.queryByTestId("hero-scene-layer-mid")).toBeNull();
    expect(screen.queryByTestId("hero-scene-layer-fg")).toBeNull();
  });

  it("renders the placeholder node when an asset has no src", () => {
    render(
      <HeroScene
        midground={{ placeholder: <span data-testid="mid-placeholder">placeholder</span> }}
      />
    );

    expect(screen.getByTestId("mid-placeholder")).toBeDefined();
  });

  it("renders overlay children on top of the layer stack", () => {
    render(
      <HeroScene background={{ src: "/bg.png", alt: "" }}>
        <p>overlay content</p>
      </HeroScene>
    );

    const overlay = screen.getByTestId("hero-scene-overlay");
    expect(overlay).toBeDefined();
    expect(overlay.textContent).toBe("overlay content");
  });

  it("exposes an accessible label when ariaLabel is provided", () => {
    render(
      <HeroScene ariaLabel="Flea market scene" background={{ src: "/bg.png", alt: "" }} />
    );

    expect(screen.getByRole("img", { name: "Flea market scene" })).toBeDefined();
  });

  it("renders <picture> <source> entries when an asset supplies responsive sources", () => {
    render(
      <HeroScene
        background={{
          src: "/bg-desktop.webp",
          sources: [
            { srcSet: "/bg-mobile.webp", media: "(max-width: 760px)", type: "image/webp" },
          ],
          alt: "",
        }}
      />
    );

    const bgLayer = screen.getByTestId("hero-scene-layer-bg");
    const sources = bgLayer.querySelectorAll("source");
    expect(sources.length).toBe(1);
    expect(sources[0].getAttribute("media")).toBe("(max-width: 760px)");
    expect(sources[0].getAttribute("srcset")).toBe("/bg-mobile.webp");
    expect(bgLayer.querySelector("img")?.getAttribute("src")).toBe("/bg-desktop.webp");
  });
});
