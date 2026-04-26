import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { RESERVED_LABEL_DEFAULT } from "@loppemarked/shared";
import {
  handleAssignWaitlist,
  handleCreateRegistration,
  handleListRegistrations,
  handleMoveRegistration,
  handleNotificationPreview,
  handleRemoveRegistration,
} from "./registrations.js";

vi.mock("../../lib/email-service.js", () => ({
  queueAndSendEmail: vi.fn().mockResolvedValue("email-mock-id"),
}));

vi.mock("../../lib/admin-ops-notifications.js", () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/waitlist-emails.js", () => ({
  notifyDownstreamWaitlist: vi.fn().mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0 }),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "GET",
    path: "/admin/registrations",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleListRegistrations", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleListRegistrations(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("returns registrations from database", async () => {
    const mockRegs = [
      { id: "r1", table_id: 1, name: "Alice", status: "active" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockRegs);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const result = await handleListRegistrations(makeCtx({ db: mockDb }));
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(mockRegs);
    expect(selectFromFn).toHaveBeenCalledWith("registrations");
  });
});

describe("handleCreateRegistration", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleCreateRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when required fields are missing", async () => {
    try {
      await handleCreateRegistration(makeCtx({ body: { tableId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when table not found", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: undefined,
    });

    try {
      await handleCreateRegistration(
        makeCtx({
          db: mockDb,
          body: {
            tableId: 99,
            name: "Alice",
            email: "a@b.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            language: "da",
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Table not found");
    }
  });

  it("throws 409 when table is occupied", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "occupied" },
    });

    try {
      await handleCreateRegistration(
        makeCtx({
          db: mockDb,
          body: {
            tableId: 1,
            name: "Alice",
            email: "a@b.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            language: "da",
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("TABLE_OCCUPIED");
    }
  });
});

describe("handleCreateRegistration (happy path)", () => {
  it("creates registration and returns 201", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
        },
      }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.id).toBe("new-reg-id");
    expect(body.tableId).toBe(1);
    expect(body.apartmentKey).toBe("else alfelts vej 130");
  });

  it("throws 400 for invalid language", async () => {
    try {
      await handleCreateRegistration(
        makeCtx({
          body: {
            tableId: 1,
            name: "Alice",
            email: "a@b.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            language: "fr",
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("language must be 'da' or 'en'");
    }
  });

  it("defaults language to English when not provided", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
        },
      }),
    );
    expect(result.statusCode).toBe(201);
  });

  it("sends notification email when notification.sendEmail is true", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockSendEmail = vi.mocked(queueAndSendEmail);
    mockSendEmail.mockResolvedValue("email-123");

    const mockDb = makeMockTrxDb({
      tableResult: { id: 3, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 3,
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
          notification: { sendEmail: true },
        },
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientEmail: "alice@example.com",
        language: "da",
      }),
    );
  });

  it("does not send email when notification is not provided", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockSendEmail = vi.mocked(queueAndSendEmail);
    mockSendEmail.mockClear();

    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
        },
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("mints a cancellation token and embeds the live link in the unedited email", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockSendEmail = vi.mocked(queueAndSendEmail);
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue("email-cancellation");

    const { db, tokenInserts, auditInserts } = makeMockTrxDbWithCaptures({
      tableResult: { id: 3, state: "available" },
      existingReg: undefined,
      newRegId: "reg-with-token",
    });

    await handleCreateRegistration(
      makeCtx({
        db,
        body: {
          tableId: 3,
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "en",
          notification: { sendEmail: true },
        },
      }),
    );

    expect(tokenInserts).toHaveLength(1);
    expect(tokenInserts[0]).toMatchObject({ registration_id: "reg-with-token" });
    expect(auditInserts.some((e) => e.action === "cancellation_token_minted")).toBe(true);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sent = mockSendEmail.mock.calls[0][1] as { bodyHtml: string };
    expect(sent.bodyHtml).toContain("Cancel my booking");
    expect(sent.bodyHtml).toMatch(/\/cancel\?token=/);
    // The placeholder text from the preview must not leak into the sent body.
    expect(sent.bodyHtml).not.toContain(
      "A personal cancellation link for the recipient will be inserted",
    );

    const sentAudit = auditInserts.find((e) => e.action === "notification_sent");
    expect(sentAudit).toBeDefined();
    expect(JSON.parse(sentAudit!.after as string)).toMatchObject({
      cancellation_link_included: true,
      edited_before_send: false,
    });
  });

  it("drops the cancel section entirely when token minting fails", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockSendEmail = vi.mocked(queueAndSendEmail);
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue("email-no-token");

    const { db, auditInserts } = makeMockTrxDbWithCaptures({
      tableResult: { id: 3, state: "available" },
      existingReg: undefined,
      newRegId: "reg-no-token",
      failTokenInsert: true,
    });

    await handleCreateRegistration(
      makeCtx({
        db,
        body: {
          tableId: 3,
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "en",
          notification: { sendEmail: true },
        },
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sent = mockSendEmail.mock.calls[0][1] as { bodyHtml: string };
    // No live link, and crucially the preview-only placeholder note must not
    // leak to the recipient (would be confusing — the link will never appear).
    expect(sent.bodyHtml).not.toMatch(/\/cancel\?token=/);
    expect(sent.bodyHtml).not.toContain("Cancel my booking");
    expect(sent.bodyHtml).not.toContain(
      "A personal cancellation link for the recipient will be inserted",
    );

    expect(auditInserts.some((e) => e.action === "cancellation_token_minted")).toBe(false);
    const sentAudit = auditInserts.find((e) => e.action === "notification_sent");
    expect(sentAudit).toBeDefined();
    expect(JSON.parse(sentAudit!.after as string)).toMatchObject({
      cancellation_link_included: false,
      edited_before_send: false,
    });
  });

  it("does not inject a live cancel link when admin edits the email body", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockSendEmail = vi.mocked(queueAndSendEmail);
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue("email-edited");

    const { db, auditInserts } = makeMockTrxDbWithCaptures({
      tableResult: { id: 3, state: "available" },
      existingReg: undefined,
      newRegId: "reg-edited",
    });

    const customBody = "<p>Custom admin-written body without a cancel section</p>";

    await handleCreateRegistration(
      makeCtx({
        db,
        body: {
          tableId: 3,
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "en",
          notification: { sendEmail: true, bodyHtml: customBody },
        },
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sent = mockSendEmail.mock.calls[0][1] as { bodyHtml: string };
    expect(sent.bodyHtml).toBe(customBody);
    expect(sent.bodyHtml).not.toContain("Cancel my booking");
    expect(sent.bodyHtml).not.toMatch(/\/cancel\?token=/);

    const sentAudit = auditInserts.find((e) => e.action === "notification_sent");
    expect(sentAudit).toBeDefined();
    expect(JSON.parse(sentAudit!.after as string)).toMatchObject({
      cancellation_link_included: false,
      edited_before_send: true,
    });
  });

  it("logs notification_skipped audit event when sendEmail is false", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
          notification: { sendEmail: false },
        },
      }),
    );

    const insertCalls = (mockDb.insertInto as ReturnType<typeof vi.fn>).mock.calls;
    const auditCalls = insertCalls.filter(
      (call: string[]) => call[0] === "audit_events",
    );
    expect(auditCalls.length).toBeGreaterThan(0);
  });

  // Regression: admin tooling must not be able to bypass the
  // apartment dedupe rule by sending a floor/door for a non-floor-required
  // house number.
  it("drops floor/door from the persisted row for non-floor-required house numbers", async () => {
    const captures: MockCreateRegCaptures = {};
    const mockDb = makeMockTrxDb(
      {
        tableResult: { id: 1, state: "available" },
        existingReg: undefined,
      },
      captures,
    );

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 122,
          floor: "2",
          door: "th",
          language: "da",
        },
      }),
    );

    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.apartmentKey).toBe("else alfelts vej 122");
    expect(captures.registrationInsertValues).toMatchObject({
      floor: null,
      door: null,
      apartment_key: "else alfelts vej 122",
    });
  });

  it("preserves floor/door for floor-required house numbers", async () => {
    const captures: MockCreateRegCaptures = {};
    const mockDb = makeMockTrxDb(
      {
        tableResult: { id: 1, state: "available" },
        existingReg: undefined,
      },
      captures,
    );

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 138,
          floor: "2",
          door: "th",
          language: "da",
        },
      }),
    );

    expect(result.statusCode).toBe(201);
    expect(captures.registrationInsertValues).toMatchObject({
      floor: "2",
      door: "th",
      apartment_key: "else alfelts vej 138/2-th",
    });
  });
});

