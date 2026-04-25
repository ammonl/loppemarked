import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { RegistrationForm } from "./RegistrationForm";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({
    language: "en",
    ready: true,
    setLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

describe("RegistrationForm — floor/door state", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  it("clears stale floor/door state when the house number no longer requires them", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    render(<RegistrationForm tableId={1} onCancel={vi.fn()} />);

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
    fireEvent.click(screen.getByRole("button", { name: "table.bookNow" }));

    await waitFor(() => {
      expect(global.fetch as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.houseNumber).toBe(122);
    expect(body.floor).toBeNull();
    expect(body.door).toBeNull();
  });
});
