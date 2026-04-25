import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { handleListAuditEvents } from "./audit.js";

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "POST",
    path: "/admin/audit-events",
    body: undefined,
    headers: {},
    params: {},
    ...overrides,
  };
}

function createMockDb(rows: unknown[], adminRows: unknown[] = [], boxRows: unknown[] = []) {
  const executeFn = vi.fn().mockResolvedValue(rows);
  const limitFn = vi.fn().mockReturnValue({ execute: executeFn, where: vi.fn().mockReturnValue({ execute: executeFn }) });
  const orderBy2 = vi.fn().mockReturnValue({ limit: limitFn });
  const orderBy1 = vi.fn().mockReturnValue({ orderBy: orderBy2 });
  const selectFn = vi.fn().mockReturnValue({ orderBy: orderBy1 });

  const adminExecuteFn = vi.fn().mockResolvedValue(adminRows);
  const adminWhereFn = vi.fn().mockReturnValue({ execute: adminExecuteFn });
  const adminSelectFn = vi.fn().mockReturnValue({ where: adminWhereFn });

  const boxExecuteFn = vi.fn().mockResolvedValue(boxRows);
  const boxWhereFn = vi.fn().mockReturnValue({ execute: boxExecuteFn });
  const boxSelectFn = vi.fn().mockReturnValue({ where: boxWhereFn });

  const selectFromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "admins") {
      return { select: adminSelectFn };
    }
    if (table === "tables") {
      return { select: boxSelectFn };
    }
    return { select: selectFn };
  });

  return {
    db: { selectFrom: selectFromFn } as unknown as Kysely<Database>,
    mocks: { executeFn, limitFn, orderBy2, orderBy1, selectFn, selectFromFn },
  };
}

describe("handleListAuditEvents", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleListAuditEvents(makeCtx());
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 for invalid action filter", async () => {
    try {
      await handleListAuditEvents(
        makeCtx({ adminId: "admin-1", body: { action: "invalid_action" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("Invalid action filter");
    }
  });

  it("throws 400 for invalid actorType filter", async () => {
    try {
      await handleListAuditEvents(
        makeCtx({ adminId: "admin-1", body: { actorType: "invalid" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("Invalid actorType");
    }
  });

  it("throws 400 for invalid before date", async () => {
    try {
      await handleListAuditEvents(
        makeCtx({ adminId: "admin-1", body: { before: "not-a-date" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("before");
    }
  });

  it("throws 400 for invalid after date", async () => {
    try {
      await handleListAuditEvents(
        makeCtx({ adminId: "admin-1", body: { after: "not-a-date" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("after");
    }
  });

  it("throws 400 for invalid cursor format", async () => {
    const { db } = createMockDb([]);
    try {
      await handleListAuditEvents(
        makeCtx({ adminId: "admin-1", db, body: { cursor: "not-valid-base64-json" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toContain("cursor");
    }
  });

  it("returns events with pagination from mock db", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        timestamp: new Date("2026-03-01T10:00:00Z"),
        actor_type: "admin" as const,
        actor_id: "admin-1",
        action: "admin_create",
        entity_type: "admin",
        entity_id: "admin-2",
        before: null,
        after: { email: "new@example.com" },
        reason: null,
      },
    ];

    const { db } = createMockDb(mockEvents, [{ id: "admin-1", email: "alice@example.com" }]);

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db, body: {} }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as { events: unknown[]; nextCursor: string | null; hasMore: boolean };
    expect(body.events).toHaveLength(1);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect((body.events[0] as Record<string, unknown>).action).toBe("admin_create");
    expect((body.events[0] as Record<string, unknown>).actorType).toBe("admin");
    expect((body.events[0] as Record<string, unknown>).actorName).toBe("alice@example.com");
  });

  it("applies action filter to query", async () => {
    const whereFn = vi.fn();
    const executeFn = vi.fn().mockResolvedValue([]);
    const limitFn = vi.fn().mockReturnValue({ where: whereFn });
    whereFn.mockReturnValue({ execute: executeFn });
    const orderBy2 = vi.fn().mockReturnValue({ limit: limitFn });
    const orderBy1 = vi.fn().mockReturnValue({ orderBy: orderBy2 });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderBy1 });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db: mockDb, body: { action: "admin_create" } }),
    );

    expect(res.statusCode).toBe(200);
    expect(whereFn).toHaveBeenCalledWith("action", "=", "admin_create");
  });

  it("resolves table labels from planter_box entity events", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        timestamp: new Date("2026-03-01T10:00:00Z"),
        actor_type: "admin" as const,
        actor_id: null,
        action: "table_state_change",
        entity_type: "table",
        entity_id: "5",
        before: { state: "available" },
        after: { state: "occupied" },
        reason: null,
      },
    ];

    const { db } = createMockDb(mockEvents, [], []);

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db, body: {} }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as { tableLabels: Record<string, string> };
    expect(body.tableLabels).toEqual({ "5": "Table #5" });
  });

  it("resolves table labels from before/after box_id fields", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        timestamp: new Date("2026-03-01T10:00:00Z"),
        actor_type: "admin" as const,
        actor_id: null,
        action: "registration_move",
        entity_type: "registration",
        entity_id: "reg-1",
        before: { table_id: 5 },
        after: { table_id: 10 },
        reason: null,
      },
    ];

    const { db } = createMockDb(mockEvents, [], []);

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db, body: {} }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as { tableLabels: Record<string, string> };
    expect(body.tableLabels).toEqual({ "5": "Table #5", "10": "Table #10" });
  });

  it("returns empty tableLabels when no box IDs are present", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        timestamp: new Date("2026-03-01T10:00:00Z"),
        actor_type: "admin" as const,
        actor_id: null,
        action: "admin_create",
        entity_type: "admin",
        entity_id: "admin-2",
        before: null,
        after: { email: "new@example.com" },
        reason: null,
      },
    ];

    const { db } = createMockDb(mockEvents);

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db, body: {} }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as { tableLabels: Record<string, string> };
    expect(body.tableLabels).toEqual({});
  });

  it("detects hasMore and returns nextCursor when extra rows returned", async () => {
    const events = Array.from({ length: 51 }, (_, i) => ({
      id: `evt-${50 - i}`,
      timestamp: new Date(`2026-03-01T10:${String(50 - i).padStart(2, "0")}:00Z`),
      actor_type: "admin" as const,
      actor_id: "admin-1",
      action: "admin_create",
      entity_type: "admin",
      entity_id: `admin-${i}`,
      before: null,
      after: null,
      reason: null,
    }));

    const { db } = createMockDb(events, [{ id: "admin-1", email: "alice@example.com" }]);

    const res = await handleListAuditEvents(
      makeCtx({ adminId: "admin-1", db, body: {} }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as { events: unknown[]; nextCursor: string | null; hasMore: boolean };
    expect(body.events).toHaveLength(50);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(body.nextCursor!, "base64").toString("utf8"));
    expect(decoded.id).toBe("evt-1");
    expect(decoded.timestamp).toBeTruthy();
  });
});