describe("handleMoveRegistration", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleMoveRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when required fields are missing", async () => {
    try {
      await handleMoveRegistration(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handleRemoveRegistration", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleRemoveRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when registrationId is missing", async () => {
    try {
      await handleRemoveRegistration(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handleAssignWaitlist", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleAssignWaitlist(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when required fields are missing", async () => {
    try {
      await handleAssignWaitlist(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("assigns waitlist entry to table and returns 201", async () => {
    const mockDb = makeMockAssignWaitlistDb({
      entry: {
        id: "wl-1",
        name: "Alice",
        email: "alice@example.com",
        street: "Else Alfelts Vej",
        house_number: 130,
        floor: null,
        door: null,
        apartment_key: "else alfelts vej 130",
        language: "da",
        status: "waiting",
      },
      table: { id: 5, state: "available" },
      existingReg: undefined,
      newRegId: "reg-from-wl",
    });

    const result = await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", tableId: 5 },
      }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-from-wl");
    expect(body.waitlistEntryId).toBe("wl-1");
    expect(body.tableId).toBe(5);
  });

  it("throws 409 when table is occupied", async () => {
    const mockDb = makeMockAssignWaitlistDb({
      entry: {
        id: "wl-1",
        name: "Alice",
        email: "alice@example.com",
        street: "Else Alfelts Vej",
        house_number: 130,
        floor: null,
        door: null,
        apartment_key: "else alfelts vej 130",
        language: "da",
        status: "waiting",
      },
      table: { id: 5, state: "occupied" },
      existingReg: undefined,
    });

    try {
      await handleAssignWaitlist(
        makeCtx({
          db: mockDb,
          body: { waitlistEntryId: "wl-1", tableId: 5 },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("TABLE_OCCUPIED");
    }
  });

  it("throws 404 when waitlist entry not found", async () => {
    const mockDb = makeMockAssignWaitlistDb({
      entry: undefined,
      table: { id: 5, state: "available" },
      existingReg: undefined,
    });

    try {
      await handleAssignWaitlist(
        makeCtx({
          db: mockDb,
          body: { waitlistEntryId: "wl-missing", tableId: 5 },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });
});

describe("handleNotificationPreview", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleNotificationPreview(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when required fields are missing", async () => {
    try {
      await handleNotificationPreview(
        makeCtx({ body: { action: "add" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 for invalid action", async () => {
    try {
      await handleNotificationPreview(
        makeCtx({
          body: {
            action: "invalid",
            recipientName: "Alice",
            recipientEmail: "a@b.com",
            language: "da",
            tableId: 1,
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("action must be one of");
    }
  });

  it("throws 400 for invalid language", async () => {
    try {
      await handleNotificationPreview(
        makeCtx({
          body: {
            action: "add",
            recipientName: "Alice",
            recipientEmail: "a@b.com",
            language: "fr",
            tableId: 1,
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("language must be");
    }
  });

  it("throws 400 for move without oldTableId", async () => {
    try {
      await handleNotificationPreview(
        makeCtx({
          body: {
            action: "move",
            recipientName: "Alice",
            recipientEmail: "a@b.com",
            language: "da",
            tableId: 1,
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("oldTableId");
    }
  });

  it("returns add notification preview", async () => {
    const result = await handleNotificationPreview(
      makeCtx({
        body: {
          action: "add",
          recipientName: "Anna Jensen",
          recipientEmail: "anna@example.com",
          language: "da",
          tableId: 3,
        },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.subject).toContain("Bekræftelse");
    expect(body.recipientEmail).toBe("anna@example.com");
    expect(body.language).toBe("da");
    expect(typeof body.bodyHtml).toBe("string");
  });

  it("returns move notification preview", async () => {
    const result = await handleNotificationPreview(
      makeCtx({
        body: {
          action: "move",
          recipientName: "Anna Jensen",
          recipientEmail: "anna@example.com",
          language: "en",
          tableId: 20,
          oldTableId: 3,
        },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.subject).toContain("Change");
    expect(body.recipientEmail).toBe("anna@example.com");
  });

  it("returns remove notification preview", async () => {
    const result = await handleNotificationPreview(
      makeCtx({
        body: {
          action: "remove",
          recipientName: "Anna Jensen",
          recipientEmail: "anna@example.com",
          language: "en",
          tableId: 3,
        },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.subject).toContain("removed");
  });
});

describe("handleMoveRegistration (happy path)", () => {
  it("moves registration to a new table", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", table_id: 1, name: "Alice", email: "a@b.com", language: "da", status: "active" },
      oldTable: { id: 1, state: "occupied" },
      newTable: { id: 5, state: "available" },
    });

    const result = await handleMoveRegistration(
      makeCtx({
        db: mockDb,
        body: { registrationId: "reg-1", newTableId: 5 },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-1");
    expect(body.newTableId).toBe(5);
  });

  it("throws 404 when registration not found", async () => {
    const mockDb = makeMockMoveDb({ reg: undefined });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "nonexistent", newTableId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 400 when registration is not active", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", table_id: 1, name: "A", email: "a@b.com", language: "da", status: "removed" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newTableId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Only active registrations can be moved");
    }
  });

  it("throws 400 when new table is same as current", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", table_id: 5, name: "A", email: "a@b.com", language: "da", status: "active" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newTableId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("New table must be different from current table");
    }
  });

  it("throws 409 when target table is occupied", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", table_id: 1, name: "A", email: "a@b.com", language: "da", status: "active" },
      oldTable: { id: 1, state: "occupied" },
      newTable: { id: 5, state: "occupied" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newTableId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("TABLE_OCCUPIED");
    }
  });
});

describe("handleRemoveRegistration (happy path)", () => {
  it("removes registration and releases table as public (default)", async () => {
    const { db, tableUpdates, auditInserts } = makeMockRemoveDb({
      reg: {
        id: "reg-1", table_id: 3, status: "active",
        name: "Alice", email: "a@b.com", language: "da", apartment_key: "else alfelts vej 130",
      },
    });

    const result = await handleRemoveRegistration(
      makeCtx({ db, body: { registrationId: "reg-1" } }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-1");
    expect(body.tableReleased).toBe(true);
    expect(tableUpdates).toHaveLength(1);
    expect(tableUpdates[0]).toMatchObject({ state: "available", reserved_label: null });

    const tableStateAudit = auditInserts.find(
      (e) => e.action === "table_state_change" && e.entity_id === "3",
    );
    expect(tableStateAudit).toBeDefined();
    expect(JSON.parse(tableStateAudit!.after as string)).toMatchObject({
      state: "available",
      reserved_label: null,
    });
  });

  it("removes registration and holds table as reserved when makeTablePublic is false", async () => {
    const { db, tableUpdates, auditInserts } = makeMockRemoveDb({
      reg: {
        id: "reg-1", table_id: 3, status: "active",
        name: "Alice", email: "a@b.com", language: "da", apartment_key: "else alfelts vej 130",
      },
    });

    const result = await handleRemoveRegistration(
      makeCtx({ db, body: { registrationId: "reg-1", makeTablePublic: false } }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.tableReleased).toBe(false);
    expect(tableUpdates).toHaveLength(1);
    expect(tableUpdates[0]).toMatchObject({ state: "reserved", reserved_label: RESERVED_LABEL_DEFAULT });

    const tableStateAudit = auditInserts.find(
      (e) => e.action === "table_state_change" && e.entity_id === "3",
    );
    expect(tableStateAudit).toBeDefined();
    expect(JSON.parse(tableStateAudit!.after as string)).toMatchObject({
      state: "reserved",
      reserved_label: RESERVED_LABEL_DEFAULT,
    });
  });

  it("throws 404 when registration not found", async () => {
    const { db } = makeMockRemoveDb({ reg: undefined });

    try {
      await handleRemoveRegistration(
        makeCtx({ db, body: { registrationId: "nonexistent" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 400 when registration is not active", async () => {
    const { db } = makeMockRemoveDb({
      reg: {
        id: "reg-1", table_id: 3, status: "removed",
        name: "A", email: "a@b.com", language: "da", apartment_key: "key",
      },
    });

    try {
      await handleRemoveRegistration(
        makeCtx({ db, body: { registrationId: "reg-1" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Only active registrations can be removed");
    }
  });
});

describe("handleAssignWaitlist (happy path)", () => {
  it("assigns waitlist entry to a table and creates registration", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
      },
      table: { id: 10, state: "available" },
      existingReg: undefined,
    });

    const result = await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", tableId: 10 } }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.waitlistEntryId).toBe("wl-1");
    expect(body.tableId).toBe(10);
    expect(body.registrationId).toBeTruthy();
  });

  it("throws 404 when waitlist entry not found", async () => {
    const mockDb = makeMockAssignDb({ entry: undefined });

    try {
      await handleAssignWaitlist(
        makeCtx({ db: mockDb, body: { waitlistEntryId: "nonexistent", tableId: 10 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 400 when waitlist entry is not waiting", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "assigned",
      },
    });

    try {
      await handleAssignWaitlist(
        makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", tableId: 10 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Waitlist entry is not in waiting status");
    }
  });

  it("throws 409 when target table is occupied", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
      },
      table: { id: 10, state: "occupied" },
    });

    try {
      await handleAssignWaitlist(
        makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", tableId: 10 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("TABLE_OCCUPIED");
    }
  });

  it("returns 409 duplicate warning when apartment already has active registration", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
      },
      table: { id: 10, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", tableId: 10 } }),
    );
    expect(result.statusCode).toBe(409);
    const body = result.body as Record<string, unknown>;
    expect(body.code).toBe("DUPLICATE_ADDRESS_WARNING");
  });
});

describe("handleAssignWaitlist — notifyDownstream", () => {
  beforeEach(async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    vi.mocked(notifyDownstreamWaitlist).mockClear();
  });

  it("does not call notifyDownstreamWaitlist when flag is omitted", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
        created_at: new Date("2026-02-01T10:00:00Z"),
      },
      table: { id: 10, state: "available" },
    });

    await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", tableId: 10 } }),
    );

    expect(notifyDownstreamWaitlist).not.toHaveBeenCalled();
  });

  it("calls notifyDownstreamWaitlist with entry created_at when flag is true", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const createdAt = new Date("2026-02-01T10:00:00Z");
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
        created_at: createdAt,
      },
      table: { id: 10, state: "available" },
    });

    await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", tableId: 10, notifyDownstream: true },
      }),
    );

    expect(notifyDownstreamWaitlist).toHaveBeenCalledTimes(1);
    const call = vi.mocked(notifyDownstreamWaitlist).mock.calls[0];
    expect(call[1]).toBe("admin-1");
    expect(call[2]).toBe(createdAt);
    expect(call[3]).toEqual({
      triggerAction: "waitlist_assign",
      entityId: "wl-1",
    });
  });

  it("does not notify when assignment short-circuits with duplicate warning", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
        created_at: new Date("2026-02-01T10:00:00Z"),
      },
      table: { id: 10, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", tableId: 10, notifyDownstream: true },
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(notifyDownstreamWaitlist).not.toHaveBeenCalled();
  });
});

describe("duplicate-address warning in admin create", () => {
  it("returns 409 duplicate warning when apartment already has active registration", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
        },
      }),
    );
    expect(result.statusCode).toBe(409);
    const body = result.body as Record<string, unknown>;
    expect(body.code).toBe("DUPLICATE_ADDRESS_WARNING");
  });

  it("creates registration when confirmDuplicate is true", async () => {
    const mockDb = makeMockTrxDb({
      tableResult: { id: 1, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          tableId: 1,
          name: "Alice",
          email: "a@b.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
          confirmDuplicate: true,
        },
      }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.id).toBe("new-reg-id");
  });
});

function makeMockMoveDb(opts: {
  reg?: { id: string; table_id: number; name: string; email: string; language: string; status: string };
  oldTable?: { id: number; state: string };
  newTable?: { id: number; state: string };
}): Kysely<Database> {
  // The production code queries old table first (line 297), then new table (line 308).
  // This counter relies on that ordering.
  let tableCallCount = 0;
  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.reg),
              }),
            }),
          }),
        };
      }
      if (table === "tables") {
        tableCallCount++;
        const tableData = tableCallCount === 1 ? opts.oldTable : opts.newTable;
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(tableData),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };

  return {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([{ id: "email-mock-id" }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    })),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  } as unknown as Kysely<Database>;
}

function makeMockRemoveDb(opts: {
  reg?: {
    id: string; table_id: number; status: string;
    name: string; email: string; language: string; apartment_key: string;
  };
}): {
  db: Kysely<Database>;
  tableUpdates: Array<Record<string, unknown>>;
  auditInserts: Array<Record<string, unknown>>;
} {
  const tableUpdates: Array<Record<string, unknown>> = [];
  const auditInserts: Array<Record<string, unknown>> = [];

  const makeUpdateTable = () => vi.fn().mockImplementation((tableName: string) => ({
    set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
      if (tableName === "tables") {
        tableUpdates.push(values);
      }
      return {
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      };
    }),
  }));

  const makeInsertInto = () => vi.fn().mockImplementation((tableName: string) => ({
    values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
      if (tableName === "audit_events") {
        auditInserts.push(values);
      }
      return {
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([{ id: "email-mock-id" }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      };
    }),
  }));

  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.reg),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: makeUpdateTable(),
    insertInto: makeInsertInto(),
  };

  const db = {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: makeInsertInto(),
    updateTable: makeUpdateTable(),
  } as unknown as Kysely<Database>;

  return { db, tableUpdates, auditInserts };
}

function makeMockAssignDb(opts: {
  entry?: {
    id: string; name: string; email: string;
    street: string; house_number: number;
    floor: string | null; door: string | null;
    apartment_key: string; language: string; status: string;
    created_at?: Date;
  };
  table?: { id: number; state: string };
  existingReg?: { id: string };
}): Kysely<Database> {
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];
  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "waitlist_entries") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.entry),
              }),
            }),
          }),
        };
      }
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.table),
              }),
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(existingRegs),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([{ id: "new-reg-from-wl" }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };

  return {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([{ id: "email-mock-id" }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    })),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  } as unknown as Kysely<Database>;
}

