import { describe, expect, it } from "vitest";
import {
  resolveTableLabel,
  formatAddressFromSnapshot,
  formatApartmentKeyAsAddress,
  formatEventDetails,
} from "./AuditTimeline";

describe("resolveTableLabel", () => {
  const labels = { "5": "Table #5", "10": "Table #10" };

  it("resolves a numeric box ID", () => {
    expect(resolveTableLabel(5, labels)).toBe("Table #5");
  });

  it("resolves a string box ID", () => {
    expect(resolveTableLabel("10", labels)).toBe("Table #10");
  });

  it("returns null for missing ID", () => {
    expect(resolveTableLabel(99, labels)).toBeNull();
  });

  it("returns null for null/undefined/boolean input", () => {
    expect(resolveTableLabel(null, labels)).toBeNull();
    expect(resolveTableLabel(undefined, labels)).toBeNull();
    expect(resolveTableLabel(true, labels)).toBeNull();
  });
});

describe("formatAddressFromSnapshot", () => {
  it("formats street and house number", () => {
    expect(formatAddressFromSnapshot({ street: "Else Alfelts Vej", house_number: 42 })).toBe("Else Alfelts Vej 42");
  });

  it("formats with floor and door", () => {
    expect(formatAddressFromSnapshot({ street: "Else Alfelts Vej", house_number: 180, floor: "4", door: "th" })).toBe(
      "Else Alfelts Vej 180 4. th",
    );
  });

  it("formats with floor only", () => {
    expect(formatAddressFromSnapshot({ street: "Else Alfelts Vej", house_number: 10, floor: "st" })).toBe(
      "Else Alfelts Vej 10 st.",
    );
  });

  it("uses alternate field names", () => {
    expect(
      formatAddressFromSnapshot({ address_street: "Elm St", address_house_number: "42", floor: "2", door: "tv" }),
    ).toBe("Elm St 42 2. tv");
  });

  it("skips whitespace-only floor", () => {
    expect(formatAddressFromSnapshot({ street: "Elm St", house_number: 1, floor: "  ", door: "th" })).toBe("Elm St 1");
  });

  it("returns null when street is missing", () => {
    expect(formatAddressFromSnapshot({ house_number: 42 })).toBeNull();
  });

  it("returns null when house number is missing", () => {
    expect(formatAddressFromSnapshot({ street: "Elm St" })).toBeNull();
  });
});

describe("formatApartmentKeyAsAddress", () => {
  it("formats a basic apartment key", () => {
    expect(formatApartmentKeyAsAddress("else alfelts vej 42")).toBe("Else Alfelts Vej 42");
  });

  it("formats key with floor and door", () => {
    expect(formatApartmentKeyAsAddress("else alfelts vej 180/4-th")).toBe("Else Alfelts Vej 180 4. th");
  });

  it("formats key with floor only", () => {
    expect(formatApartmentKeyAsAddress("elm street 42/2")).toBe("Elm Street 42 2.");
  });

  it("handles consecutive spaces in key", () => {
    expect(formatApartmentKeyAsAddress("elm  street 42")).toBe("Elm Street 42");
  });

  it("returns null for non-string input", () => {
    expect(formatApartmentKeyAsAddress(null)).toBeNull();
    expect(formatApartmentKeyAsAddress(123)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatApartmentKeyAsAddress("")).toBeNull();
  });
});

