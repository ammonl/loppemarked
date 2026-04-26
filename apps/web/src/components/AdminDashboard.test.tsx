import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminDashboard } from "./AdminDashboard";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: (key: string) => key }),
}));

vi.mock("./AdminRegistrations", () => ({
  AdminRegistrations: () => <div data-testid="registrations">Registrations</div>,
}));
vi.mock("./AdminWaitlist", () => ({
  AdminWaitlist: () => <div data-testid="waitlist">Waitlist</div>,
}));
vi.mock("./AdminTables", () => ({
  AdminTables: () => <div data-testid="tables">Tables</div>,
}));
vi.mock("./AdminMessaging", () => ({
  AdminMessaging: () => <div data-testid="messaging">Messaging</div>,
}));
vi.mock("./AdminSettings", () => ({
  AdminSettings: () => <div data-testid="settings">Settings</div>,
}));
vi.mock("./AdminAuditLog", () => ({
  AdminAuditLog: () => <div data-testid="audit">Audit</div>,
}));
vi.mock("./AdminAccount", () => ({
  AdminAccount: () => <div data-testid="account">Account</div>,
}));

describe("AdminDashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders all tabs including account", () => {
    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    expect(screen.getByText("admin.tab.registrations")).toBeDefined();
    expect(screen.getByText("admin.tab.waitlist")).toBeDefined();
    expect(screen.getByText("admin.tab.tables")).toBeDefined();
    expect(screen.getByText("admin.tab.messaging")).toBeDefined();
    expect(screen.getByText("admin.tab.settings")).toBeDefined();
    expect(screen.getByText("admin.tab.audit")).toBeDefined();
    expect(screen.getByText("admin.tab.account")).toBeDefined();
  });

  it("uses safe center alignment so long localized labels are not clipped on overflow", () => {
    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    const nav = screen.getByRole("tablist");
    expect(nav.style.justifyContent).toBe("safe center");
  });

  it("shows tables tab by default", () => {
    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    expect(screen.getByTestId("tables")).toBeDefined();
  });

  it("switches to account tab on click", () => {
    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    fireEvent.click(screen.getByText("admin.tab.account"));
    expect(screen.getByTestId("account")).toBeDefined();
  });

  it("renders logout button", () => {
    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    expect(screen.getByText("admin.logout")).toBeDefined();
  });

  it("calls onLogout after logout API call", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    await act(async () => {
      fireEvent.click(screen.getByText("admin.logout"));
    });

    expect(fetchMock).toHaveBeenCalledWith("/admin/auth/logout", expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("does not logout when confirm is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    await act(async () => {
      fireEvent.click(screen.getByText("admin.logout"));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("still logs out on network error", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const onLogout = vi.fn();
    render(<AdminDashboard onLogout={onLogout} />);

    await act(async () => {
      fireEvent.click(screen.getByText("admin.logout"));
    });

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
