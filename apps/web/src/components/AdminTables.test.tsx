import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminTables } from "./AdminTables";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: (key: string) => key }),
}));

Element.prototype.scrollIntoView = vi.fn();

vi.mock("./NotificationComposer", () => ({
  NotificationComposer: () => <div data-testid="notification-composer" />,
}));

const mockTables = [
  { id: 1, state: "available", registration: null },
  { id: 2, state: "occupied", registration: { id: "r1", name: "Alice", email: "alice@test.com", language: "en" } },
  { id: 3, state: "reserved", registration: null },
];

describe("AdminTables", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders tables with action buttons", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    expect(screen.getByText("admin.tables.title")).toBeDefined();
    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("admin.tables.reserve")).toBeDefined();
    expect(screen.getByText("admin.tables.removeRegistration")).toBeDefined();
    expect(screen.getByText("admin.tables.release")).toBeDefined();
  });

  it("shows reserve dialog when Reserve is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.reserve"));
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/admin.tables.confirmReserve/)).toBeDefined();
  });

  it("calls reserve API when confirmed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTables })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tableId: 1, state: "reserved" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTables });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.reserve"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("common.confirm"));
    });

    const reserveCall = fetchMock.mock.calls[1];
    expect(reserveCall[0]).toBe("/admin/tables/reserve");
    expect(JSON.parse(reserveCall[1].body)).toEqual({ tableId: 1 });
  });

  it("shows release dialog when Release is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.release"));
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/admin.tables.confirmRelease/)).toBeDefined();
  });

  it("shows remove registration dialog with notification composer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.removeRegistration"));
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/admin.tables.confirmRemoveRegistration/)).toBeDefined();
    expect(screen.getByText(/admin.tables.occupiedBy/)).toBeDefined();
    expect(screen.getByTestId("notification-composer")).toBeDefined();
  });

  it("shows add registration dialog for available tables", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    const addButtons = screen.getAllByText("admin.tables.addRegistration");
    await act(async () => {
      fireEvent.click(addButtons[0]);
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByLabelText(/admin.registrations.addName/)).toBeDefined();
    expect(screen.getByLabelText(/admin.registrations.addEmail/)).toBeDefined();
  });

  it("defaults language to English when add-registration dialog opens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    const addButtons = screen.getAllByText("admin.tables.addRegistration");
    await act(async () => {
      fireEvent.click(addButtons[0]);
    });

    const languageSelect = screen.getByLabelText(/admin.registrations.addLanguage/) as HTMLSelectElement;
    expect(languageSelect.value).toBe("en");
  });

  it("scrolls add-registration dialog into view when opened", async () => {
    const scrollMock = vi.fn();
    Element.prototype.scrollIntoView = scrollMock;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    const addButtons = screen.getAllByText("admin.tables.addRegistration");
    await act(async () => {
      fireEvent.click(addButtons[0]);
    });

    expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });

  it("scrolls remove-registration dialog into view when opened", async () => {
    const scrollMock = vi.fn();
    Element.prototype.scrollIntoView = scrollMock;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.removeRegistration"));
    });

    expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });

  it("shows registrant name next to booked table", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    expect(screen.getByText("(Alice)")).toBeDefined();
  });

  it("shows error state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));

    await act(async () => {
      render(<AdminTables />);
    });

    expect(screen.getByText("common.error")).toBeDefined();
  });

  it("disables action buttons when a dialog is open", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTables,
    }));

    await act(async () => {
      render(<AdminTables />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("admin.tables.reserve"));
    });

    const removeBtn = screen.getByText("admin.tables.removeRegistration");
    expect(removeBtn.hasAttribute("disabled")).toBe(true);
  });
});
