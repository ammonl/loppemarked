import { describe, expect, it, vi } from "vitest";
import { getTableCatalog, createRouter, handler } from "./index.js";

vi.mock("./lib/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/session.js")>();
  return {
    ...actual,
    deleteExpiredSessions: vi.fn().mockResolvedValue(5),
  };
});

vi.mock("./db/connection.js", () => ({
  createDatabase: vi.fn().mockReturnValue({}),
}));

describe("api", () => {
  it("returns the table catalog", () => {
    const catalog = getTableCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]).toHaveProperty("id");
    expect(catalog[0]).toHaveProperty("number");
  });

  it("createRouter returns a router with routes registered", () => {
    const router = createRouter();
    expect(router).toBeDefined();
  });
});

describe("handler", () => {
  it("runs session cleanup for EventBridge scheduled events", async () => {
    const event = {
      source: "aws.events",
      "detail-type": "Scheduled Event",
      detail: {},
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.task).toBe("session-cleanup");
    expect(body.deletedSessions).toBe(5);
  });

  it("routes HTTP events normally", async () => {
    const event = {
      httpMethod: "GET",
      path: "/health",
      headers: {},
      body: null,
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });
});
