import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminWaitlist } from "./AdminWaitlist";

const stableT = (key: string) => key;
vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: stableT }),
}));

vi.mock("@/utils/formatDate", () => ({
  formatDate: (iso: string) => iso,
  formatDateTime: (iso: string) => iso,
}));

vi.mock("./NotificationComposer", () => ({
  NotificationComposer: ({ value, onChange }: { value: { sendEmail: boolean; subject: string; bodyHtml: string; valid: boolean }; onChange: (v: { sendEmail: boolean; subject: string; bodyHtml: string; valid: boolean }) => void }) => (
    <div data-testid="notification-composer">
      <label>
        <input
          type="checkbox"
          checked={value.sendEmail}
          onChange={(e) => onChange({ ...value, sendEmail: e.target.checked })}
          data-testid="send-email-checkbox"
        />
        Send
      </label>
    </div>
  ),
}));

const waitlistEntries = [
  {
    id: "w1",
    name: "Carol",
    email: "carol@test.com",
    street: "Else Alfelts Vej",
    house_number: 180,
    floor: "1",
    door: "th",
    apartment_key: "Else Alfelts Vej 180, 1. th",
    language: "da",
    status: "waiting",
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "w2",
    name: "Dave",
    email: "dave@test.com",
    street: "Else Alfelts Vej",
    house_number: 190,
    floor: null,
    door: null,
    apartment_key: "Else Alfelts Vej 190",
    language: "en",
    status: "assigned",
    created_at: "2026-01-20T10:00:00Z",
  },
];

function mockFetch(responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 400),
      json: async () => resp.body,
    });
  });
}

