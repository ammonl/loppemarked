import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { AdminPage } from "./AdminPage";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: (key: string) => key }),
}));

vi.mock("./AdminLogin", () => ({
  AdminLogin: ({ onLogin }: { onLogin: () => void }) => (
    <div data-testid="admin-login">
      <button onClick={onLogin}>Login</button>
    </div>
  ),
}));

vi.mock("./AdminDashboard", () => ({
  AdminDashboard: ({ onLogout }: { onLogout: () => void }) => (
    <div data-testid="admin-dashboard">
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}));

function mockFetchResponse(ok: boolean) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 401,
    json: async () => (ok ? { authenticated: true, adminId: "admin-1" } : { error: "Unauthorized" }),
  });
}

describe("AdminPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows loading state while checking session", async () => {
    let resolveCheck!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => { resolveCheck = resolve; }),
    ));

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText("common.loading")).toBeDefined();
    expect(screen.queryByTestId("admin-login")).toBeNull();
    expect(screen.queryByTestId("admin-dashboard")).toBeNull();

    await act(async () => {
      resolveCheck({ ok: false, status: 401, json: async () => ({}) } as Response);
    });
  });

  it("shows dashboard when session is valid", async () => {
    vi.stubGlobal("fetch", mockFetchResponse(true));

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("admin-dashboard")).toBeDefined();
    });

    expect(screen.queryByTestId("admin-login")).toBeNull();
  });

  it("shows login when session is invalid", async () => {
    vi.stubGlobal("fetch", mockFetchResponse(false));

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("admin-login")).toBeDefined();
    });

    expect(screen.queryByTestId("admin-dashboard")).toBeNull();
  });

  it("shows login when session check fails (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("admin-login")).toBeDefined();
    });
  });

  it("transitions to dashboard after successful login", async () => {
    vi.stubGlobal("fetch", mockFetchResponse(false));

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("admin-login")).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Login"));
    });

    expect(screen.getByTestId("admin-dashboard")).toBeDefined();
    expect(screen.queryByTestId("admin-login")).toBeNull();
  });

  it("transitions to login after logout", async () => {
    vi.stubGlobal("fetch", mockFetchResponse(true));

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("admin-dashboard")).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Logout"));
    });

    expect(screen.getByTestId("admin-login")).toBeDefined();
    expect(screen.queryByTestId("admin-dashboard")).toBeNull();
  });

  it("calls /admin/auth/me with credentials on mount", async () => {
    const fetchMock = mockFetchResponse(true);
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(<AdminPage />);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/auth/me", { credentials: "include" });
    });
  });
});
