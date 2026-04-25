import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
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
      { id: "r1", box_id: 1, name: "Alice", status: "active" },
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
      await handleCreateRegistration(makeCtx({ body: { boxId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when box not found", async () => {
    const mockDb = makeMockTrxDb({
      boxResult: undefined,
    });

    try {
      await handleCreateRegistration(
        makeCtx({
          db: mockDb,
          body: {
            boxId: 99,
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
      expect((err as AppError).message).toBe("Box not found");
    }
  });

  it("throws 409 when box is occupied", async () => {
    const mockDb = makeMockTrxDb({
      boxResult: { id: 1, state: "occupied" },
    });

    try {
      await handleCreateRegistration(
        makeCtx({
          db: mockDb,
          body: {
            boxId: 1,
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
      expect((err as AppError).code).toBe("BOX_OCCUPIED");
    }
  });
});

describe("handleCreateRegistration (happy path)", () => {
  it("creates registration and returns 201", async () => {
    const mockDb = makeMockTrxDb({
      boxResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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
    expect(body.boxId).toBe(1);
    expect(body.apartmentKey).toBe("else alfelts vej 130");
  });

  it("throws 400 for invalid language", async () => {
    try {
      await handleCreateRegistration(
        makeCtx({
          body: {
            boxId: 1,
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
      boxResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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
      boxResult: { id: 3, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 3,
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
      boxResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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

  it("logs notification_skipped audit event when sendEmail is false", async () => {
    const mockDb = makeMockTrxDb({
      boxResult: { id: 1, state: "available" },
      existingReg: undefined,
    });

    await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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

  it("assigns waitlist entry to box and returns 201", async () => {
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
      box: { id: 5, state: "available" },
      existingReg: undefined,
      newRegId: "reg-from-wl",
    });

    const result = await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", boxId: 5 },
      }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-from-wl");
    expect(body.waitlistEntryId).toBe("wl-1");
    expect(body.boxId).toBe(5);
  });

  it("throws 409 when box is occupied", async () => {
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
      box: { id: 5, state: "occupied" },
      existingReg: undefined,
    });

    try {
      await handleAssignWaitlist(
        makeCtx({
          db: mockDb,
          body: { waitlistEntryId: "wl-1", boxId: 5 },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("BOX_OCCUPIED");
    }
  });

  it("throws 404 when waitlist entry not found", async () => {
    const mockDb = makeMockAssignWaitlistDb({
      entry: undefined,
      box: { id: 5, state: "available" },
      existingReg: undefined,
    });

    try {
      await handleAssignWaitlist(
        makeCtx({
          db: mockDb,
          body: { waitlistEntryId: "wl-missing", boxId: 5 },
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
            boxId: 1,
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
            boxId: 1,
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

  it("throws 400 for move without oldBoxId", async () => {
    try {
      await handleNotificationPreview(
        makeCtx({
          body: {
            action: "move",
            recipientName: "Alice",
            recipientEmail: "a@b.com",
            language: "da",
            boxId: 1,
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("oldBoxId");
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
          boxId: 3,
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
          boxId: 20,
          oldBoxId: 3,
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
          boxId: 3,
        },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.subject).toContain("removed");
  });
});

describe("handleMoveRegistration (happy path)", () => {
  it("moves registration to a new box", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", box_id: 1, name: "Alice", email: "a@b.com", language: "da", status: "active" },
      oldBox: { id: 1, state: "occupied" },
      newBox: { id: 5, state: "available" },
    });

    const result = await handleMoveRegistration(
      makeCtx({
        db: mockDb,
        body: { registrationId: "reg-1", newBoxId: 5 },
      }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-1");
    expect(body.newBoxId).toBe(5);
  });

  it("throws 404 when registration not found", async () => {
    const mockDb = makeMockMoveDb({ reg: undefined });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "nonexistent", newBoxId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 400 when registration is not active", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", box_id: 1, name: "A", email: "a@b.com", language: "da", status: "removed" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newBoxId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Only active registrations can be moved");
    }
  });

  it("throws 400 when new box is same as current", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", box_id: 5, name: "A", email: "a@b.com", language: "da", status: "active" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newBoxId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("New box must be different from current box");
    }
  });

  it("throws 409 when target box is occupied", async () => {
    const mockDb = makeMockMoveDb({
      reg: { id: "reg-1", box_id: 1, name: "A", email: "a@b.com", language: "da", status: "active" },
      oldBox: { id: 1, state: "occupied" },
      newBox: { id: 5, state: "occupied" },
    });

    try {
      await handleMoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1", newBoxId: 5 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("BOX_OCCUPIED");
    }
  });
});

describe("handleRemoveRegistration (happy path)", () => {
  it("removes registration and releases box as public (default)", async () => {
    const mockDb = makeMockRemoveDb({
      reg: {
        id: "reg-1", box_id: 3, status: "active",
        name: "Alice", email: "a@b.com", language: "da", apartment_key: "else alfelts vej 130",
      },
    });

    const result = await handleRemoveRegistration(
      makeCtx({ db: mockDb, body: { registrationId: "reg-1" } }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-1");
    expect(body.boxReleased).toBe(true);
  });

  it("removes registration and holds box as reserved when makeBoxPublic is false", async () => {
    const mockDb = makeMockRemoveDb({
      reg: {
        id: "reg-1", box_id: 3, status: "active",
        name: "Alice", email: "a@b.com", language: "da", apartment_key: "else alfelts vej 130",
      },
    });

    const result = await handleRemoveRegistration(
      makeCtx({ db: mockDb, body: { registrationId: "reg-1", makeBoxPublic: false } }),
    );
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.boxReleased).toBe(false);
  });

  it("throws 404 when registration not found", async () => {
    const mockDb = makeMockRemoveDb({ reg: undefined });

    try {
      await handleRemoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "nonexistent" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 400 when registration is not active", async () => {
    const mockDb = makeMockRemoveDb({
      reg: {
        id: "reg-1", box_id: 3, status: "removed",
        name: "A", email: "a@b.com", language: "da", apartment_key: "key",
      },
    });

    try {
      await handleRemoveRegistration(
        makeCtx({ db: mockDb, body: { registrationId: "reg-1" } }),
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
  it("assigns waitlist entry to a box and creates registration", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
      },
      box: { id: 10, state: "available" },
      existingReg: undefined,
    });

    const result = await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", boxId: 10 } }),
    );
    expect(result.statusCode).toBe(201);
    const body = result.body as Record<string, unknown>;
    expect(body.waitlistEntryId).toBe("wl-1");
    expect(body.boxId).toBe(10);
    expect(body.registrationId).toBeTruthy();
  });

  it("throws 404 when waitlist entry not found", async () => {
    const mockDb = makeMockAssignDb({ entry: undefined });

    try {
      await handleAssignWaitlist(
        makeCtx({ db: mockDb, body: { waitlistEntryId: "nonexistent", boxId: 10 } }),
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
        makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", boxId: 10 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Waitlist entry is not in waiting status");
    }
  });

  it("throws 409 when target box is occupied", async () => {
    const mockDb = makeMockAssignDb({
      entry: {
        id: "wl-1", name: "Bob", email: "bob@b.com",
        street: "Else Alfelts Vej", house_number: 140,
        floor: null, door: null, apartment_key: "else alfelts vej 140",
        language: "en", status: "waiting",
      },
      box: { id: 10, state: "occupied" },
    });

    try {
      await handleAssignWaitlist(
        makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", boxId: 10 } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("BOX_OCCUPIED");
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
      box: { id: 10, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", boxId: 10 } }),
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
      box: { id: 10, state: "available" },
    });

    await handleAssignWaitlist(
      makeCtx({ db: mockDb, body: { waitlistEntryId: "wl-1", boxId: 10 } }),
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
      box: { id: 10, state: "available" },
    });

    await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", boxId: 10, notifyDownstream: true },
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
      box: { id: 10, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleAssignWaitlist(
      makeCtx({
        db: mockDb,
        body: { waitlistEntryId: "wl-1", boxId: 10, notifyDownstream: true },
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(notifyDownstreamWaitlist).not.toHaveBeenCalled();
  });
});

describe("duplicate-address warning in admin create", () => {
  it("returns 409 duplicate warning when apartment already has active registration", async () => {
    const mockDb = makeMockTrxDb({
      boxResult: { id: 1, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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
      boxResult: { id: 1, state: "available" },
      existingReg: { id: "existing-reg" },
    });

    const result = await handleCreateRegistration(
      makeCtx({
        db: mockDb,
        body: {
          boxId: 1,
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
  reg?: { id: string; box_id: number; name: string; email: string; language: string; status: string };
  oldBox?: { id: number; state: string };
  newBox?: { id: number; state: string };
}): Kysely<Database> {
  // The production code queries old box first (line 297), then new box (line 308).
  // This counter relies on that ordering.
  let boxCallCount = 0;
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
      if (table === "planter_boxes") {
        boxCallCount++;
        const boxData = boxCallCount === 1 ? opts.oldBox : opts.newBox;
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(boxData),
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
    id: string; box_id: number; status: string;
    name: string; email: string; language: string; apartment_key: string;
  };
}): Kysely<Database> {
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

function makeMockAssignDb(opts: {
  entry?: {
    id: string; name: string; email: string;
    street: string; house_number: number;
    floor: string | null; door: string | null;
    apartment_key: string; language: string; status: string;
    created_at?: Date;
  };
  box?: { id: number; state: string };
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
      if (table === "planter_boxes") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.box),
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

function makeMockTrxDb(opts: {
  boxResult?: { id: number; state: string };
  existingReg?: { id: string };
}): Kysely<Database> {
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];
  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "planter_boxes") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.boxResult),
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
          execute: vi.fn().mockResolvedValue([{ id: "new-reg-id" }]),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
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
  box?: { id: number; state: string };
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
      if (table === "planter_boxes") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.box),
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
