import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { TABLE_CATALOG, type TablePublic } from "@loppemarked/shared";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", ready: true, setLanguage: vi.fn(), t: (key: string) => key }),
}));
vi.mock("@/hooks/useHistoryState", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    useHistoryState: <T,>(_key: string, initial: T): [T, (v: T) => void] => {
      return react.useState<T>(initial);
    },
  };
});
vi.mock("./LoadingSplash", () => ({
  LoadingSplash: () => <div data-testid="loading-splash" />,
}));
vi.mock("./WaitlistForm", () => ({
  WaitlistForm: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="waitlist-form">
      <button data-testid="waitlist-cancel" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
vi.mock("./RegistrationForm", () => ({
  RegistrationForm: ({ tableId, onCancel, onSuccess }: { tableId: number; onCancel: () => void; onSuccess?: () => void }) => (
    <div data-testid="registration-form" data-table-id={tableId}>
      <button data-testid="reg-success" onClick={onSuccess ?? onCancel}>Book</button>
      <button data-testid="reg-cancel" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

function makeAllAvailable(): TablePublic[] {
  return TABLE_CATALOG.map((t) => ({
    id: t.id,
    state: "available" as const,
  }));
}

function makeAllOccupied(): TablePublic[] {
  return TABLE_CATALOG.map((t) => ({
    id: t.id,
    state: "occupied" as const,
  }));
}

function makeFetchMock(tables: TablePublic[]) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(tables), { status: 200 }));
}

describe("TableMapPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading splash while tables are being fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    expect(screen.getByTestId("loading-splash")).toBeDefined();
  });

  it("fetches /public/tables on mount and renders the numbered map", async () => {
    const fetchMock = makeFetchMock(makeAllAvailable());
    vi.stubGlobal("fetch", fetchMock);

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    expect(fetchMock).toHaveBeenCalledWith("/public/tables");
    expect(screen.getByTestId("table-tile-1")).toBeDefined();
    expect(screen.getByTestId("table-tile-23")).toBeDefined();
    expect(screen.getByTestId("table-tile-24")).toBeDefined();
    // id 25 is outside the catalog after extending to 24 tables.
    expect(screen.queryByTestId("table-tile-25")).toBeNull();
    expect(screen.getByText("table.pageTitle")).toBeDefined();
  });

  it("opens the detail panel when an available table is clicked and shows Book Nu", async () => {
    vi.stubGlobal("fetch", makeFetchMock(makeAllAvailable()));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("table-tile-12"));
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getAllByText("table.bookNow").length).toBeGreaterThan(0);
  });

  it("renders RegistrationForm after clicking Book Nu", async () => {
    vi.stubGlobal("fetch", makeFetchMock(makeAllAvailable()));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("table-tile-5"));
    });

    const bookNowButtons = screen.getAllByText("table.bookNow");
    await act(async () => {
      fireEvent.click(bookNowButtons[0]);
    });

    const form = screen.getByTestId("registration-form");
    expect(form).toBeDefined();
    expect(form.getAttribute("data-table-id")).toBe("5");
  });

  it("opens a read-only detail panel showing booked status when a booked table is clicked", async () => {
    vi.stubGlobal("fetch", makeFetchMock(makeAllOccupied()));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("table-tile-7"));
    });

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("table.detailsBookedStatus")).toBeDefined();
    expect(screen.queryByText("table.bookNow")).toBeNull();
  });

  it("shows the full-capacity waitlist notice when no tables are available", async () => {
    vi.stubGlobal("fetch", makeFetchMock(makeAllOccupied()));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    expect(screen.getByText("table.allBookedTitle")).toBeDefined();
    expect(screen.getByText("table.allBookedBody")).toBeDefined();
    expect(screen.getByText("table.joinWaitlistCta")).toBeDefined();
  });

  it("switches into the waitlist form when the waitlist CTA is clicked", async () => {
    vi.stubGlobal("fetch", makeFetchMock(makeAllOccupied()));

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("table.joinWaitlistCta"));
    });

    expect(screen.getByTestId("waitlist-form")).toBeDefined();
  });

  it("refetches tables after a successful booking and closes the panel", async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      call += 1;
      const tables =
        call === 1
          ? makeAllAvailable()
          : makeAllAvailable().map((t) => (t.id === 5 ? { ...t, state: "occupied" as const } : t));
      return Promise.resolve(new Response(JSON.stringify(tables), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { TableMapPage } = await import("./TableMapPage");

    await act(async () => {
      render(<TableMapPage onBack={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("table-tile-5"));
    });

    const bookNowButtons = screen.getAllByText("table.bookNow");
    await act(async () => {
      fireEvent.click(bookNowButtons[0]);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("reg-success"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("registration-form")).toBeNull();
  });
});
