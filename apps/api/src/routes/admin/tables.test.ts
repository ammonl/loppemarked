import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { handleAdminTables, handleReserveTable, handleReleaseTable } from "./tables.js";

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
    path: "/admin/tables",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleAdminTables", () => {
  function mockListDb(tableRows: unknown[], regRows: unknown[]) {
    const tableExecuteFn = vi.fn().mockResolvedValue(tableRows);
    const tableOrderByFn = vi.fn().mockReturnValue({ execute: tableExecuteFn });
    const tableSelectFn = vi.fn().mockReturnValue({ orderBy: tableOrderByFn });

    const regExecuteFn = vi.fn().mockResolvedValue(regRows);
    const regWhereFn = vi.fn().mockReturnValue({ execute: regExecuteFn });
    const regSelectFn = vi.fn().mockReturnValue({ where: regWhereFn });

    const selectFromFn = vi.fn()
      .mockReturnValueOnce({ select: tableSelectFn })
      .mockReturnValueOnce({ select: regSelectFn });

    return { selectFrom: selectFromFn } as unknown as Kysely<Database>;
  }

  it("returns tables with registration data", async () => {
    const mockTableRows = [
      { id: 1, state: "available", reserved_label: null },
      { id: 2, state: "occupied", reserved_label: null },
      { id: 15, state: "reserved", reserved_label: "Awaiting Admin Review" },
    ];
    const mockRegRows = [
      { id: "r1", table_id: 2, name: "Alice", email: "alice@test.com", language: "en", status: "active" },
    ];

    const res = await handleAdminTables(makeCtx({ db: mockListDb(mockTableRows, mockRegRows) }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(3);

    expect(body[0]).toEqual({ id: 1, state: "available", reservedLabel: null, registration: null });
    expect(body[1]).toEqual({
      id: 2, state: "occupied", reservedLabel: null,
      registration: { id: "r1", name: "Alice", email: "alice@test.com", language: "en" },
    });
    expect(body[2]).toEqual({
      id: 15, state: "reserved",
      reservedLabel: "Awaiting Admin Review", registration: null,
    });
  });

  it("returns empty array when no tables exist", async () => {
    const res = await handleAdminTables(makeCtx({ db: mockListDb([], []) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("handleReserveTable", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleReserveTable(makeCtx({ adminId: undefined, body: { tableId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when tableId is missing", async () => {
    try {
      await handleReserveTable(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when table is not available", async () => {
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
      await handleReserveTable(makeCtx({ body: { tableId: 1 }, db: mockDb }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handleReleaseTable", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleReleaseTable(makeCtx({ adminId: undefined, body: { tableId: 1 } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when tableId is missing", async () => {
    try {
      await handleReleaseTable(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when table is not reserved", async () => {
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
      await handleReleaseTable(makeCtx({ body: { tableId: 1 }, db: mockDb }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});
