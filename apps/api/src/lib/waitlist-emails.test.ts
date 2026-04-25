import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import {
  buildWaitlistJoinConfirmationEmail,
  buildWaitlistPositionUpdateEmail,
  notifyDownstreamWaitlist,
} from "./waitlist-emails.js";

vi.mock("./email-service.js", () => ({
  queueAndSendEmail: vi.fn().mockResolvedValue("email-id"),
}));

describe("buildWaitlistPositionUpdateEmail", () => {
  it("returns Danish subject for da language", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "da",
      newPosition: 3,
    });
    expect(result.subject).toContain("Din ventelisteposition");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English subject for en language", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      newPosition: 3,
    });
    expect(result.subject).toContain("waitlist position");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes recipient name in greeting", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna Jensen",
      recipientEmail: "anna@example.com",
      language: "da",
      newPosition: 2,
    });
    expect(result.bodyHtml).toContain("Anna Jensen");
  });

  it("includes the new position number", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      newPosition: 4,
    });
    expect(result.bodyHtml).toContain("#4");
    expect(result.bodyHtml).toContain("number 4");
  });

  it("uses dedicated wording for position 1", () => {
    const da = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "da",
      newPosition: 1,
    });
    expect(da.bodyHtml).toContain("nummer 1");
    expect(da.bodyHtml).toContain("først i køen");

    const en = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      newPosition: 1,
    });
    expect(en.bodyHtml).toContain("number 1");
    expect(en.bodyHtml).toContain("first in line");
  });

  it("escapes HTML in recipient name", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: '<script>alert("xss")</script>',
      recipientEmail: "x@y.com",
      language: "en",
      newPosition: 1,
    });
    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });

  it("wraps with branded header and footer", () => {
    const result = buildWaitlistPositionUpdateEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      newPosition: 2,
    });
    expect(result.bodyHtml).toContain("UN17 Village Loppemarked");
    expect(result.bodyHtml).toContain("#8DA88D");
    expect(result.bodyHtml).toContain("Fælledhuset");
  });

  it("sets html lang attribute matching language", () => {
    const da = buildWaitlistPositionUpdateEmail({
      recipientName: "X",
      recipientEmail: "x@y.com",
      language: "da",
      newPosition: 2,
    });
    expect(da.bodyHtml).toContain('lang="da"');

    const en = buildWaitlistPositionUpdateEmail({
      recipientName: "X",
      recipientEmail: "x@y.com",
      language: "en",
      newPosition: 2,
    });
    expect(en.bodyHtml).toContain('lang="en"');
  });
});

describe("buildWaitlistJoinConfirmationEmail", () => {
  it("returns Danish subject and waitlist wording for da language", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "da",
      position: 4,
    });
    expect(result.subject).toContain("ventelisten");
    expect(result.subject).toContain("UN17 Village Loppemarked");
    expect(result.bodyHtml).toContain("ventelisten");
  });

  it("returns English subject and waitlist wording for en language", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      position: 4,
    });
    expect(result.subject).toContain("waitlist");
    expect(result.subject).toContain("UN17 Village Loppemarked");
    expect(result.bodyHtml).toContain("waitlist");
  });

  it("makes it explicit that the resident is not booked", () => {
    const da = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "da",
      position: 2,
    });
    expect(da.bodyHtml).toContain("endnu ikke et booket bord");

    const en = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      position: 2,
    });
    expect(en.bodyHtml).toContain("do not yet have a booked table");
  });

  it("includes recipient name in greeting", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna Jensen",
      recipientEmail: "anna@example.com",
      language: "da",
      position: 1,
    });
    expect(result.bodyHtml).toContain("Anna Jensen");
  });

  it("includes the position number", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      position: 7,
    });
    expect(result.bodyHtml).toContain("#7");
    expect(result.bodyHtml).toContain("number 7");
  });

  it("uses dedicated wording for position 1", () => {
    const da = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "da",
      position: 1,
    });
    expect(da.bodyHtml).toContain("nummer 1");
    expect(da.bodyHtml).toContain("først i køen");

    const en = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      position: 1,
    });
    expect(en.bodyHtml).toContain("number 1");
    expect(en.bodyHtml).toContain("first in line");
  });

  it("escapes HTML in recipient name", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: '<script>alert("xss")</script>',
      recipientEmail: "x@y.com",
      language: "en",
      position: 1,
    });
    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });

  it("wraps with branded header and footer", () => {
    const result = buildWaitlistJoinConfirmationEmail({
      recipientName: "Anna",
      recipientEmail: "anna@example.com",
      language: "en",
      position: 2,
    });
    expect(result.bodyHtml).toContain("UN17 Village Loppemarked");
    expect(result.bodyHtml).toContain("#8DA88D");
    expect(result.bodyHtml).toContain("Fælledhuset");
  });

  it("sets html lang attribute matching language", () => {
    const da = buildWaitlistJoinConfirmationEmail({
      recipientName: "X",
      recipientEmail: "x@y.com",
      language: "da",
      position: 2,
    });
    expect(da.bodyHtml).toContain('lang="da"');

    const en = buildWaitlistJoinConfirmationEmail({
      recipientName: "X",
      recipientEmail: "x@y.com",
      language: "en",
      position: 2,
    });
    expect(en.bodyHtml).toContain('lang="en"');
  });
});

interface DbStubOptions {
  downstream: Array<{ id: string; name: string; email: string; language: string }>;
  aboveCount: number;
}

