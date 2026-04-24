import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LandingPage } from "./LandingPage";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", ready: true, setLanguage: vi.fn(), t: (key: string) => key }),
}));

interface MockMatchMedia {
  mql: {
    matches: boolean;
    media: string;
    onchange: null;
    addEventListener: (event: string, listener: (event: MediaQueryListEvent) => void) => void;
    removeEventListener: (event: string, listener: (event: MediaQueryListEvent) => void) => void;
    addListener: () => void;
    removeListener: () => void;
    dispatchEvent: () => boolean;
  };
  setMatches: (matches: boolean) => void;
}

function mockMatchMedia(matches: boolean): MockMatchMedia {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql: MockMatchMedia["mql"] = {
    matches,
    media: "",
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
  window.matchMedia = vi.fn().mockImplementation(() => mql) as unknown as typeof window.matchMedia;
  const setMatches = (next: boolean) => {
    mql.matches = next;
    listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
  };
  return { mql, setMatches };
}

describe("LandingPage (desktop scene)", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders hero title, supporting copy, and CTA", () => {
    render(<LandingPage onEnter={() => {}} />);

    expect(screen.getByText("landing.heroTitle")).toBeDefined();
    expect(screen.getByText("landing.heroBody")).toBeDefined();
    expect(screen.getByRole("button", { name: /landing\.primaryCta/ })).toBeDefined();
  });

  it("calls onEnter when CTA is clicked", () => {
    const handler = vi.fn();
    render(<LandingPage onEnter={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /landing\.primaryCta/ }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("disables CTA when no onEnter handler is provided", () => {
    render(<LandingPage />);

    const cta = screen.getByRole("button", { name: /landing\.primaryCta/ }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it("does not reference greenhouses, planter boxes, or box names", () => {
    render(<LandingPage onEnter={() => {}} />);

    const root = screen.getByTestId("flea-landing-overlay").closest("section");
    const markup = root?.outerHTML.toLowerCase() ?? "";
    expect(markup.includes("greenhouse")).toBe(false);
    expect(markup.includes("planter")).toBe(false);
    expect(markup.includes("drivhus")).toBe(false);
    expect(markup.includes("plantekasse")).toBe(false);
  });

  it("renders a layered hero scene with a background layer", () => {
    render(<LandingPage onEnter={() => {}} />);

    const scene = screen.getByTestId("hero-scene");
    expect(scene).toBeDefined();
    expect(screen.getByTestId("hero-scene-layer-bg")).toBeDefined();
  });

  it("places the text inside the live-DOM overlay and the CTA above the hero", () => {
    render(<LandingPage onEnter={() => {}} />);

    const overlay = screen.getByTestId("flea-landing-overlay");
    expect(overlay.contains(screen.getByText("landing.heroTitle"))).toBe(true);
    expect(screen.getByRole("button", { name: /landing\.primaryCta/ })).toBeDefined();
  });

  it("no longer renders the flat inline-SVG hero illustration or icon vignettes", () => {
    render(<LandingPage onEnter={() => {}} />);

    const section = screen.getByTestId("flea-landing-overlay").closest("section");
    expect(section?.querySelector(".flea-hero-illustration")).toBeNull();
    expect(section?.querySelector(".flea-vignettes")).toBeNull();
    expect(section?.querySelector(".flea-vignette")).toBeNull();
  });

  it("does not mount the dedicated mobile composition when the viewport is wide", () => {
    render(<LandingPage onEnter={() => {}} />);

    expect(screen.queryByTestId("flea-landing-mobile")).toBeNull();
  });
});

describe("LandingPage (mobile scene)", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the dedicated mobile composition rather than the desktop scene", () => {
    render(<LandingPage onEnter={() => {}} />);

    expect(screen.getByTestId("flea-landing-mobile")).toBeDefined();
    expect(screen.queryByTestId("hero-scene")).toBeNull();
  });

  it("stacks the title, framed hero raster, paper-card copy, and CTA", () => {
    render(<LandingPage onEnter={() => {}} />);

    const mobile = screen.getByTestId("flea-landing-mobile");
    const title = screen.getByText("landing.heroTitle");
    const hero = screen.getByTestId("flea-landing-mobile-hero");
    const copy = screen.getByTestId("flea-landing-overlay");
    const cta = screen.getByRole("button", { name: /landing\.primaryCta/ });

    expect(mobile.contains(title)).toBe(true);
    expect(mobile.contains(hero)).toBe(true);
    expect(mobile.contains(copy)).toBe(true);
    expect(mobile.contains(cta)).toBe(true);

    const children = Array.from(mobile.children);
    const order = [title.closest("header"), hero, copy, cta.closest("div")];
    order.forEach((node, index) => {
      expect(node).not.toBeNull();
      expect(children.indexOf(node as Element)).toBe(index);
    });
  });

  it("uses the mobile hero asset directly with meaningful alt text", () => {
    render(<LandingPage onEnter={() => {}} />);

    const img = screen
      .getByTestId("flea-landing-mobile-hero")
      .querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/landing/landing-hero-mobile.webp");
    expect(img?.getAttribute("alt")).toBe("landing.heroAlt");
  });

  it("fires onEnter when the mobile CTA is clicked", () => {
    const handler = vi.fn();
    render(<LandingPage onEnter={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /landing\.primaryCta/ }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("disables the mobile CTA when no handler is provided", () => {
    render(<LandingPage />);

    const cta = screen.getByRole("button", { name: /landing\.primaryCta/ }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});

describe("LandingPage (viewport resize)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("swaps from desktop to mobile when the media query flips post-mount", async () => {
    const { setMatches } = mockMatchMedia(false);
    render(<LandingPage onEnter={() => {}} />);

    expect(screen.getByTestId("hero-scene")).toBeDefined();
    expect(screen.queryByTestId("flea-landing-mobile")).toBeNull();

    await act(async () => {
      setMatches(true);
    });

    expect(screen.getByTestId("flea-landing-mobile")).toBeDefined();
    expect(screen.queryByTestId("hero-scene")).toBeNull();
  });
});
