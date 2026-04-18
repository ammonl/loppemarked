import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { buildOpsNotificationEmail, notifyAdmins, type AdminOpsEvent } from "./admin-ops-notifications.js";

vi.mock("./email-service.js", () => ({
  queueAndSendEmail: vi.fn().mockResolvedValue("email-1"),
}));

vi.mock("./logger.js", () => ({
  logger: { error: vi.fn() },
}));

import { queueAndSendEmail } from "./email-service.js";

describe("buildOpsNotificationEmail", () => {
  it("builds user registration email", () => {
    const result = buildOpsNotificationEmail({
      event: {
        type: "user_registration",
        userName: "Alice",
        userEmail: "alice@test.com",
        boxId: 1,
      },
    });

    expect(result.subject).toContain("Alice");
    expect(result.subject).toContain("Table #1");
    expect(result.bodyHtml).toContain("alice@test.com");
    expect(result.bodyHtml).toContain("booked");
    expect(result.bodyHtml).toContain("Table #1");
  });

  it("builds user switch email", () => {
    const result = buildOpsNotificationEmail({
      event: {
        type: "user_switch",
        userName: "Bob",
        userEmail: "bob@test.com",
        oldBoxId: 1,
        newBoxId: 2,
      },
    });

    expect(result.subject).toContain("switch");
    expect(result.subject).toContain("Table #1");
    expect(result.subject).toContain("Table #2");
    expect(result.bodyHtml).toContain("switched");
    expect(result.bodyHtml).toContain("Table #1");
    expect(result.bodyHtml).toContain("Table #2");
  });

  it("builds admin table reserve email with admin email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_box_reserve",
        actingAdminId: "admin-1",
        boxId: 5,
      },
    });

    expect(result.subject).toContain("reserved");
    expect(result.subject).toContain("Table #5");
    expect(result.bodyHtml).toContain("admin@test.com");
    expect(result.bodyHtml).toContain("Table #5");
  });

  it("builds admin table release email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_box_release",
        actingAdminId: "admin-1",
        boxId: 5,
      },
    });

    expect(result.subject).toContain("released");
    expect(result.subject).toContain("Table #5");
  });

  it("builds admin booking create email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_registration_create",
        actingAdminId: "admin-1",
        userName: "Alice",
        boxId: 3,
      },
    });

    expect(result.subject).toContain("Booking added");
    expect(result.subject).toContain("Table #3");
    expect(result.bodyHtml).toContain("Alice");
    expect(result.bodyHtml).toContain("Table #3");
  });

  it("builds admin booking move email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_registration_move",
        actingAdminId: "admin-1",
        userName: "Bob",
        oldBoxId: 1,
        newBoxId: 2,
      },
    });

    expect(result.subject).toContain("moved");
    expect(result.subject).toContain("Table #1");
    expect(result.subject).toContain("Table #2");
    expect(result.bodyHtml).toContain("Bob");
    expect(result.bodyHtml).toContain("Table #1");
    expect(result.bodyHtml).toContain("Table #2");
  });

  it("builds admin booking remove email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_registration_remove",
        actingAdminId: "admin-1",
        userName: "Carol",
        boxId: 4,
      },
    });

    expect(result.subject).toContain("removed");
    expect(result.subject).toContain("Table #4");
    expect(result.bodyHtml).toContain("Carol");
    expect(result.bodyHtml).toContain("Table #4");
  });

  it("builds admin waitlist assign email", () => {
    const result = buildOpsNotificationEmail({
      actingAdminEmail: "admin@test.com",
      event: {
        type: "admin_waitlist_assign",
        actingAdminId: "admin-1",
        userName: "Dave",
        boxId: 7,
      },
    });

    expect(result.subject).toContain("Waitlist assigned");
    expect(result.subject).toContain("Table #7");
    expect(result.bodyHtml).toContain("Dave");
    expect(result.bodyHtml).toContain("Table #7");
  });

  it("uses fallback label for unknown table IDs", () => {
    const result = buildOpsNotificationEmail({
      event: {
        type: "user_registration",
        userName: "Alice",
        userEmail: "alice@test.com",
        boxId: 999,
      },
    });

    expect(result.subject).toContain("Table #999");
    expect(result.bodyHtml).toContain("Table #999");
  });

  it("escapes HTML in user-supplied values", () => {
    const result = buildOpsNotificationEmail({
      event: {
        type: "user_registration",
        userName: '<script>alert("xss")</script>',
        userEmail: "evil@test.com",
        boxId: 1,
      },
    });

    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });
});