interface MockCreateRegCaptures {
  registrationInsertValues?: Record<string, unknown>;
}

/**
 * Variant of makeMockTrxDb that exposes captured token inserts and audit
 * events so tests can assert on the cancellation-token minting flow.
 */
function makeMockTrxDbWithCaptures(opts: {
  tableResult?: { id: number; state: string };
  existingReg?: { id: string };
  newRegId: string;
  failTokenInsert?: boolean;
}): {
  db: Kysely<Database>;
  tokenInserts: Array<Record<string, unknown>>;
  auditInserts: Array<Record<string, unknown>>;
} {
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];
  const tokenInserts: Array<Record<string, unknown>> = [];
  const auditInserts: Array<Record<string, unknown>> = [];

  const captureInsert = vi.fn().mockImplementation((tableName: string) => ({
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      if (tableName === "registration_cancellation_tokens") {
        if (opts.failTokenInsert) {
          return {
            returning: vi.fn().mockReturnValue({
              execute: vi.fn().mockRejectedValue(new Error("token insert failed")),
            }),
            execute: vi.fn().mockRejectedValue(new Error("token insert failed")),
          };
        }
        tokenInserts.push(vals);
      }
      if (tableName === "audit_events") {
        auditInserts.push(vals);
      }
      return {
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([{ id: opts.newRegId }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      };
    }),
  }));

  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.tableResult),
              }),
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(existingRegs),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: captureInsert,
  };

  const db = {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: captureInsert,
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  } as unknown as Kysely<Database>;

  return { db, tokenInserts, auditInserts };
}

