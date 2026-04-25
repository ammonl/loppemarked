import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { WaitlistForm } from "./WaitlistForm";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({
    language: "en",
    ready: true,
    setLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("registration.nameLabel *"), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByLabelText("registration.emailLabel *"), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(screen.getByLabelText("registration.houseNumberLabel *"), {
    target: { value: "130" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("WaitlistForm — blocked when apartment already has a table", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  it("renders the dedicated already-has-table confirmation when API returns 409 APARTMENT_HAS_REGISTRATION", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "This apartment already has a table.",
        code: "APARTMENT_HAS_REGISTRATION",
      }),
    });

    render(<WaitlistForm onCancel={vi.fn()} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "waitlist.joinButton" }));

    await waitFor(() => {
      expect(screen.getByText("waitlist.alreadyHasTableTitle")).toBeDefined();
    });
    expect(screen.getByText("waitlist.alreadyHasTableBody")).toBeDefined();
    // The waitlist success / position banner must NOT be shown.
    expect(screen.queryByText("waitlist.success")).toBeNull();
    expect(screen.queryByText("waitlist.positionLabel")).toBeNull();
  });

  it("clears stale floor/door state when the house number no longer requires them", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ alreadyOnWaitlist: false, position: 1 }),
    });

    render(<WaitlistForm onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("registration.nameLabel *"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByLabelText("registration.emailLabel *"), {
      target: { value: "alice@example.com" },
    });
    // Start with a house number that requires floor/door (138).
    fireEvent.change(screen.getByLabelText("registration.houseNumberLabel *"), {
      target: { value: "138" },
    });
    fireEvent.change(screen.getByLabelText("registration.floorLabel *"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("registration.doorLabel"), {
      target: { value: "tv" },
    });
    // Switch to a house number that does NOT require floor/door (122).
    fireEvent.change(screen.getByLabelText("registration.houseNumberLabel *"), {
      target: { value: "122" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "waitlist.joinButton" }));

    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.houseNumber).toBe(122);
    expect(body.floor).toBeNull();
    expect(body.door).toBeNull();
  });

  it("falls back to a generic error for unrelated non-OK responses", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    });

    render(<WaitlistForm onCancel={vi.fn()} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "waitlist.joinButton" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("boom");
    });
    expect(screen.queryByText("waitlist.alreadyHasTableTitle")).toBeNull();
  });
});
