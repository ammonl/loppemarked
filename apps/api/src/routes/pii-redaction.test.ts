import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { RequestContext } from "../router.js";
import { AppError } from "../lib/errors.js";
import {
  handlePublicTables,
  handlePublicHallSummary,
  handlePublicRegister,
  handlePublicStatus,
  handleJoinWaitlist,
  handleValidateAddress,
  handleValidateRegistration,
  handleWaitlistPosition,
} from "./public.js";
import {
  handleListRegistrations,
  handleCreateRegistration,
  handleMoveRegistration,
  handleRemoveRegistration,
  handleAssignWaitlist,
  handleNotificationPreview,
} from "./admin/registrations.js";
import { handleListAdmins, handleCreateAdmin, handleDeleteAdmin } from "./admin/admins.js";
import { handleChangePassword } from "./admin/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { handleListAuditEvents } from "./admin/audit.js";
// handleGetOpeningTime and handleUpdateOpeningTime rely on requireAdmin()
// middleware wrapper rather than inline adminId checks — tested via router-level middleware.

vi.mock("../lib/email-service.js", () => ({
  queueAndSendEmail: vi.fn().mockResolvedValue("email-mock-id"),
  setSesClient: vi.fn(),
}));

const PII_FIELDS = ["name", "email", "street", "house_number", "floor", "door"];

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "GET",
    path: "/",
    body: undefined,
    headers: {},
    params: {},
    ...overrides,
  };
}

function assertNoPiiInObject(obj: Record<string, unknown>, context: string, allowedFields: string[] = []) {
  for (const field of PII_FIELDS) {
    if (allowedFields.includes(field)) continue;
    expect(obj, `${context}: should not contain PII field "${field}"`).not.toHaveProperty(field);
  }
}

function assertNoPiiInResponse(body: unknown, context: string, allowedFields: string[] = []) {
  if (Array.isArray(body)) {
    for (const item of body) {
      assertNoPiiInObject(item as Record<string, unknown>, context, allowedFields);
    }
  } else if (typeof body === "object" && body !== null) {
    assertNoPiiInObject(body as Record<string, unknown>, context, allowedFields);
  }
}

