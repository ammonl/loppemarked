import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { queueAndSendEmail, setSesClient } from "./email-service.js";

function createMockDb() {
  const executeFn = vi.fn();
  const returningFn = vi.fn().mockReturnValue({ execute: executeFn });
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const insertIntoFn = vi.fn().mockReturnValue({ values: valuesFn });

  const updateExecuteFn = vi.fn().mockResolvedValue(undefined);
  const updateWhereFn = vi.fn().mockReturnValue({ execute: updateExecuteFn });
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateTableFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const auditExecuteFn = vi.fn().mockResolvedValue(undefined);
  const auditValuesFn = vi.fn().mockReturnValue({ execute: auditExecuteFn });

  const db = {
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "audit_events") {
        return { values: auditValuesFn };
      }
      return { values: valuesFn };
    }),
    updateTable: updateTableFn,
  } as unknown as Kysely<Database>;

  return {
    db,
    mocks: {
      executeFn,
      returningFn,
      valuesFn,
      insertIntoFn,
      updateTableFn,
      updateSetFn,
      updateWhereFn,
      updateExecuteFn,
    },
  };
}

const emailInput = {
  recipientEmail: "test@example.com",
  language: "da" as const,
  subject: "Test Subject",
  bodyHtml: "<p>Test body</p>",
};

describe("queueAndSendEmail", () => {
  beforeEach(() => {
    setSesClient(null);
  });

  it("inserts email record with pending status", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);

    await queueAndSendEmail(db, emailInput);

    expect(db.insertInto).toHaveBeenCalledWith("emails");
    expect(mocks.executeFn).toHaveBeenCalled();
  });

  it("returns the email id", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-42" }]);

    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);

    const id = await queueAndSendEmail(db, emailInput);
    expect(id).toBe("email-42");
  });

  it("calls SES send with correct parameters", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSend = vi.fn().mockResolvedValue({});
    const mockSes = { send: mockSend };
    setSesClient(mockSes as never);

    await queueAndSendEmail(db, emailInput);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Destination.ToAddresses).toEqual(["test@example.com"]);
    expect(command.input.Source).toBe("UN17 Village Loppemarked <loppemarked@un17hub.com>");
    expect(command.input.Message.Subject.Data).toBe("Test Subject");
  });

  it("updates email status to sent on success", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);

    await queueAndSendEmail(db, emailInput);

    expect(mocks.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("updates email status to failed when SES throws", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSes = {
      send: vi.fn().mockRejectedValue(new Error("SES unavailable")),
    };
    setSesClient(mockSes as never);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const id = await queueAndSendEmail(db, emailInput);

    expect(id).toBe("email-1");
    expect(mocks.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );

    consoleSpy.mockRestore();
  });

  it("does not throw when SES fails", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSes = {
      send: vi.fn().mockRejectedValue(new Error("Network error")),
    };
    setSesClient(mockSes as never);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      queueAndSendEmail(db, emailInput),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });

  it("logs audit event on successful send", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockResolvedValue([{ id: "email-1" }]);

    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);

    await queueAndSendEmail(db, emailInput);

    expect(db.insertInto).toHaveBeenCalledWith("audit_events");
  });

  it("returns null and does not throw when DB insert fails", async () => {
    const { db, mocks } = createMockDb();
    mocks.executeFn.mockRejectedValue(new Error("DB connection lost"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const id = await queueAndSendEmail(db, emailInput);

    expect(id).toBeNull();
    consoleSpy.mockRestore();
  });
});
