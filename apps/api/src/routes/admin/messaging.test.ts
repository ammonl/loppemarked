import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { RequestContext } from "../../router.js";
import { AppError } from "../../lib/errors.js";
import {
  handleGetBulkEmailTemplate,
  handleBulkEmailPreview,
  handleGetRecipients,
  handleSendBulkEmail,
} from "./messaging.js";

vi.mock("../../lib/email-service.js", () => ({
  queueAndSendEmail: vi.fn().mockResolvedValue("email-mock-id"),
}));

vi.mock("../../lib/audit.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "POST",
    path: "/admin/messaging/recipients",
    body: undefined,
    headers: {},
    params: {},
    adminId: "admin-1",
    ...overrides,
  };
}

interface QueryMock {
  db: Kysely<Database>;
  orderByFn: ReturnType<typeof vi.fn>;
}

function buildQueryMockWithSpies(rows: unknown[]): QueryMock {
  const executeFn = vi.fn().mockResolvedValue(rows);

  const queryObj: Record<string, unknown> = {};
  queryObj.execute = executeFn;
  queryObj.where = vi.fn().mockReturnValue(queryObj);
  queryObj.select = vi.fn().mockReturnValue(queryObj);
  const orderByFn = vi.fn().mockReturnValue(queryObj);
  queryObj.orderBy = orderByFn;

  const selectFromFn = vi.fn().mockReturnValue(queryObj);
  return {
    db: { selectFrom: selectFromFn } as unknown as Kysely<Database>,
    orderByFn,
  };
}

function buildQueryMock(rows: unknown[]): Kysely<Database> {
  return buildQueryMockWithSpies(rows).db;
}

