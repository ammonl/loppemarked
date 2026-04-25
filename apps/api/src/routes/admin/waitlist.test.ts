import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import { handleListWaitlist, handleRemoveWaitlist } from "./waitlist.js";

vi.mock("../../lib/waitlist-emails.js", () => ({
  notifyDownstreamWaitlist: vi.fn().mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0 }),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "GET",
    path: "/admin/waitlist",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

describe("handleListWaitlist", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleListWaitlist(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("returns waitlist entries from database", async () => {
    const mockEntries = [
      { id: "w1", name: "Alice", email: "alice@example.com", status: "waiting" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockEntries);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const result = await handleListWaitlist(makeCtx({ db: mockDb }));
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(mockEntries);
    expect(selectFromFn).toHaveBeenCalledWith("waitlist_entries");
  });

  it("returns empty array when no waitlist entries exist", async () => {
    const executeFn = vi.fn().mockResolvedValue([]);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const result = await handleListWaitlist(makeCtx({ db: mockDb }));
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual([]);
  });
});

interface RemoveMockOpts {
  entry?: {
    id: string;
    name: string;
    email: string;
    apartment_key: string;
    status: string;
    created_at?: Date;
  };
  deleteSpy?: ReturnType<typeof vi.fn>;
  auditSpy?: ReturnType<typeof vi.fn>;
}

function makeRemoveMockDb(opts: RemoveMockOpts): Kysely<Database> {
  const deleteExecute = opts.deleteSpy ?? vi.fn().mockResolvedValue(undefined);
  const auditExecute = opts.auditSpy ?? vi.fn().mockResolvedValue(undefined);

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
      return {};
    }),
    deleteFrom: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: deleteExecute,
      }),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: auditExecute,
          }),
        };
      }
      return {};
    }),
  };

  return {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
  } as unknown as Kysely<Database>;
}

describe("handleRemoveWaitlist", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleRemoveWaitlist(
        makeCtx({ adminId: undefined, params: { id: "w1" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when entry id is missing", async () => {
    try {
      await handleRemoveWaitlist(makeCtx({ params: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 404 when waitlist entry does not exist", async () => {
    const mockDb = makeRemoveMockDb({ entry: undefined });
    try {
      await handleRemoveWaitlist(
        makeCtx({ db: mockDb, params: { id: "missing" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
      expect((err as AppError).message).toBe("Waitlist entry not found");
    }
  });

  it("deletes the entry, writes an audit event, and returns 204", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const auditSpy = vi.fn().mockResolvedValue(undefined);
    const mockDb = makeRemoveMockDb({
      entry: {
        id: "w1",
        name: "Alice",
        email: "alice@example.com",
        apartment_key: "else alfelts vej 130",
        status: "waiting",
        created_at: new Date("2026-01-01T00:00:00Z"),
      },
      deleteSpy,
      auditSpy,
    });

    const result = await handleRemoveWaitlist(
      makeCtx({ db: mockDb, params: { id: "w1" } }),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBeNull();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  it("throws 400 when entry is already assigned (preserves booking history)", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const mockDb = makeRemoveMockDb({
      entry: {
        id: "w2",
        name: "Bob",
        email: "bob@example.com",
        apartment_key: "else alfelts vej 200",
        status: "assigned",
      },
      deleteSpy,
    });

    try {
      await handleRemoveWaitlist(
        makeCtx({ db: mockDb, params: { id: "w2" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe("handleRemoveWaitlist — notifyDownstream", () => {
  beforeEach(async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    vi.mocked(notifyDownstreamWaitlist).mockClear();
  });

  it("does not call notifyDownstreamWaitlist when flag is omitted", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const mockDb = makeRemoveMockDb({
      entry: {
        id: "w1",
        name: "Alice",
        email: "alice@example.com",
        apartment_key: "else alfelts vej 130",
        status: "waiting",
        created_at: new Date("2026-01-01T00:00:00Z"),
      },
    });

    await handleRemoveWaitlist(makeCtx({ db: mockDb, params: { id: "w1" } }));

    expect(notifyDownstreamWaitlist).not.toHaveBeenCalled();
  });

  it("does not call notifyDownstreamWaitlist when flag is false", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const mockDb = makeRemoveMockDb({
      entry: {
        id: "w1",
        name: "Alice",
        email: "alice@example.com",
        apartment_key: "else alfelts vej 130",
        status: "waiting",
        created_at: new Date("2026-01-01T00:00:00Z"),
      },
    });

    await handleRemoveWaitlist(
      makeCtx({
        db: mockDb,
        params: { id: "w1" },
        body: { notifyDownstream: false },
      }),
    );

    expect(notifyDownstreamWaitlist).not.toHaveBeenCalled();
  });

  it("calls notifyDownstreamWaitlist with the removed entry's created_at when flag is true", async () => {
    const { notifyDownstreamWaitlist } = await import("../../lib/waitlist-emails.js");
    const removedAt = new Date("2026-02-15T10:00:00Z");
    const mockDb = makeRemoveMockDb({
      entry: {
        id: "w1",
        name: "Alice",
        email: "alice@example.com",
        apartment_key: "else alfelts vej 130",
        status: "waiting",
        created_at: removedAt,
      },
    });

    await handleRemoveWaitlist(
      makeCtx({
        db: mockDb,
        params: { id: "w1" },
        body: { notifyDownstream: true },
      }),
    );

    expect(notifyDownstreamWaitlist).toHaveBeenCalledTimes(1);
    const call = vi.mocked(notifyDownstreamWaitlist).mock.calls[0];
    expect(call[1]).toBe("admin-1");
    expect(call[2]).toBe(removedAt);
    expect(call[3]).toEqual({
      triggerAction: "waitlist_remove",
      entityId: "w1",
    });
  });

  it("records the admin's notify_downstream choice in the waitlist_remove audit event", async () => {
    const auditValuesSpy = vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    });

    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "waitlist_entries") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  executeTakeFirst: vi.fn().mockResolvedValue({
                    id: "w1",
                    name: "Alice",
                    email: "alice@example.com",
                    apartment_key: "else alfelts vej 130",
                    status: "waiting",
                    created_at: new Date("2026-02-15T10:00:00Z"),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      deleteFrom: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insertInto: vi.fn().mockImplementation((table: string) => {
        if (table === "audit_events") {
          return { values: auditValuesSpy };
        }
        return {};
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockReturnValue({
        execute: vi.fn().mockImplementation(
          async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
        ),
      }),
    } as unknown as Kysely<Database>;

    await handleRemoveWaitlist(
      makeCtx({
        db: mockDb,
        params: { id: "w1" },
        body: { notifyDownstream: true },
      }),
    );

    const auditPayload = auditValuesSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(auditPayload.action).toBe("waitlist_remove");
    expect(JSON.parse(String(auditPayload.after))).toMatchObject({
      notify_downstream: true,
    });
  });
});
