import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { PreOpenPage } from "./PreOpenPage";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({
    language: "en",
    ready: true,
    setLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

const OPENING = "2026-04-01T10:00:00.000Z";

describe("PreOpenPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T09:59:50.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders the share-your-treasures phrase, pre-open title, and eligibility copy", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    expect(screen.getByText("status.shareYourTreasures")).toBeDefined();
    expect(screen.getByText("status.preOpenTitle")).toBeDefined();
    expect(screen.getByText("status.eligibility")).toBeDefined();
  });

  it("does not reference greenhouses or planter boxes", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    const overlay = screen.getByTestId("flea-preopen-overlay");
    const markup = overlay.outerHTML.toLowerCase();
    expect(markup.includes("greenhouse")).toBe(false);
    expect(markup.includes("planter")).toBe(false);
    expect(markup.includes("drivhus")).toBe(false);
    expect(markup.includes("plantekasse")).toBe(false);
  });

  it("composes the layered hero scene with a background layer", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    expect(screen.getByTestId("hero-scene")).toBeDefined();
    expect(screen.getByTestId("hero-scene-layer-bg")).toBeDefined();
  });

  it("renders the countdown as a flip-board with day/hour/minute/second tiles", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    const board = screen.getByTestId("flea-flipboard");
    expect(within(board).getByText("status.countdownDays")).toBeDefined();
    expect(within(board).getByText("status.countdownHours")).toBeDefined();
    expect(within(board).getByText("status.countdownMinutes")).toBeDefined();
    expect(within(board).getByText("status.countdownSeconds")).toBeDefined();

    expect(board.querySelectorAll(".flea-flipboard__card").length).toBeGreaterThan(0);
  });

  it("ticks the countdown forward as time passes", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    const board = screen.getByTestId("flea-flipboard");
    const initial = board.textContent ?? "";

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    const after = board.textContent ?? "";
    expect(after).not.toBe(initial);
  });
});