describe("AdminWaitlist", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("list view", () => {
    it("defaults to showing only waiting entries", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      expect(screen.getByText("Carol")).toBeDefined();
      expect(screen.queryByText("Dave")).toBeNull();
    });

    it("shows empty state when no entries", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: [] }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      expect(screen.getByText("admin.waitlist.noEntries")).toBeDefined();
    });

    it("shows assign button for waiting entries only", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      const assignButtons = screen.getAllByText("admin.waitlist.assign");
      expect(assignButtons).toHaveLength(1);
    });
  });

  describe("assign flow", () => {
    it("opens assign dialog with box ID input and notification composer", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      expect(screen.getByText("admin.waitlist.confirmAssign – Carol")).toBeDefined();
      expect(screen.getByLabelText("admin.waitlist.assignTableId")).toBeDefined();
    });

    it("shows notification composer when box ID is entered", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      fireEvent.change(screen.getByLabelText("admin.waitlist.assignTableId"), { target: { value: "5" } });
      expect(screen.getByTestId("notification-composer")).toBeDefined();
    });

    it("disables occupied boxes and appends (occupied) suffix in assign dialog", async () => {
      const boxesData = [
        { id: 1, state: "occupied" },
        { id: 5, state: "available" },
      ];
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: boxesData },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      const boxSelect = screen.getByLabelText("admin.waitlist.assignTableId") as HTMLSelectElement;
      const options = Array.from(boxSelect.options);

      const occupiedOption = options.find((o) => o.value === "1");
      expect(occupiedOption?.disabled).toBe(true);
      expect(occupiedOption?.textContent).toContain("(occupied)");

      const availableOption = options.find((o) => o.value === "5");
      expect(availableOption?.disabled).toBe(false);
      expect(availableOption?.textContent).not.toContain("(occupied)");
    });

    it("submits assignment successfully", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
        { ok: true, status: 201, body: { registrationId: "r5", waitlistEntryId: "w1", tableId: 5 } },
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      fireEvent.change(screen.getByLabelText("admin.waitlist.assignTableId"), { target: { value: "5" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      const assignCall = fetchMock.mock.calls[2];
      expect(assignCall[0]).toBe("/admin/waitlist/assign");
      const assignBody = JSON.parse(assignCall[1].body);
      expect(assignBody.waitlistEntryId).toBe("w1");
      expect(assignBody.tableId).toBe(5);
      expect(assignBody.notification).toBeDefined();
      expect(assignBody.notifyDownstream).toBe(false);
      expect(screen.getByText("admin.waitlist.assigned")).toBeDefined();
    });

    it("submits assignment with notifyDownstream=true when checkbox is checked", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
        { ok: true, status: 201, body: { registrationId: "r5", waitlistEntryId: "w1", tableId: 5 } },
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      fireEvent.change(screen.getByLabelText("admin.waitlist.assignTableId"), { target: { value: "5" } });

      const notifyCheckbox = screen.getByLabelText(/admin.waitlist.notifyDownstream/) as HTMLInputElement;
      expect(notifyCheckbox.checked).toBe(false);
      fireEvent.click(notifyCheckbox);
      expect(notifyCheckbox.checked).toBe(true);

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      const assignCall = fetchMock.mock.calls[2];
      const assignBody = JSON.parse(assignCall[1].body);
      expect(assignBody.notifyDownstream).toBe(true);
    });

    it("shows error on assign failure", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: false, body: { error: "Box is already occupied" } },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      fireEvent.change(screen.getByLabelText("admin.waitlist.assignTableId"), { target: { value: "5" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert").textContent).toBe("Box is already occupied");
    });

    it("closes dialog on cancel", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      expect(screen.getByLabelText("admin.waitlist.assignTableId")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("common.cancel"));
      });

      expect(screen.queryByLabelText("admin.waitlist.assignTableId")).toBeNull();
    });

    it("shows validation error for invalid box ID", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.assign"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert").textContent).toBe("common.error");
    });
  });

  describe("remove flow", () => {
    it("shows remove button for waiting entries only", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      const removeButtons = screen.getAllByText("admin.waitlist.remove");
      expect(removeButtons).toHaveLength(1);
    });

    it("opens confirmation dialog when remove is clicked", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: waitlistEntries }]));

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.remove"));
      });

      expect(screen.getByText("admin.waitlist.confirmRemove – Carol")).toBeDefined();
      expect(screen.getByText("admin.waitlist.removeConfirmHint")).toBeDefined();
    });

    it("closes confirmation dialog on cancel without calling DELETE", async () => {
      const fetchMock = mockFetch([{ ok: true, body: waitlistEntries }]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.remove"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("common.cancel"));
      });

      expect(screen.queryByText("admin.waitlist.confirmRemove – Carol")).toBeNull();
      expect(fetchMock.mock.calls.every((call) => call[1]?.method !== "DELETE")).toBe(true);
    });

    it("issues DELETE and refreshes list on successful remove", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
        { ok: true, status: 204, body: null },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.remove"));
      });

      const confirmButton = screen.getAllByText("admin.waitlist.remove").find(
        (el) => el.tagName === "BUTTON" && (el as HTMLButtonElement).type === "button" && el.closest("[role='dialog']") !== null,
      );
      expect(confirmButton).toBeDefined();

      await act(async () => {
        fireEvent.click(confirmButton as HTMLElement);
      });

      const deleteCall = fetchMock.mock.calls.find((call) => call[1]?.method === "DELETE");
      expect(deleteCall).toBeDefined();
      expect(deleteCall?.[0]).toBe("/admin/waitlist/w1");
      const deleteBody = JSON.parse(deleteCall?.[1]?.body as string);
      expect(deleteBody.notifyDownstream).toBe(false);
      expect(screen.getByText("admin.waitlist.removed")).toBeDefined();
    });

    it("sends notifyDownstream=true in DELETE body when checkbox is checked", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
        { ok: true, status: 204, body: null },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.remove"));
      });

      const notifyCheckbox = screen.getByLabelText(/admin.waitlist.notifyDownstream/) as HTMLInputElement;
      expect(notifyCheckbox.checked).toBe(false);
      fireEvent.click(notifyCheckbox);
      expect(notifyCheckbox.checked).toBe(true);

      const confirmButton = screen.getAllByText("admin.waitlist.remove").find(
        (el) => el.tagName === "BUTTON" && (el as HTMLButtonElement).type === "button" && el.closest("[role='dialog']") !== null,
      );

      await act(async () => {
        fireEvent.click(confirmButton as HTMLElement);
      });

      const deleteCall = fetchMock.mock.calls.find((call) => call[1]?.method === "DELETE");
      expect(deleteCall).toBeDefined();
      const deleteBody = JSON.parse(deleteCall?.[1]?.body as string);
      expect(deleteBody.notifyDownstream).toBe(true);
    });

    it("shows error message and keeps dialog open on remove failure", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: waitlistEntries },
        { ok: true, body: [] },
        { ok: false, status: 404, body: { error: "Waitlist entry not found" } },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminWaitlist />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.waitlist.remove"));
      });

      const confirmButton = screen.getAllByText("admin.waitlist.remove").find(
        (el) => el.tagName === "BUTTON" && el.closest("[role='dialog']") !== null,
      );

      await act(async () => {
        fireEvent.click(confirmButton as HTMLElement);
      });

      expect(screen.getByRole("alert").textContent).toBe("Waitlist entry not found");
      expect(screen.getByText("admin.waitlist.confirmRemove – Carol")).toBeDefined();
    });
  });
});
