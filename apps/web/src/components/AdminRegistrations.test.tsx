import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { AdminRegistrations } from "./AdminRegistrations";

const stableT = (key: string) => key;
vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: stableT }),
}));

Element.prototype.scrollIntoView = vi.fn();

vi.mock("@/utils/formatDate", () => ({
  formatDate: (iso: string) => iso,
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

const registrations = [
  {
    id: "r1",
    box_id: 1,
    name: "Alice",
    email: "alice@test.com",
    street: "Else Alfelts Vej",
    house_number: 150,
    floor: "2",
    door: "tv",
    apartment_key: "Else Alfelts Vej 150, 2. tv",
    language: "da",
    status: "active",
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "r2",
    box_id: 5,
    name: "Bob",
    email: "bob@test.com",
    street: "Else Alfelts Vej",
    house_number: 160,
    floor: null,
    door: null,
    apartment_key: "Else Alfelts Vej 160",
    language: "en",
    status: "removed",
    created_at: "2026-01-10T10:00:00Z",
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

describe("AdminRegistrations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("list view", () => {
    it("renders bookings table after fetch defaulting to active filter", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("#1")).toBeDefined();
      expect(screen.queryByText("Bob")).toBeNull();
    });

    it("shows all registrations when filter changed to all", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      const statusSelect = screen.getByRole("combobox");
      fireEvent.change(statusSelect, { target: { value: "__all__" } });

      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
    });

    it("shows empty state when no registrations", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: [] }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      expect(screen.getByText("admin.registrations.noRegistrations")).toBeDefined();
    });

    it("shows table size column for each booking without price", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      expect(screen.getByText("admin.registrations.tableSize")).toBeDefined();
      expect(screen.queryByText("admin.registrations.tablePrice")).toBeNull();
      expect(screen.getByText("2 m")).toBeDefined();
      expect(screen.queryByText(/DKK/)).toBeNull();
    });

    it("shows move and remove buttons for active registrations only", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      const moveButtons = screen.getAllByText("admin.registrations.move");
      const removeButtons = screen.getAllByText("admin.registrations.remove");
      expect(moveButtons).toHaveLength(1);
      expect(removeButtons).toHaveLength(1);
    });

    it("shows add button", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      expect(screen.getByText("admin.registrations.add")).toBeDefined();
    });

    it("shows error on fetch failure", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: false, body: {} }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      expect(screen.getByText("common.error")).toBeDefined();
    });
  });

  describe("add flow", () => {
    it("defaults language to English when add dialog opens", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      const languageSelect = screen.getByLabelText("admin.registrations.addLanguage *") as HTMLSelectElement;
      expect(languageSelect.value).toBe("en");
    });

    it("opens add dialog and submits successfully with floor-required house number", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: [] },
        { ok: true, status: 201, body: { id: "r3", boxId: 10, apartmentKey: "Test" } },
        { ok: true, body: registrations },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      expect(screen.getByLabelText("admin.registrations.addName *")).toBeDefined();
      expect(screen.getByLabelText("admin.registrations.addEmail *")).toBeDefined();
      expect(screen.getByLabelText("admin.registrations.addTableId *")).toBeDefined();

      fireEvent.change(screen.getByLabelText("admin.registrations.addName *"), { target: { value: "Carol" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addEmail *"), { target: { value: "carol@test.com" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "170" } });

      expect(screen.getByLabelText("admin.registrations.addFloor *")).toBeDefined();
      fireEvent.change(screen.getByLabelText("admin.registrations.addFloor *"), { target: { value: "2" } });

      fireEvent.change(screen.getByLabelText("admin.registrations.addTableId *"), { target: { value: "10" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      const createCall = fetchMock.mock.calls[2];
      expect(createCall[0]).toBe("/admin/registrations");
      expect(createCall[1].method).toBe("POST");
      const createBody = JSON.parse(createCall[1].body);
      expect(createBody.street).toBe("Else Alfelts Vej");
      expect(createBody.houseNumber).toBe(170);
      expect(createBody.floor).toBe("2");
      expect(screen.getByText("admin.registrations.added")).toBeDefined();
    });

    it("submits successfully with non-floor house number", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: [] },
        { ok: true, status: 201, body: { id: "r3", boxId: 10, apartmentKey: "Test" } },
        { ok: true, body: registrations },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.addName *"), { target: { value: "Carol" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addEmail *"), { target: { value: "carol@test.com" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "130" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addTableId *"), { target: { value: "10" } });

      expect(screen.queryByLabelText("admin.registrations.addFloor *")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(screen.getByText("admin.registrations.added")).toBeDefined();
    });

    it("shows street as disabled with hard-coded value", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      const streetInput = screen.getByLabelText("admin.registrations.addStreet") as HTMLInputElement;
      expect(streetInput.disabled).toBe(true);
      expect(streetInput.value).toBe("Else Alfelts Vej");
    });

    it("shows validation errors when required fields are missing", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("validation.nameRequired")).toBeDefined();
    });

    it("shows floor validation error when floor required but missing", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.addName *"), { target: { value: "Carol" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addEmail *"), { target: { value: "carol@test.com" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "170" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addTableId *"), { target: { value: "10" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("validation.floorDoorRequired")).toBeDefined();
    });

    it("shows error on add failure", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: false, body: { error: "Table is already occupied" } },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.addName *"), { target: { value: "Carol" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addEmail *"), { target: { value: "carol@test.com" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "170" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addFloor *"), { target: { value: "2" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addTableId *"), { target: { value: "10" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert").textContent).toBe("Table is already occupied");
    });

    it("resets floor/door when house number changes", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "170" } });
      expect(screen.getByLabelText("admin.registrations.addFloor *")).toBeDefined();

      fireEvent.change(screen.getByLabelText("admin.registrations.addFloor *"), { target: { value: "2" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addDoor"), { target: { value: "tv" } });

      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "130" } });
      expect(screen.queryByLabelText("admin.registrations.addFloor *")).toBeNull();
      expect(screen.queryByLabelText("admin.registrations.addDoor")).toBeNull();
    });

    it("shows invalid email error for malformed email", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.addName *"), { target: { value: "Carol" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addEmail *"), { target: { value: "notanemail" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addHouseNumber *"), { target: { value: "130" } });
      fireEvent.change(screen.getByLabelText("admin.registrations.addTableId *"), { target: { value: "10" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("validation.emailInvalid")).toBeDefined();
    });

    it("renders table dropdown with numbered labels in add dialog", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      const boxSelect = screen.getByLabelText("admin.registrations.addTableId *") as HTMLSelectElement;
      expect(boxSelect.tagName).toBe("SELECT");

      const options = Array.from(boxSelect.options);
      expect(options[0].textContent).toBe("admin.registrations.selectTable");
      expect(options[0].value).toBe("");
      expect(options[1].textContent).toBe("Table #1 · 2 m");
      expect(options[1].value).toBe("1");
      // id 22 is intentionally absent from the published map; option index
      // 22 corresponds to table 23 and the row count is 1 placeholder + 23
      // visible tables.
      expect(options[22].textContent).toBe("Table #23 · 2 m");
      expect(options[22].value).toBe("23");
      expect(options).toHaveLength(24);
    });

    it("disables occupied tables and appends (occupied) suffix in add dialog", async () => {
      const boxesData = [
        { id: 1, name: "Linaria", greenhouse: "Kronen", state: "occupied" },
        { id: 7, name: "Alder", greenhouse: "Kronen", state: "available" },
        { id: 15, name: "Robin", greenhouse: "Søen", state: "available" },
      ];
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: boxesData },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      const boxSelect = screen.getByLabelText("admin.registrations.addTableId *") as HTMLSelectElement;
      const options = Array.from(boxSelect.options);

      const linariaOption = options.find((o) => o.value === "1");
      expect(linariaOption?.disabled).toBe(true);
      expect(linariaOption?.textContent).toContain("(occupied)");

      const alderOption = options.find((o) => o.value === "7");
      expect(alderOption?.disabled).toBe(false);
      expect(alderOption?.textContent).not.toContain("(occupied)");
    });

    it("sorts available tables before occupied tables in add dialog", async () => {
      const boxesData = Array.from({ length: 29 }, (_, i) => ({
        id: i + 1,
        name: `Box${i + 1}`,
        greenhouse: i < 14 ? "Kronen" : "Søen",
        state: i === 0 ? "occupied" : "available",
      }));
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: boxesData },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      const boxSelect = screen.getByLabelText("admin.registrations.addTableId *") as HTMLSelectElement;
      const options = Array.from(boxSelect.options).slice(1);
      const lastOption = options[options.length - 1];
      expect(lastOption.value).toBe("1");
      expect(lastOption.disabled).toBe(true);
    });

    it("closes add dialog on cancel", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.add"));
      });

      expect(screen.getByLabelText("admin.registrations.addName *")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("common.cancel"));
      });

      expect(screen.queryByLabelText("admin.registrations.addName *")).toBeNull();
    });
  });

  describe("scroll into view", () => {
    it("scrolls move dialog into view when opened", async () => {
      const scrollMock = vi.fn();
      Element.prototype.scrollIntoView = scrollMock;

      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });

    it("scrolls remove dialog into view when opened", async () => {
      const scrollMock = vi.fn();
      Element.prototype.scrollIntoView = scrollMock;

      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.remove"));
      });

      expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });
  });

  describe("move flow", () => {
    it("opens move dialog and submits successfully", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: [] },
        { ok: true, body: { registrationId: "r1", newBoxId: 3 } },
        { ok: true, body: registrations },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      expect(screen.getByLabelText("admin.registrations.newTableId")).toBeDefined();

      fireEvent.change(screen.getByLabelText("admin.registrations.newTableId"), { target: { value: "3" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      const moveCall = fetchMock.mock.calls[2];
      expect(moveCall[0]).toBe("/admin/registrations/move");
      const moveBody = JSON.parse(moveCall[1].body);
      expect(moveBody.registrationId).toBe("r1");
      expect(moveBody.newBoxId).toBe(3);
      expect(screen.getByText("admin.registrations.moved")).toBeDefined();
    });

    it("renders table dropdown with numbered labels in move dialog", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      const boxSelect = screen.getByLabelText("admin.registrations.newTableId") as HTMLSelectElement;
      expect(boxSelect.tagName).toBe("SELECT");

      const options = Array.from(boxSelect.options);
      expect(options[0].textContent).toBe("admin.registrations.selectTable");
      expect(options[22].textContent).toBe("Table #23 · 2 m");
    });

    it("does not disable the current table in move dialog", async () => {
      const boxesData = [
        { id: 1, name: "Linaria", greenhouse: "Kronen", state: "occupied" },
        { id: 3, name: "Foxglove", greenhouse: "Kronen", state: "occupied" },
        { id: 7, name: "Alder", greenhouse: "Kronen", state: "available" },
      ];
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: boxesData },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      const boxSelect = screen.getByLabelText("admin.registrations.newTableId") as HTMLSelectElement;
      const options = Array.from(boxSelect.options);

      const currentBoxOption = options.find((o) => o.value === "1");
      expect(currentBoxOption?.disabled).toBe(false);
      expect(currentBoxOption?.textContent).not.toContain("(occupied)");

      const otherOccupiedOption = options.find((o) => o.value === "3");
      expect(otherOccupiedOption?.disabled).toBe(true);
      expect(otherOccupiedOption?.textContent).toContain("(occupied)");
    });

    it("shows error when move submitted without selecting a table", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert").textContent).toBe("common.error");
    });

    it("shows error on move failure", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: false, body: { error: "Target table is already occupied" } },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.move"));
      });

      fireEvent.change(screen.getByLabelText("admin.registrations.newTableId"), { target: { value: "3" } });

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(screen.getByRole("alert").textContent).toBe("Target table is already occupied");
    });
  });

  describe("remove flow", () => {
    it("opens remove dialog with release options and submits", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: [] },
        { ok: true, body: { registrationId: "r1", boxReleased: true } },
        { ok: true, body: registrations },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.remove"));
      });

      expect(screen.getByText("admin.registrations.releasePublic")).toBeDefined();
      expect(screen.getByText("admin.registrations.releaseReserved")).toBeDefined();
      expect(screen.getByTestId("notification-composer")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      const removeCall = fetchMock.mock.calls[2];
      expect(removeCall[0]).toBe("/admin/registrations/remove");
      const removeBody = JSON.parse(removeCall[1].body);
      expect(removeBody.registrationId).toBe("r1");
      expect(removeBody.makeBoxPublic).toBe(true);
      expect(screen.getByText("admin.registrations.removed")).toBeDefined();
    });

    it("submits with reserved hold when selected", async () => {
      const fetchMock = mockFetch([
        { ok: true, body: registrations },
        { ok: true, body: [] },
        { ok: true, body: { registrationId: "r1", boxReleased: false } },
        { ok: true, body: registrations },
        { ok: true, body: [] },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.remove"));
      });

      fireEvent.click(screen.getByText("admin.registrations.releaseReserved"));

      await act(async () => {
        fireEvent.click(screen.getByText("common.confirm"));
      });

      const removeBody = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(removeBody.makeBoxPublic).toBe(false);
    });

    it("closes remove dialog on cancel", async () => {
      vi.stubGlobal("fetch", mockFetch([{ ok: true, body: registrations }]));

      await act(async () => {
        render(<AdminRegistrations />);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("admin.registrations.remove"));
      });

      expect(screen.getByText("admin.registrations.releasePublic")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("common.cancel"));
      });

      expect(screen.queryByText("admin.registrations.releasePublic")).toBeNull();
    });
  });
});