describe("notifyAdmins", () => {
  function makeMockDb(
    admins: { id: string; email: string }[],
    preferences: { admin_id: string; notify_user_registration: boolean; notify_admin_box_action: boolean }[] = [],
    prefColumn: "notify_user_registration" | "notify_admin_box_action" = "notify_user_registration",
  ) {
    const prefMap = new Map(preferences.map((p) => [p.admin_id, p]));
    const joinedRows = admins.map((a) => {
      const pref = prefMap.get(a.id);
      return { id: a.id, email: a.email, pref: pref ? pref[prefColumn] : null };
    });

    const executeFn = vi.fn().mockResolvedValue(joinedRows);
    const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
    const leftJoinFn = vi.fn().mockReturnValue({ select: selectFn });
    const selectFromFn = vi.fn().mockReturnValue({ leftJoin: leftJoinFn });

    return { selectFrom: selectFromFn } as unknown as Kysely<Database>;
  }

  it("sends notification to all admins for user registration event when no preferences set", async () => {
    const mockQueueAndSend = vi.mocked(queueAndSendEmail);
    mockQueueAndSend.mockClear();

    const db = makeMockDb([
      { id: "admin-1", email: "admin1@test.com" },
      { id: "admin-2", email: "admin2@test.com" },
    ]);

    const event: AdminOpsEvent = {
      type: "user_registration",
      userName: "Alice",
      userEmail: "alice@test.com",
      boxId: 1,
    };

    await notifyAdmins(db, event);

    expect(mockQueueAndSend).toHaveBeenCalledTimes(2);
    expect(mockQueueAndSend).toHaveBeenCalledWith(db, expect.objectContaining({
      recipientEmail: "admin1@test.com",
      language: "en",
    }));
    expect(mockQueueAndSend).toHaveBeenCalledWith(db, expect.objectContaining({
      recipientEmail: "admin2@test.com",
    }));
  });

  it("skips admins who opted out of user registration notifications", async () => {
    const mockQueueAndSend = vi.mocked(queueAndSendEmail);
    mockQueueAndSend.mockClear();

    const db = makeMockDb(
      [
        { id: "admin-1", email: "admin1@test.com" },
        { id: "admin-2", email: "admin2@test.com" },
      ],
      [
        { admin_id: "admin-2", notify_user_registration: false, notify_admin_box_action: true },
      ],
    );

    await notifyAdmins(db, {
      type: "user_registration",
      userName: "Alice",
      userEmail: "alice@test.com",
      boxId: 1,
    });

    expect(mockQueueAndSend).toHaveBeenCalledTimes(1);
    expect(mockQueueAndSend).toHaveBeenCalledWith(db, expect.objectContaining({
      recipientEmail: "admin1@test.com",
    }));
  });

  it("does not notify acting admin about their own box action", async () => {
    const mockQueueAndSend = vi.mocked(queueAndSendEmail);
    mockQueueAndSend.mockClear();

    const db = makeMockDb([
      { id: "admin-1", email: "admin1@test.com" },
      { id: "admin-2", email: "admin2@test.com" },
    ], [], "notify_admin_box_action");

    await notifyAdmins(db, {
      type: "admin_box_reserve",
      actingAdminId: "admin-1",
      boxId: 5,
    });

    expect(mockQueueAndSend).toHaveBeenCalledTimes(1);
    expect(mockQueueAndSend).toHaveBeenCalledWith(db, expect.objectContaining({
      recipientEmail: "admin2@test.com",
    }));
  });

  it("skips admins who opted out of admin box action notifications", async () => {
    const mockQueueAndSend = vi.mocked(queueAndSendEmail);
    mockQueueAndSend.mockClear();

    const db = makeMockDb(
      [
        { id: "admin-1", email: "admin1@test.com" },
        { id: "admin-2", email: "admin2@test.com" },
        { id: "admin-3", email: "admin3@test.com" },
      ],
      [
        { admin_id: "admin-2", notify_user_registration: true, notify_admin_box_action: false },
      ],
      "notify_admin_box_action",
    );

    await notifyAdmins(db, {
      type: "admin_registration_create",
      actingAdminId: "admin-1",
      userName: "Alice",
      boxId: 3,
    });

    // admin-1 excluded (self), admin-2 excluded (opted out), admin-3 notified
    expect(mockQueueAndSend).toHaveBeenCalledTimes(1);
    expect(mockQueueAndSend).toHaveBeenCalledWith(db, expect.objectContaining({
      recipientEmail: "admin3@test.com",
    }));
  });

  it("sends no emails when all admins opted out", async () => {
    const mockQueueAndSend = vi.mocked(queueAndSendEmail);
    mockQueueAndSend.mockClear();

    const db = makeMockDb(
      [{ id: "admin-1", email: "admin1@test.com" }],
      [{ admin_id: "admin-1", notify_user_registration: false, notify_admin_box_action: false }],
    );

    await notifyAdmins(db, {
      type: "user_registration",
      userName: "Alice",
      userEmail: "alice@test.com",
      boxId: 1,
    });

    expect(mockQueueAndSend).not.toHaveBeenCalled();
  });

  it("does not throw on database error", async () => {
    const db = {
      selectFrom: vi.fn().mockImplementation(() => {
        throw new Error("DB failure");
      }),
    } as unknown as Kysely<Database>;

    await expect(notifyAdmins(db, {
      type: "user_registration",
      userName: "Alice",
      userEmail: "alice@test.com",
      boxId: 1,
    })).resolves.toBeUndefined();
  });
});
