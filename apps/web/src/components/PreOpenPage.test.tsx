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
  let originalLocation: Location;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T09:59:50.000Z"));
    originalLocation = window.location;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders the share-your-treasures phrase, pre-open title, and eligibility copy", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    expect(screen.getByText("status.shareYourTreasures")).toBeDefined();
    expect(screen.getByText("status.preOpenTitle")).toBeDefined();
    expect(screen.getByText("status.eligibility")).toBeDefined();
  });

  it("renders the event date, time, and place so visitors can see when and where the loppemarked is", () => {
    render(<PreOpenPage openingDatetime={OPENING} />);

    const eventBlock = screen.getByTestId("flea-preopen-event");
    expect(within(eventBlock).getByText("status.eventDateLabel")).toBeDefined();
    expect(within(eventBlock).getByText("landing.eventDate")).toBeDefined();
    expect(within(eventBlock).getByText("status.eventTimeLabel")).toBeDefined();
    expect(within(eventBlock).getByText("landing.eventTime")).toBeDefined();
    expect(within(eventBlock).getByText("status.eventPlaceLabel")).toBeDefined();
    expect(within(eventBlock).getByText("landing.eventPlace")).toBeDefined();
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

  it("refreshes the page when the countdown completes", () => {
    vi.setSystemTime(new Date("2026-04-01T09:59:58.000Z"));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(<PreOpenPage openingDatetime={OPENING} />);

    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(reload).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not refresh if the page mounts after the countdown already finished", () => {
    vi.setSystemTime(new Date("2026-04-01T10:00:05.000Z"));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(<PreOpenPage openingDatetime={OPENING} />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(reload).not.toHaveBeenCalled();
  });

  it("waits for the server-aligned target before refreshing when the client clock is fast", () => {
    // Client clock reads 4s past opening, but the server is 10s slower, so
    // the server-aligned now is still 6s before opening. The page must not
    // auto-refresh until the server-aligned countdown actually reaches zero.
    vi.setSystemTime(new Date("2026-04-01T10:00:04.000Z"));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <PreOpenPage openingDatetime={OPENING} serverTimeOffsetMs={-10_000} />,
    );

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(reload).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
