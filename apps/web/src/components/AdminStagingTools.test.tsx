import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminStagingTools } from "./AdminStagingTools";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: (key: string) => key }),
}));

describe("AdminStagingTools", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders title and both action buttons", () => {
    render(<AdminStagingTools />);

    expect(screen.getByText("admin.staging.title")).toBeDefined();
    expect(screen.getByText("admin.staging.warning")).toBeDefined();
    expect(screen.getAllByText("admin.staging.fillTables")).toHaveLength(2);
    expect(screen.getAllByText("admin.staging.clearRegistrations")).toHaveLength(2);
  });

  it("renders descriptions for both actions", () => {
    render(<AdminStagingTools />);

    expect(screen.getByText("admin.staging.fillTablesDescription")).toBeDefined();
    expect(screen.getByText("admin.staging.clearRegistrationsDescription")).toBeDefined();
  });

  it("does not call fetch when confirm is cancelled for fill tables", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const fillButton = buttons.find((b) => b.textContent === "admin.staging.fillTables")!;

    await act(async () => {
      fireEvent.click(fillButton);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows success message after fill tables", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ filledCount: 25 }),
    }));

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const fillButton = buttons.find((b) => b.textContent === "admin.staging.fillTables")!;

    await act(async () => {
      fireEvent.click(fillButton);
    });

    expect(screen.getByRole("alert").textContent).toBe("25 admin.staging.fillTablesSuccess");
  });

  it("shows error message when fill tables fails", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Only available in staging" }),
    }));

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const fillButton = buttons.find((b) => b.textContent === "admin.staging.fillTables")!;

    await act(async () => {
      fireEvent.click(fillButton);
    });

    expect(screen.getByRole("alert").textContent).toBe("Only available in staging");
  });

  it("shows success message after clear registrations", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clearedCount: 10 }),
    }));

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const clearButton = buttons.find((b) => b.textContent === "admin.staging.clearRegistrations")!;

    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(screen.getByRole("alert").textContent).toBe("10 admin.staging.clearRegistrationsSuccess");
  });

  it("shows generic error on network failure", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    vi.stubGlobal("console", { ...console, error: vi.fn() });

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const fillButton = buttons.find((b) => b.textContent === "admin.staging.fillTables")!;

    await act(async () => {
      fireEvent.click(fillButton);
    });

    expect(screen.getByRole("alert").textContent).toBe("common.error");
  });

  it("handles non-JSON error response gracefully", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    }));

    render(<AdminStagingTools />);

    const buttons = screen.getAllByRole("button");
    const fillButton = buttons.find((b) => b.textContent === "admin.staging.fillTables")!;

    await act(async () => {
      fireEvent.click(fillButton);
    });

    expect(screen.getByRole("alert").textContent).toBe("common.error (HTTP 502)");
  });
});