describe("formatEventDetails", () => {
  const t = (key: string) => key;
  const tableLabels = { "5": "Table #5", "10": "Table #10" };

  function makeEvent(overrides: Record<string, unknown>) {
    return {
      id: "evt-1",
      timestamp: "2026-03-01T10:00:00Z",
      actorType: "admin" as const,
      actorId: "admin-1",
      actorName: null,
      action: "admin_create",
      entityType: "admin",
      entityId: "admin-2",
      before: null,
      after: null,
      reason: null,
      ...overrides,
    };
  }

  it("formats waitlist_add with name, email, and address", () => {
    const evt = makeEvent({
      action: "waitlist_add",
      after: { name: "Alice", email: "alice@example.com", apartment_key: "elm street 42/2-th" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ label: "audit.detail.name", value: "Alice" });
    expect(lines[1]).toEqual({ label: "audit.detail.email", value: "alice@example.com" });
    expect(lines[2]).toEqual({ label: "audit.detail.address", value: "Elm Street 42 2. th" });
  });

  it("formats email_sent with recipient and subject", () => {
    const evt = makeEvent({
      action: "email_sent",
      after: { recipient: "bob@example.com", subject: "Welcome!" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "audit.detail.recipient", value: "bob@example.com" });
    expect(lines[1]).toEqual({ label: "audit.detail.subject", value: "Welcome!" });
  });

  it("formats notification_sent preferring display name", () => {
    const evt = makeEvent({
      action: "notification_sent",
      after: { recipient_email: "bob@example.com", recipient_name: "Bob", subject: "Hello" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines[0]).toEqual({ label: "audit.detail.recipient", value: "Bob" });
    expect(lines[1]).toEqual({ label: "audit.detail.subject", value: "Hello" });
  });

  it("formats notification_sent falling back to email", () => {
    const evt = makeEvent({
      action: "notification_sent",
      after: { recipient_email: "bob@example.com", subject: "Hello" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines[0]).toEqual({ label: "audit.detail.recipient", value: "bob@example.com" });
  });

  it("formats table_state_change with box label and state transition", () => {
    const evt = makeEvent({
      action: "table_state_change",
      entityType: "table",
      entityId: "5",
      before: { state: "available" },
      after: { state: "occupied" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "audit.detail.table", value: "Table #5" });
    expect(lines[1]).toEqual({ label: "audit.detail.stateChange", value: "available \u2192 occupied" });
  });

  it("formats registration_create with box, name, and address", () => {
    const evt = makeEvent({
      action: "registration_create",
      after: { table_id: 5, name: "Alice", apartment_key: "elm street 42" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ label: "audit.detail.table", value: "Table #5" });
    expect(lines[1]).toEqual({ label: "audit.detail.name", value: "Alice" });
    expect(lines[2]).toEqual({ label: "audit.detail.address", value: "Elm Street 42" });
  });

  it("formats registration_remove reading from before snapshot", () => {
    const evt = makeEvent({
      action: "registration_remove",
      before: { table_id: 10, name: "Bob", status: "active" },
      after: { status: "removed" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "audit.detail.table", value: "Table #10" });
    expect(lines[1]).toEqual({ label: "audit.detail.name", value: "Bob" });
  });

  it("formats registration_move with box transition", () => {
    const evt = makeEvent({
      action: "registration_move",
      before: { table_id: 5 },
      after: { table_id: 10 },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      label: "audit.detail.table",
      value: "Table #5 \u2192 Table #10",
    });
  });

  it("formats notification_skipped with recipient and action", () => {
    const evt = makeEvent({
      action: "notification_skipped",
      after: { recipient_email: "bob@example.com", notification_action: "add" },
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "audit.detail.recipient", value: "bob@example.com" });
  });

  it("uses default fallback for unknown actions", () => {
    const evt = makeEvent({
      action: "admin_create",
      before: { email: "old@example.com" },
      after: { email: "new@example.com" },
      reason: "test",
    });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(3);
    expect(lines[0].label).toBe("audit.detail.before");
    expect(lines[1].label).toBe("audit.detail.after");
    expect(lines[2]).toEqual({ label: "audit.detail.reason", value: "test" });
  });

  it("returns empty array when no data present", () => {
    const evt = makeEvent({ action: "admin_password_change" });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(0);
  });

  it("includes reason as fallback when action-specific lines are empty", () => {
    const evt = makeEvent({ action: "waitlist_add", after: {}, reason: "manual entry" });
    const lines = formatEventDetails(evt, tableLabels, t as never);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ label: "audit.detail.reason", value: "manual entry" });
  });
});
