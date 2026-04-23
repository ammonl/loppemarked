import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { handleAdminBoxes, handleReserveBox, handleReleaseBox } from "./boxes.js";

vi.mock("../../lib/audit.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/admin-ops-notifications.js", () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "GET",
    path: "/admin/boxes",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleAdminBoxes", () => {
  function mockListDb(boxRows: unknown[], regRows: unknown[]) {
    const boxExecuteFn = vi.fn().mockResolvedValue(boxRows);
    const boxOrderByFn = vi.fn().mockReturnValue({ execute: boxExecuteFn });
    const boxSelectFn = vi.fn().mockReturnValue({ orderBy: boxOrderByFn });

    const regExecuteFn = vi.fn().mockResolvedValue(regRows);
    const regWhereFn = vi.fn().mockReturnValue({ execute: regExecuteFn });
    const regSelectFn = vi.fn().mockReturnValue({ where: regWhereFn });

    const selectFromFn = vi.fn()
      .mockReturnValueOnce({ select: boxSelectFn })
      .mockReturnValueOnce({ select: regSelectFn });

    return { selectFrom: selectFromFn } as unknown as Kysely<Database>;
  }

  it("returns boxes with registration data", async () => {
    const mockBoxRows = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "available", reserved_label: null },
      { id: 2, name: "Harebell", greenhouse_name: "Kronen", state: "occupied", reserved_label: null },
      { id: 15, name: "Robin", greenhouse_name: "Søen", state: "reserved", reserved_label: "Awaiting Admin Review" },
    ];
    const mockRegRows = [
      { id: "r1", box_id: 2, name: "Alice", email: "alice@test.com", language: "en", status: "active" },
    ];

    const res = await handleAdminBoxes(makeCtx({ db: mockListDb(mockBoxRows, mockRegRows) }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(3);

    expect(body[0]).toEqual({ id: 1, name: "Linaria", greenhouse: "Kronen", state: "available", reservedLabel: null, registration: null });
    expect(body[1]).toEqual({
      id: 2, name: "Harebell", greenhouse: "Kronen", state: "occupied", reservedLabel: null,
      registration: { id: "r1", name: "Alice", email: "alice@test.com", language: "en" },
    });
    expect(body[2]).toEqual({
      id: 15, name: "Robin", greenhouse: "Søen", state: "reserved",
      reservedLabel: "Awaiting Admin Review", registration: null,
    });
  });

  it("returns empty array when no boxes exist", async () => {
    const res = await handleAdminBoxes(makeCtx({ db: mockListDb([], []) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("handleReserveBox", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleReserveBox(makeCtx({ adminId: undefined, body: { boxId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when boxId is missing", async () => {
    try {
      await handleReserveBox(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when box is not available", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue({ id: 1, state: "occupied" });
    const forUpdateFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const whereFn = vi.fn().mockReturnValue({ forUpdate: forUpdateFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const trx = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const executeFn = vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(trx));
    const transactionFn = vi.fn().mockReturnValue({ execute: executeFn });
    const mockDb = { transaction: transactionFn } as unknown as Kysely<Database>;

    try {
      await handleReserveBox(makeCtx({ body: { boxId: 1 }, db: mockDb }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handleReleaseBox", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleReleaseBox(makeCtx({ adminId: undefined, body: { boxId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when boxId is missing", async () => {
    try {
      await handleReleaseBox(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when box is not reserved", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue({ id: 1, state: "available" });
    const forUpdateFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const whereFn = vi.fn().mockReturnValue({ forUpdate: forUpdateFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const trx = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const executeFn = vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(trx));
    const transactionFn = vi.fn().mockReturnValue({ execute: executeFn });
    const mockDb = { transaction: transactionFn } as unknown as Kysely<Database>;

    try {
      await handleReleaseBox(makeCtx({ body: { boxId: 1 }, db: mockDb }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});