describe("handleGetBulkEmailTemplate", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleGetBulkEmailTemplate(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("returns Danish template by default", async () => {
    const result = await handleGetBulkEmailTemplate(makeCtx({ body: {} }));

    expect(result.statusCode).toBe(200);
    const body = result.body as { language: string; defaultBody: string };
    expect(body.language).toBe("da");
    expect(body.defaultBody).toContain("Kære beboer,");
  });

  it("returns English template when requested", async () => {
    const result = await handleGetBulkEmailTemplate(
      makeCtx({ body: { language: "en" } }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as { language: string; defaultBody: string };
    expect(body.language).toBe("en");
    expect(body.defaultBody).toContain("Dear resident,");
  });

  it("falls back to da for invalid language", async () => {
    const result = await handleGetBulkEmailTemplate(
      makeCtx({ body: { language: "fr" } }),
    );

    const body = result.body as { language: string };
    expect(body.language).toBe("da");
  });
});

describe("handleBulkEmailPreview", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleBulkEmailPreview(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when bodyHtml is missing", async () => {
    try {
      await handleBulkEmailPreview(makeCtx({ body: { subject: "Hi" } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns wrapped preview HTML", async () => {
    const result = await handleBulkEmailPreview(
      makeCtx({ body: { bodyHtml: "<p>Hello</p>", subject: "Test", language: "en" } }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as { previewHtml: string };
    expect(body.previewHtml).toContain("<!DOCTYPE html>");
    expect(body.previewHtml).toContain('lang="en"');
    expect(body.previewHtml).toContain("<p>Hello</p>");
    expect(body.previewHtml).toContain("UN17 Village Loppemarked");
  });
});

describe("handleGetRecipients", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleGetRecipients(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when audience is missing", async () => {
    try {
      await handleGetRecipients(makeCtx({ body: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when audience is invalid", async () => {
    try {
      await handleGetRecipients(makeCtx({ body: { audience: "invalid" } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns recipients for 'all' audience", async () => {
    const mockRows = [
      { email: "alice@test.com", name: "Alice", language: "da" },
      { email: "bob@test.com", name: "Bob", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleGetRecipients(
      makeCtx({ db: mockDb, body: { audience: "all" } }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as { audience: string; count: number; recipients: unknown[] };
    expect(body.audience).toBe("all");
    expect(body.count).toBe(2);
    expect(body.recipients).toHaveLength(2);
  });

  it("deduplicates recipients by email", async () => {
    const mockRows = [
      { email: "alice@test.com", name: "Alice", language: "da" },
      { email: "Alice@test.com", name: "Alice", language: "da" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleGetRecipients(
      makeCtx({ db: mockDb, body: { audience: "all" } }),
    );

    const body = result.body as { count: number };
    expect(body.count).toBe(1);
  });

  it("rejects unknown audience values", async () => {
    try {
      await handleGetRecipients(
        makeCtx({ body: { audience: "kronen" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns active Danish registrations alongside English ones", async () => {
    const mockRows = [
      { email: "self-da@test.com", name: "Self DA", language: "da" },
      { email: "admin-da@test.com", name: "Admin DA", language: "da" },
      { email: "english@test.com", name: "English", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleGetRecipients(
      makeCtx({ db: mockDb, body: { audience: "all" } }),
    );

    const body = result.body as {
      count: number;
      recipients: { email: string; language: string }[];
    };
    expect(body.count).toBe(3);
    expect(body.recipients.filter((r) => r.language === "da")).toHaveLength(2);
    expect(body.recipients.filter((r) => r.language === "en")).toHaveLength(1);
  });

  it("includes every active-table participant regardless of language", async () => {
    const mockRows = [
      { email: "en-1@test.com", name: "EN One", language: "en" },
      { email: "da-1@test.com", name: "DA One", language: "da" },
      { email: "en-2@test.com", name: "EN Two", language: "en" },
      { email: "da-2@test.com", name: "DA Two", language: "da" },
      { email: "en-3@test.com", name: "EN Three", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleGetRecipients(
      makeCtx({ db: mockDb, body: { audience: "all" } }),
    );

    const body = result.body as {
      count: number;
      recipients: { email: string; language: string }[];
    };
    expect(body.count).toBe(5);
    const englishEmails = body.recipients
      .filter((r) => r.language === "en")
      .map((r) => r.email)
      .sort();
    expect(englishEmails).toEqual([
      "en-1@test.com",
      "en-2@test.com",
      "en-3@test.com",
    ]);
    const danishEmails = body.recipients
      .filter((r) => r.language === "da")
      .map((r) => r.email)
      .sort();
    expect(danishEmails).toEqual(["da-1@test.com", "da-2@test.com"]);
  });

  it("requests a deterministic ordering with a stable id tie-breaker", async () => {
    const { db, orderByFn } = buildQueryMockWithSpies([
      { email: "a@test.com", name: "A", language: "en" },
    ]);

    await handleGetRecipients(makeCtx({ db, body: { audience: "all" } }));

    expect(orderByFn).toHaveBeenNthCalledWith(1, "created_at", "desc");
    expect(orderByFn).toHaveBeenNthCalledWith(2, "id", "desc");
  });

  it("dedups duplicate emails by keeping the most recent active row", async () => {
    // queryRecipients orders by created_at desc, so the newer "en"
    // registration is returned first and wins the dedup over an older
    // active "da" row sharing the same email.
    const mockRows = [
      { email: "user@test.com", name: "User", language: "en" },
      { email: "user@test.com", name: "User", language: "da" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleGetRecipients(
      makeCtx({ db: mockDb, body: { audience: "all" } }),
    );

    const body = result.body as {
      count: number;
      recipients: { language: string }[];
    };
    expect(body.count).toBe(1);
    expect(body.recipients[0].language).toBe("en");
  });
});

describe("handleSendBulkEmail", () => {
  it("throws 401 when adminId is missing", async () => {
    try {
      await handleSendBulkEmail(makeCtx({ adminId: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws 400 when audience is missing", async () => {
    try {
      await handleSendBulkEmail(makeCtx({ body: { subject: "Hi", bodyHtml: "<p>Hi</p>" } }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when subject is missing", async () => {
    try {
      await handleSendBulkEmail(
        makeCtx({ body: { audience: "all", bodyHtml: "<p>Hi</p>" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when bodyHtml is missing", async () => {
    try {
      await handleSendBulkEmail(
        makeCtx({ body: { audience: "all", subject: "Hi" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when no recipients found", async () => {
    const mockDb = buildQueryMock([]);

    try {
      await handleSendBulkEmail(
        makeCtx({
          db: mockDb,
          body: { audience: "all", subject: "Test", bodyHtml: "<p>Test</p>" },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("sends wrapped emails to all recipients and returns counts", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockQueueFn = vi.mocked(queueAndSendEmail);
    mockQueueFn.mockClear();

    const mockRows = [
      { email: "alice@test.com", name: "Alice", language: "da" },
      { email: "bob@test.com", name: "Bob", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleSendBulkEmail(
      makeCtx({
        db: mockDb,
        body: { audience: "all", subject: "Newsletter", bodyHtml: "<p>Hello!</p>" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as {
      audience: string;
      recipientCount: number;
      queuedCount: number;
      queueFailedCount: number;
    };
    expect(body.audience).toBe("all");
    expect(body.recipientCount).toBe(2);
    expect(body.queuedCount).toBe(2);
    expect(body.queueFailedCount).toBe(0);

    const aliceCall = mockQueueFn.mock.calls.find(
      (c) => c[1].recipientEmail === "alice@test.com",
    );
    expect(aliceCall![1].bodyHtml).toContain("<!DOCTYPE html>");
    expect(aliceCall![1].bodyHtml).toContain('lang="da"');
    expect(aliceCall![1].bodyHtml).toContain("<p>Hello!</p>");

    const bobCall = mockQueueFn.mock.calls.find(
      (c) => c[1].recipientEmail === "bob@test.com",
    );
    expect(bobCall![1].bodyHtml).toContain("<!DOCTYPE html>");
    expect(bobCall![1].bodyHtml).toContain('lang="en"');
    expect(bobCall![1].bodyHtml).toContain("<p>Hello!</p>");
  });

  it("handles partial queue failures", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockQueueFn = vi.mocked(queueAndSendEmail);
    mockQueueFn.mockClear();
    mockQueueFn.mockResolvedValueOnce("email-1");
    mockQueueFn.mockResolvedValueOnce(null);

    const mockRows = [
      { email: "alice@test.com", name: "Alice", language: "da" },
      { email: "bob@test.com", name: "Bob", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleSendBulkEmail(
      makeCtx({
        db: mockDb,
        body: { audience: "all", subject: "Test", bodyHtml: "<p>Test</p>" },
      }),
    );

    const body = result.body as { queuedCount: number; queueFailedCount: number };
    expect(body.queuedCount).toBe(1);
    expect(body.queueFailedCount).toBe(1);
  });

  it("throws 400 when bilingual subjectDa is missing", async () => {
    try {
      await handleSendBulkEmail(
        makeCtx({
          body: {
            audience: "all",
            bilingual: true,
            bodyHtmlDa: "<p>Da</p>",
            subjectEn: "En",
            bodyHtmlEn: "<p>En</p>",
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 400 when bilingual bodyHtmlEn is missing", async () => {
    try {
      await handleSendBulkEmail(
        makeCtx({
          body: {
            audience: "all",
            bilingual: true,
            subjectDa: "Da",
            bodyHtmlDa: "<p>Da</p>",
            subjectEn: "En",
          },
        }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("sends wrapped language-specific content in bilingual mode", async () => {
    const { queueAndSendEmail } = await import("../../lib/email-service.js");
    const mockQueueFn = vi.mocked(queueAndSendEmail);
    mockQueueFn.mockClear();
    mockQueueFn.mockResolvedValue("email-mock-id");

    const mockRows = [
      { email: "alice@test.com", name: "Alice", language: "da" },
      { email: "bob@test.com", name: "Bob", language: "en" },
    ];
    const mockDb = buildQueryMock(mockRows);

    const result = await handleSendBulkEmail(
      makeCtx({
        db: mockDb,
        body: {
          audience: "all",
          bilingual: true,
          subjectDa: "Dansk emne",
          bodyHtmlDa: "<p>Dansk</p>",
          subjectEn: "English subject",
          bodyHtmlEn: "<p>English</p>",
        },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as { recipientCount: number; queuedCount: number };
    expect(body.recipientCount).toBe(2);
    expect(body.queuedCount).toBe(2);

    const aliceCall = mockQueueFn.mock.calls.find(
      (c) => c[1].recipientEmail === "alice@test.com",
    );
    expect(aliceCall).toBeDefined();
    expect(aliceCall![1].subject).toBe("Dansk emne");
    expect(aliceCall![1].bodyHtml).toContain("<!DOCTYPE html>");
    expect(aliceCall![1].bodyHtml).toContain('lang="da"');
    expect(aliceCall![1].bodyHtml).toContain("<p>Dansk</p>");
    expect(aliceCall![1].language).toBe("da");

    const bobCall = mockQueueFn.mock.calls.find(
      (c) => c[1].recipientEmail === "bob@test.com",
    );
    expect(bobCall).toBeDefined();
    expect(bobCall![1].subject).toBe("English subject");
    expect(bobCall![1].bodyHtml).toContain("<!DOCTYPE html>");
    expect(bobCall![1].bodyHtml).toContain('lang="en"');
    expect(bobCall![1].bodyHtml).toContain("<p>English</p>");
    expect(bobCall![1].language).toBe("en");
  });
});