function makeMockTrxDb(
  opts: {
    tableResult?: { id: number; state: string };
    existingReg?: { id: string };
  },
  captures?: MockCreateRegCaptures,
): Kysely<Database> {
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];
  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.tableResult),
              }),
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(existingRegs),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        if (captures && table === "registrations") {
          captures.registrationInsertValues = vals;
        }
        return {
          returning: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([{ id: "new-reg-id" }]),
          }),
          execute: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
  };

  const topLevelInsertInto = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ id: "email-mock-id" }]),
      }),
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  }));

  const topLevelUpdateTable = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });

  return {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: topLevelInsertInto,
    updateTable: topLevelUpdateTable,
  } as unknown as Kysely<Database>;
}

interface MockAssignWaitlistOpts {
  entry?: {
    id: string;
    name: string;
    email: string;
    street: string;
    house_number: number;
    floor: string | null;
    door: string | null;
    apartment_key: string;
    language: string;
    status: string;
  };
  table?: { id: number; state: string };
  existingReg?: { id: string };
  newRegId?: string;
}

function makeMockAssignWaitlistDb(opts: MockAssignWaitlistOpts): Kysely<Database> {
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];
  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "waitlist_entries") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.entry),
              }),
            }),
          }),
        };
      }
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.table),
              }),
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(existingRegs),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "registrations") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([{ id: opts.newRegId ?? "reg-id" }]),
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
  };

  const topLevelInsertInto = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ id: "email-mock-id" }]),
      }),
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  }));

  const topLevelUpdateTable = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });

  return {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: topLevelInsertInto,
    updateTable: topLevelUpdateTable,
  } as unknown as Kysely<Database>;
}