describe("PII redaction — public endpoints never return personal data", () => {
  describe("GET /public/status", () => {
    it("response contains only isOpen, openingDatetime, and hasAvailableTables", async () => {
      const executeTakeFirstOrThrowFn = vi.fn().mockResolvedValue({ count: 5 });
      const asFn = vi.fn().mockReturnValue("count");
      const countAllFn = vi.fn().mockReturnValue({ as: asFn });
      const fnObj = { countAll: countAllFn };
      const mockDb = {
        selectFrom: vi.fn().mockImplementation((table: string) => {
          if (table === "system_settings") {
            return {
              select: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  opening_datetime: new Date(Date.now() - 86400000),
                }),
              }),
            };
          }
          if (table === "tables") {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: executeTakeFirstOrThrowFn,
                }),
              }),
            };
          }
          return {};
        }),
        fn: fnObj,
      } as unknown as Kysely<Database>;

      const res = await handlePublicStatus(makeCtx({ db: mockDb }));
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      const keys = Object.keys(body).sort();
      expect(keys).toEqual(["hasAvailableTables", "isOpen", "openingDatetime", "serverTime"]);
      assertNoPiiInResponse(body, "handlePublicStatus");
    });
  });

  describe("GET /public/hall", () => {
    it("response contains only aggregated counts, no PII", async () => {
      const mockTables = [
        { state: "available" },
        { state: "occupied" },
        { state: "reserved" },
      ];
      const executeFn = vi.fn().mockResolvedValue(mockTables);
      const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
      const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
      const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

      const res = await handlePublicHallSummary(makeCtx({ db: mockDb }));
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;

      const keys = Object.keys(body).sort();
      expect(keys).toEqual(["availableTables", "occupiedTables", "totalTables"]);
      assertNoPiiInResponse(body, "handlePublicHallSummary");
    });
  });

  describe("GET /public/tables", () => {
    it("response contains only id and state — no PII", async () => {
      const mockRows = [
        { id: 1, state: "available" },
        { id: 2, state: "occupied" },
      ];
      const executeFn = vi.fn().mockResolvedValue(mockRows);
      const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
      const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
      const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

      const res = await handlePublicTables(makeCtx({ db: mockDb }));
      expect(res.statusCode).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;

      for (const t of body) {
        const keys = Object.keys(t).sort();
        expect(keys).toEqual(["id", "state"]);
        assertNoPiiInResponse([t], "handlePublicTables");
      }
    });
  });

  describe("POST /public/validate-address", () => {
    it("eligible response contains no PII", async () => {
      const res = await handleValidateAddress(
        makeCtx({
          body: { street: "Else Alfelts Vej", houseNumber: 130, floor: null, door: null },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleValidateAddress (eligible)");
      expect(body).not.toHaveProperty("name");
      expect(body).not.toHaveProperty("email");
    });

    it("ineligible response contains no PII", async () => {
      const res = await handleValidateAddress(
        makeCtx({
          body: { street: "Main Street", houseNumber: 1, floor: null, door: null },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleValidateAddress (ineligible)");
    });
  });

  describe("POST /public/validate-registration", () => {
    it("validation response contains no PII", async () => {
      const res = await handleValidateRegistration(
        makeCtx({
          body: {
            name: "Alice",
            email: "alice@example.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            floor: null,
            door: null,
            language: "da",
            tableId: 1,
          },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleValidateRegistration");
    });

    it("validation error response does not echo back PII", async () => {
      const res = await handleValidateRegistration(
        makeCtx({ body: {} }),
      );
      expect(res.statusCode).toBe(422);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleValidateRegistration (error)");
    });
  });

  describe("POST /public/register", () => {
    it("success response returns only registrationId, tableId, apartmentKey — no PII", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const mockDb = makeMockDbForRegister({
        openingDatetime: pastDate,
        box: { id: 1, state: "available" },
        existingReg: undefined,
        newRegId: "reg-new",
      });

      const res = await handlePublicRegister(
        makeCtx({
          db: mockDb,
          body: {
            name: "Alice",
            email: "alice@example.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            floor: null,
            door: null,
            language: "da",
            tableId: 1,
          },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handlePublicRegister");
      expect(body).toHaveProperty("registrationId");
      expect(body).toHaveProperty("tableId");
      expect(body).toHaveProperty("apartmentKey");
      expect(body).not.toHaveProperty("name");
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("street");
    });

    it("switch-required response contains no PII", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const mockDb = makeMockDbForRegister({
        openingDatetime: pastDate,
        box: { id: 1, state: "available" },
        existingReg: { id: "reg-old", table_id: 5, name: "Alice", email: "a@b.com", status: "active" },
      });

      const res = await handlePublicRegister(
        makeCtx({
          db: mockDb,
          body: {
            name: "Alice",
            email: "alice@example.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            floor: null,
            door: null,
            language: "da",
            tableId: 1,
          },
        }),
      );
      expect(res.statusCode).toBe(409);
      const body = res.body as Record<string, unknown>;
      expect(body).not.toHaveProperty("name");
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("street");
    });
  });

  describe("POST /public/waitlist", () => {
    it("success response returns only position data, no PII", async () => {
      const mockDb = makeMockDbForWaitlist({
        availableCount: 0,
        existingEntry: undefined,
        newEntryId: "wl-1",
        positionEntryCreatedAt: "2026-03-01T10:00:00Z",
        positionCount: 1,
      });

      const res = await handleJoinWaitlist(
        makeCtx({
          db: mockDb,
          body: {
            name: "Alice",
            email: "alice@example.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            floor: null,
            door: null,
            language: "da",
          },
        }),
      );
      expect(res.statusCode).toBe(201);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleJoinWaitlist");
      expect(body).not.toHaveProperty("name");
      expect(body).not.toHaveProperty("email");
    });

    it("already-on-waitlist response returns no PII", async () => {
      const mockDb = makeMockDbForWaitlist({
        availableCount: 0,
        existingEntry: { id: "wl-existing", created_at: "2026-03-01T08:00:00Z" },
        positionEntryCreatedAt: "2026-03-01T08:00:00Z",
        positionCount: 3,
      });

      const res = await handleJoinWaitlist(
        makeCtx({
          db: mockDb,
          body: {
            name: "Alice",
            email: "alice@example.com",
            street: "Else Alfelts Vej",
            houseNumber: 130,
            floor: null,
            door: null,
            language: "da",
          },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleJoinWaitlist (existing)");
    });
  });

  describe("GET /public/waitlist/position/:apartmentKey", () => {
    it("response contains only position data, no PII", async () => {
      const executeTakeFirstFn = vi.fn().mockResolvedValue(undefined);
      const whereFn2 = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
      const whereFn1 = vi.fn().mockReturnValue({ where: whereFn2 });
      const selectFn = vi.fn().mockReturnValue({ where: whereFn1 });
      const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
      const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

      const res = await handleWaitlistPosition(
        makeCtx({
          db: mockDb,
          params: { apartmentKey: "else alfelts vej 130" },
        }),
      );
      expect(res.statusCode).toBe(200);
      const body = res.body as Record<string, unknown>;
      assertNoPiiInResponse(body, "handleWaitlistPosition");
    });
  });
});

describe("admin auth enforcement — all admin handlers reject unauthenticated requests", () => {
  it("handleListRegistrations throws 401 without adminId", async () => {
    try {
      await handleListRegistrations(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleCreateRegistration throws 401 without adminId", async () => {
    try {
      await handleCreateRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleMoveRegistration throws 401 without adminId", async () => {
    try {
      await handleMoveRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleRemoveRegistration throws 401 without adminId", async () => {
    try {
      await handleRemoveRegistration(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleAssignWaitlist throws 401 without adminId", async () => {
    try {
      await handleAssignWaitlist(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleNotificationPreview throws 401 without adminId", async () => {
    try {
      await handleNotificationPreview(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleListAdmins throws 401 without adminId", async () => {
    try {
      await handleListAdmins(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleCreateAdmin throws 401 without adminId", async () => {
    try {
      await handleCreateAdmin(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleDeleteAdmin throws 401 without adminId", async () => {
    try {
      await handleDeleteAdmin(makeCtx({ adminId: undefined, params: { id: "admin-x" } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("handleListAuditEvents throws 401 without adminId", async () => {
    try {
      await handleListAuditEvents(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  // Note: handleGetOpeningTime and handleUpdateOpeningTime are protected by
  // the requireAdmin() middleware wrapper at the router level (index.ts lines 67-68),
  // not by inline adminId checks. Their auth is tested via the middleware test below.

  it("handleChangePassword throws 401 without adminId", async () => {
    try {
      await handleChangePassword(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("requireAdmin middleware rejects request without session cookie", async () => {
    const inner = vi.fn().mockResolvedValue({ statusCode: 200, body: {} });
    const guarded = requireAdmin(inner);

    try {
      await guarded(makeCtx({ headers: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
      expect(inner).not.toHaveBeenCalled();
    }
  });
});

describe("admin data visibility — authenticated admin can access PII for operational use", () => {
  it("handleListRegistrations returns PII fields for authenticated admin", async () => {
    const mockRegs = [
      {
        id: "r1",
        table_id: 1,
        name: "Alice Smith",
        email: "alice@example.com",
        street: "Else Alfelts Vej",
        house_number: 130,
        floor: null,
        door: null,
        apartment_key: "else alfelts vej 130",
        language: "da",
        status: "active",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockRegs);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleListRegistrations(makeCtx({ db: mockDb, adminId: "admin-1" }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Alice Smith");
    expect(body[0].email).toBe("alice@example.com");
    expect(body[0].street).toBe("Else Alfelts Vej");
    expect(body[0].house_number).toBe(130);
  });
});

describe("DTO contract — public response shapes are strict and PII-free", () => {
  it("public status DTO has exactly 4 fields", async () => {
    const mockDb = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "system_settings") {
          return {
            select: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue({ opening_datetime: null }),
            }),
          };
        }
        if (table === "tables") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: 0 }),
              }),
            }),
          };
        }
        return {};
      }),
      fn: { countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("count") }) },
    } as unknown as Kysely<Database>;

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(4);
    expect(body).toHaveProperty("isOpen");
    expect(body).toHaveProperty("openingDatetime");
    expect(body).toHaveProperty("hasAvailableTables");
    expect(body).toHaveProperty("serverTime");
  });

  it("public hall summary DTO has exactly 3 fields", async () => {
    const mockTables = [{ state: "available" }];
    const executeFn = vi.fn().mockResolvedValue(mockTables);
    const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicHallSummary(makeCtx({ db: mockDb }));
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(3);
    expect(body).toHaveProperty("totalTables");
    expect(body).toHaveProperty("availableTables");
    expect(body).toHaveProperty("occupiedTables");
  });

  it("public table DTO has exactly 2 fields per entry", async () => {
    const mockRows = [{ id: 1, state: "available" }];
    const executeFn = vi.fn().mockResolvedValue(mockRows);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicTables(makeCtx({ db: mockDb }));
    const body = res.body as Array<Record<string, unknown>>;
    for (const entry of body) {
      expect(Object.keys(entry)).toHaveLength(2);
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("state");
    }
  });

  it("public register success DTO has exactly 3 fields", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "available" },
      existingReg: undefined,
      newRegId: "reg-new",
    });

    const res = await handlePublicRegister(
      makeCtx({
        db: mockDb,
        body: {
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          floor: null,
          door: null,
          language: "da",
          tableId: 1,
        },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(3);
    expect(body).toHaveProperty("registrationId");
    expect(body).toHaveProperty("tableId");
    expect(body).toHaveProperty("apartmentKey");
  });

  it("validate-address DTO never includes resident information", async () => {
    const res = await handleValidateAddress(
      makeCtx({
        body: { street: "Else Alfelts Vej", houseNumber: 170, floor: "2", door: "th" },
      }),
    );
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["apartmentKey", "eligible", "error", "floorDoorRequired"]);
  });

  it("waitlist position DTO returns only onWaitlist and position", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue(undefined);
    const whereFn2 = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const whereFn1 = vi.fn().mockReturnValue({ where: whereFn2 });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn1 });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleWaitlistPosition(
      makeCtx({ db: mockDb, params: { apartmentKey: "else alfelts vej 130" } }),
    );
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["onWaitlist", "position"]);
    assertNoPiiInResponse(body, "waitlist position DTO");
  });
});

interface MockRegisterOpts {
  openingDatetime: Date;
  box?: { id: number; state: string };
  existingReg?: { id: string; table_id: number; name: string; email: string; status: string };
  newRegId?: string;
}

function makeMockDbForRegister(opts: MockRegisterOpts): Kysely<Database> {
  const settingsResult = { opening_datetime: opts.openingDatetime };
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];

  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "tables") {
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

  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "system_settings") {
        return {
          select: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(settingsResult),
          }),
        };
      }
      return {};
    }),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "emails") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([{ id: "email-1" }]),
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
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  } as unknown as Kysely<Database>;
}

interface MockWaitlistOpts {
  availableCount: number;
  existingEntry?: { id: string; created_at: string };
  existingRegistrationId?: string;
  newEntryId?: string;
  positionEntryCreatedAt?: string;
  positionCount?: number;
}

function makeMockDbForWaitlist(opts: MockWaitlistOpts): Kysely<Database> {
  let waitlistCallNum = 0;

  const mockTrx = {
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "waitlist_entries") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                id: opts.newEntryId ?? "wl-id",
              }),
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

  const asFn = vi.fn().mockReturnValue("position");
  const countAllFn = vi.fn().mockReturnValue({ as: asFn });
  const fnObj = { countAll: countAllFn };

  function makeWaitlistSelect() {
    waitlistCallNum++;
    const n = waitlistCallNum;

    if (n === 1) {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(opts.existingEntry),
            }),
          }),
        }),
      };
    }

    if (n === 2) {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(
                opts.positionEntryCreatedAt
                  ? { created_at: opts.positionEntryCreatedAt }
                  : undefined,
              ),
            }),
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
              position: opts.positionCount ?? 0,
            }),
          }),
        }),
      }),
    };
  }

  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(
                  opts.existingRegistrationId
                    ? { id: opts.existingRegistrationId }
                    : undefined,
                ),
              }),
            }),
          }),
        };
      }
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                count: opts.availableCount,
              }),
            }),
          }),
        };
      }
      if (table === "waitlist_entries") {
        return makeWaitlistSelect();
      }
      return {};
    }),
    fn: fnObj,
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
  } as unknown as Kysely<Database>;
}
