import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LandingPage } from "./LandingPage";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", ready: true, setLanguage: vi.fn(), t: (key: string) => key }),
}));

describe("LandingPage", () => {
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

  it("renders corkboard with date, place, and time notes", () => {
    render(<LandingPage onEnter={() => {}} />);

    expect(screen.getByText("landing.eventDateLabel")).toBeDefined();
    expect(screen.getByText("landing.eventDateValue")).toBeDefined();
    expect(screen.getByText("landing.eventPlaceLabel")).toBeDefined();
    expect(screen.getByText("landing.eventPlaceValue")).toBeDefined();
    expect(screen.getByText("landing.eventTimeLabel")).toBeDefined();
    expect(screen.getByText("landing.eventTimeValue")).toBeDefined();
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

    const root = screen.getByRole("group", { name: "landing.corkboardTitle" }).closest("section");
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

  it("places the text, corkboard, and CTA inside the live-DOM overlay", () => {
    render(<LandingPage onEnter={() => {}} />);

    const overlay = screen.getByTestId("flea-landing-overlay");
    expect(overlay.contains(screen.getByText("landing.heroTitle"))).toBe(true);
    expect(overlay.contains(screen.getByRole("group", { name: "landing.corkboardTitle" }))).toBe(true);
    expect(overlay.contains(screen.getByRole("button", { name: /landing\.primaryCta/ }))).toBe(true);
  });

  it("no longer renders the flat inline-SVG hero illustration or icon vignettes", () => {
    render(<LandingPage onEnter={() => {}} />);

    const section = screen.getByRole("group", { name: "landing.corkboardTitle" }).closest("section");
    expect(section?.querySelector(".flea-hero-illustration")).toBeNull();
    expect(section?.querySelector(".flea-vignettes")).toBeNull();
    expect(section?.querySelector(".flea-vignette")).toBeNull();
  });
});
