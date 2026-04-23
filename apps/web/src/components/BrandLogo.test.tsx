import { describe, expect, it, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";
import { emitBookingSuccess } from "@/utils/brandEvents";

describe("BrandLogo", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the header variant with an accessible name", () => {
    const { container, getByRole } = render(<BrandLogo variant="header" />);
    expect(getByRole("img", { name: "UN17 Village" })).toBeTruthy();
    const doodle = container.querySelector("[data-un17-doodle]");
    expect(doodle).toBeTruthy();
  });

  it("hides itself from AT when marked decorative", () => {
    const { container } = render(<BrandLogo variant="header" decorative />);
    const span = container.querySelector("span[aria-hidden='true']");
    expect(span).toBeTruthy();
  });

  it("renders the footer variant with rotated stamped feel", () => {
    const { container } = render(<BrandLogo variant="footer" />);
    const doodle = container.querySelector("[data-un17-doodle]");
    expect(doodle).toBeTruthy();
  });

  it("wiggles the doodle when a booking-success event is emitted", async () => {
    const { container } = render(<BrandLogo variant="header" reactToBookingSuccess />);
    const initial = container.querySelector(".un17-doodle");
    expect(initial).toBeTruthy();
    expect(initial?.classList.contains("un17-doodle--wiggle")).toBe(false);

    await act(async () => {
      emitBookingSuccess();
    });

    await waitFor(() => {
      const after = container.querySelector(".un17-doodle");
      expect(after?.classList.contains("un17-doodle--wiggle")).toBe(true);
    });
  });

  it("does not subscribe when reactToBookingSuccess is not set", () => {
    const { container } = render(<BrandLogo variant="header" />);
    act(() => {
      emitBookingSuccess();
    });
    const doodle = container.querySelector(".un17-doodle");
    expect(doodle?.classList.contains("un17-doodle--wiggle")).toBe(false);
  });
});
