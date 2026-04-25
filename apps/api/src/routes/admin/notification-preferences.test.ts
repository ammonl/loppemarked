import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import {
  handleGetNotificationPreferences,
  handleUpdateNotificationPreferences,
} from "./settings.js";

vi.mock("../../lib/audit.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "GET",
    path: "/admin/settings/notification-preferences",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleGetNotificationPreferences", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleGetNotificationPreferences(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("returns defaults when no preferences row exists", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue(undefined);
    const whereFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleGetNotificationPreferences(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.notifyUserRegistration).toBe(true);
    expect(body.notifyAdminTableAction).toBe(true);
    expect(body.updatedAt).toBeNull();
  });

  it("returns stored preferences", async () => {
    const storedDate = "2026-03-10T12:00:00.000Z";
    const executeTakeFirstFn = vi.fn().mockResolvedValue({
      notify_user_registration: false,
      notify_admin_table_action: true,
      updated_at: storedDate,
    });
    const whereFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleGetNotificationPreferences(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.notifyUserRegistration).toBe(false);
    expect(body.notifyAdminTableAction).toBe(true);
    expect(body.updatedAt).toBe(new Date(storedDate).toISOString());
  });
});

describe("handleUpdateNotificationPreferences", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleUpdateNotificationPreferences(makeCtx({
        adminId: undefined,
        body: { notifyUserRegistration: false },
      }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when no preferences provided", async () => {
    try {
      await handleUpdateNotificationPreferences(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("At least one preference must be provided");
    }
  });

  it("inserts new preferences when none exist", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue(undefined);
    const selectWhereFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFn = vi.fn().mockReturnValue({ where: selectWhereFn });

    const insertExecuteFn = vi.fn().mockResolvedValue(undefined);
    const insertValuesFn = vi.fn().mockReturnValue({ execute: insertExecuteFn });

    const auditExecuteFn = vi.fn().mockResolvedValue(undefined);
    const auditValuesFn = vi.fn().mockReturnValue({ execute: auditExecuteFn });

    const selectFromFn = vi.fn()
      .mockReturnValueOnce({ select: selectFn });

    const mockDb = {
      selectFrom: selectFromFn,
      insertInto: vi.fn()
        .mockReturnValueOnce({ values: insertValuesFn })
        .mockReturnValueOnce({ values: auditValuesFn }),
    } as unknown as Kysely<Database>;

    const res = await handleUpdateNotificationPreferences(makeCtx({
      db: mockDb,
      body: { notifyUserRegistration: false },
    }));

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.notifyUserRegistration).toBe(false);
    expect(body.notifyAdminTableAction).toBe(true);
  });

  it("updates existing preferences", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue({
      admin_id: "admin-1",
      notify_user_registration: true,
      notify_admin_table_action: true,
    });
    const selectWhereFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFn = vi.fn().mockReturnValue({ where: selectWhereFn });

    const updateExecuteFn = vi.fn().mockResolvedValue(undefined);
    const updateWhereFn = vi.fn().mockReturnValue({ execute: updateExecuteFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateTableFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const auditExecuteFn = vi.fn().mockResolvedValue(undefined);
    const auditValuesFn = vi.fn().mockReturnValue({ execute: auditExecuteFn });

    const selectFromFn = vi.fn()
      .mockReturnValueOnce({ select: selectFn });

    const mockDb = {
      selectFrom: selectFromFn,
      updateTable: updateTableFn,
      insertInto: vi.fn().mockReturnValue({ values: auditValuesFn }),
    } as unknown as Kysely<Database>;

    const res = await handleUpdateNotificationPreferences(makeCtx({
      db: mockDb,
      body: { notifyAdminTableAction: false },
    }));

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.notifyUserRegistration).toBe(true);
    expect(body.notifyAdminTableAction).toBe(false);
  });
});