function makeStubDb(opts: DbStubOptions): Kysely<Database> {
  function buildSelectChain(): unknown {
    const downstreamOrder: { execute: ReturnType<typeof vi.fn>; orderBy?: () => unknown } = {
      execute: vi.fn().mockResolvedValue(opts.downstream),
    };
    downstreamOrder.orderBy = vi.fn().mockReturnValue(downstreamOrder);

    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue(downstreamOrder),
            executeTakeFirstOrThrow: vi
              .fn()
              .mockResolvedValue({ count: opts.aboveCount }),
          }),
        }),
      }),
    };
  }

  return {
    selectFrom: vi.fn().mockImplementation(() => buildSelectChain()),
    fn: {
      countAll: () => ({ as: (alias: string) => alias }),
    },
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([{ id: "email-id" }]),
          }),
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      };
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

describe("notifyDownstreamWaitlist", () => {
  beforeEach(async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    vi.mocked(queueAndSendEmail).mockClear();
    vi.mocked(queueAndSendEmail).mockResolvedValue("email-id");
  });

  it("returns zero-attempt result when no downstream entries exist", async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    const db = makeStubDb({ downstream: [], aboveCount: 0 });

    const result = await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-removed" },
    );

    expect(result.attempted).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(queueAndSendEmail).not.toHaveBeenCalled();
  });

  it("sends an email per downstream entry with sequential positions starting after the above count", async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    const db = makeStubDb({
      downstream: [
        { id: "w-a", name: "Alice", email: "alice@x.com", language: "da" },
        { id: "w-b", name: "Bob", email: "bob@x.com", language: "en" },
        { id: "w-c", name: "Carol", email: "carol@x.com", language: "da" },
      ],
      aboveCount: 2,
    });

    const result = await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_assign", entityId: "wl-assigned" },
    );

    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(queueAndSendEmail).toHaveBeenCalledTimes(3);

    const calls = vi.mocked(queueAndSendEmail).mock.calls;

    expect(calls[0][1].recipientEmail).toBe("alice@x.com");
    expect(calls[0][1].language).toBe("da");
    expect(calls[0][1].bodyHtml).toContain("#3");

    expect(calls[1][1].recipientEmail).toBe("bob@x.com");
    expect(calls[1][1].language).toBe("en");
    expect(calls[1][1].bodyHtml).toContain("#4");

    expect(calls[2][1].recipientEmail).toBe("carol@x.com");
    expect(calls[2][1].language).toBe("da");
    expect(calls[2][1].bodyHtml).toContain("#5");
  });

  it("counts failed sends without throwing", async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    vi.mocked(queueAndSendEmail)
      .mockResolvedValueOnce("ok-1")
      .mockRejectedValueOnce(new Error("ses down"))
      .mockResolvedValueOnce(null);

    const db = makeStubDb({
      downstream: [
        { id: "w-a", name: "A", email: "a@x.com", language: "da" },
        { id: "w-b", name: "B", email: "b@x.com", language: "da" },
        { id: "w-c", name: "C", email: "c@x.com", language: "da" },
      ],
      aboveCount: 0,
    });

    const result = await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-1" },
    );

    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(2);
  });

  it("falls back to da language when entry language is unrecognized", async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    const db = makeStubDb({
      downstream: [
        { id: "w-a", name: "Alice", email: "alice@x.com", language: "fr" },
      ],
      aboveCount: 0,
    });

    await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-1" },
    );

    const calls = vi.mocked(queueAndSendEmail).mock.calls;
    expect(calls[0][1].language).toBe("da");
  });

  it("logs an audit event summarizing the notification batch", async () => {
    const db = makeStubDb({
      downstream: [
        { id: "w-a", name: "Alice", email: "alice@x.com", language: "da" },
      ],
      aboveCount: 1,
    });

    await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-1" },
    );

    const insertCalls = vi.mocked(db.insertInto).mock.calls;
    const auditCalls = insertCalls.filter((c) => c[0] === "audit_events");
    expect(auditCalls.length).toBeGreaterThan(0);
  });

  it("queries downstream entries with an inclusive created_at bound and a deterministic id tiebreaker", async () => {
    const orderByMock = vi.fn().mockReturnThis();
    const whereMock = vi.fn().mockReturnThis();
    const executeMock = vi.fn().mockResolvedValue([]);
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      where: whereMock,
      orderBy: orderByMock,
      execute: executeMock,
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: 0 }),
    };

    const db = {
      selectFrom: vi.fn().mockReturnValue(queryBuilder),
      fn: { countAll: () => ({ as: () => "count" }) },
      insertInto: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      })),
    } as unknown as Kysely<Database>;

    await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-1" },
    );

    const downstreamWhereCalls = whereMock.mock.calls.filter(
      (call) => call[0] === "created_at",
    );
    expect(downstreamWhereCalls).toContainEqual(
      expect.arrayContaining(["created_at", ">=", expect.any(Date)]),
    );

    expect(orderByMock).toHaveBeenCalledWith("created_at", "asc");
    expect(orderByMock).toHaveBeenCalledWith("id", "asc");
  });

  it("returns zero-result counts and does not throw when the initial query fails", async () => {
    const { queueAndSendEmail } = await import("./email-service.js");
    const db = {
      selectFrom: vi.fn().mockImplementation(() => {
        throw new Error("database unavailable");
      }),
      fn: { countAll: () => ({ as: () => "count" }) },
      insertInto: vi.fn(),
    } as unknown as Kysely<Database>;

    const result = await notifyDownstreamWaitlist(
      db,
      "admin-1",
      new Date("2026-01-01T00:00:00Z"),
      { triggerAction: "waitlist_remove", entityId: "wl-1" },
    );

    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(queueAndSendEmail).not.toHaveBeenCalled();
  });
});
