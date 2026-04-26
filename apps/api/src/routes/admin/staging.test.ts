import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { handleFillTables, handleClearRegistrations } from "./staging.js";

vi.mock("../../lib/audit.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "POST",
    path: "/admin/staging/fill-tables",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleFillTables", () => {
  const originalEnv = process.env["ENVIRONMENT"];

  beforeEach(() => {
    process.env["ENVIRONMENT"] = "staging";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["ENVIRONMENT"];
    } else {
      process.env["ENVIRONMENT"] = originalEnv;
    }
  });

  it("throws 401 when adminId is missing", async () => {
    try {
      await handleFillTables(makeCtx({ adminId: undefined, body: { confirm: true } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when not in staging environment", async () => {
    process.env["ENVIRONMENT"] = "production";
    try {
      await handleFillTables(makeCtx({ body: { confirm: true } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("staging");
    }
  });

  it("throws 400 when ENVIRONMENT is unset", async () => {
    delete process.env["ENVIRONMENT"];
    try {
      await handleFillTables(makeCtx({ body: { confirm: true } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when confirm is not provided", async () => {
    try {
      await handleFillTables(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("Confirmation");
    }
  });

  it("fills available tables with fake registrations", async () => {
    const mockTables = [
      { id: 1, state: "available" },
      { id: 2, state: "reserved" },
    ];

    const executeFn = vi.fn().mockResolvedValue(mockTables);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });

    const insertExecuteFn = vi.fn().mockResolvedValue([]);
    const insertValuesFn = vi.fn().mockReturnValue({ execute: insertExecuteFn });
    const insertIntoFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const updateExecuteFn = vi.fn().mockResolvedValue([]);
    const updateWhereFn = vi.fn().mockReturnValue({ execute: updateExecuteFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateTableFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const trx = {
      selectFrom: selectFromFn,
      insertInto: insertIntoFn,
      updateTable: updateTableFn,
    } as unknown as Kysely<Database>;

    const trxExecuteFn = vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(trx));
    const transactionFn = vi.fn().mockReturnValue({ execute: trxExecuteFn });
    const mockDb = { transaction: transactionFn } as unknown as Kysely<Database>;

    const res = await handleFillTables(makeCtx({ body: { confirm: true }, db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as { filledCount: number; totalTables: number };
    expect(body.filledCount).toBe(2);
    expect(body.totalTables).toBe(24);
  });
});

describe("handleClearRegistrations", () => {
  const originalEnv = process.env["ENVIRONMENT"];

  beforeEach(() => {
    process.env["ENVIRONMENT"] = "staging";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["ENVIRONMENT"];
    } else {
      process.env["ENVIRONMENT"] = originalEnv;
    }
  });

  it("throws 401 when adminId is missing", async () => {
    try {
      await handleClearRegistrations(makeCtx({ adminId: undefined, body: { confirm: true } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when not in staging environment", async () => {
    process.env["ENVIRONMENT"] = "production";
    try {
      await handleClearRegistrations(makeCtx({ body: { confirm: true } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("staging");
    }
  });

  it("throws 400 when confirm is not provided", async () => {
    try {
      await handleClearRegistrations(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("clears all active registrations and releases tables", async () => {
    const mockRegs = [
      { id: "r1", table_id: 1 },
      { id: "r2", table_id: 3 },
    ];

    const selectExecuteFn = vi.fn().mockResolvedValue(mockRegs);
    const selectWhereFn = vi.fn().mockReturnValue({ execute: selectExecuteFn });
    const selectFn = vi.fn().mockReturnValue({ where: selectWhereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });

    const updateExecuteFn = vi.fn().mockResolvedValue([]);
    const updateWhereFn = vi.fn().mockReturnValue({ execute: updateExecuteFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateTableFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const insertExecuteFn = vi.fn().mockResolvedValue([]);
    const insertValuesFn = vi.fn().mockReturnValue({ execute: insertExecuteFn });
    const insertIntoFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const trx = {
      selectFrom: selectFromFn,
      updateTable: updateTableFn,
      insertInto: insertIntoFn,
    } as unknown as Kysely<Database>;

    const trxExecuteFn = vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(trx));
    const transactionFn = vi.fn().mockReturnValue({ execute: trxExecuteFn });
    const mockDb = { transaction: transactionFn } as unknown as Kysely<Database>;

    const res = await handleClearRegistrations(makeCtx({ body: { confirm: true }, db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as { clearedCount: number };
    expect(body.clearedCount).toBe(2);
  });

  it("handles case with no active registrations", async () => {
    const selectExecuteFn = vi.fn().mockResolvedValue([]);
    const selectWhereFn = vi.fn().mockReturnValue({ execute: selectExecuteFn });
    const selectFn = vi.fn().mockReturnValue({ where: selectWhereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });

    const insertExecuteFn = vi.fn().mockResolvedValue([]);
    const insertValuesFn = vi.fn().mockReturnValue({ execute: insertExecuteFn });
    const insertIntoFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const trx = {
      selectFrom: selectFromFn,
      insertInto: insertIntoFn,
    } as unknown as Kysely<Database>;

    const trxExecuteFn = vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(trx));
    const transactionFn = vi.fn().mockReturnValue({ execute: trxExecuteFn });
    const mockDb = { transaction: transactionFn } as unknown as Kysely<Database>;

    const res = await handleClearRegistrations(makeCtx({ body: { confirm: true }, db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as { clearedCount: number };
    expect(body.clearedCount).toBe(0);
  });
});
