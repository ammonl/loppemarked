import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCancellationUrl,
  generateCancellationToken,
  getPublicWebBaseUrl,
  hashCancellationToken,
} from "./cancellation-tokens.js";

describe("generateCancellationToken", () => {
  it("produces a unique url-safe token on each call", () => {
    const a = generateCancellationToken();
    const b = generateCancellationToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("hashCancellationToken", () => {
  it("is deterministic for the same input", () => {
    const token = "example-token-123";
    expect(hashCancellationToken(token)).toBe(hashCancellationToken(token));
  });

  it("produces a 64-char hex SHA-256 digest", () => {
    const hash = hashCancellationToken("whatever");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different tokens", () => {
    expect(hashCancellationToken("a")).not.toBe(hashCancellationToken("b"));
  });

  it("does not expose the original token", () => {
    const token = "secret-value";
    const hash = hashCancellationToken(token);
    expect(hash).not.toContain(token);
  });
});

describe("buildCancellationUrl", () => {
  it("appends /cancel?token= with the encoded token", () => {
    const url = buildCancellationUrl("https://example.test", "abc123");
    expect(url).toBe("https://example.test/cancel?token=abc123");
  });

  it("strips trailing slashes from the base URL", () => {
    const url = buildCancellationUrl("https://example.test///", "abc");
    expect(url).toBe("https://example.test/cancel?token=abc");
  });

  it("URL-encodes special characters in the token", () => {
    const url = buildCancellationUrl("https://example.test", "a b/c?d");
    expect(url).toBe("https://example.test/cancel?token=a%20b%2Fc%3Fd");
  });
});

describe("getPublicWebBaseUrl", () => {
  const originalPublicWebUrl = process.env["PUBLIC_WEB_URL"];

  beforeEach(() => {
    delete process.env["PUBLIC_WEB_URL"];
  });

  afterEach(() => {
    if (originalPublicWebUrl === undefined) delete process.env["PUBLIC_WEB_URL"];
    else process.env["PUBLIC_WEB_URL"] = originalPublicWebUrl;
  });

  it("returns PUBLIC_WEB_URL when set", () => {
    process.env["PUBLIC_WEB_URL"] = "https://loppemarked.staging.un17hub.com";
    expect(getPublicWebBaseUrl()).toBe("https://loppemarked.staging.un17hub.com");
  });

  it("ignores an empty PUBLIC_WEB_URL and falls back to localhost", () => {
    process.env["PUBLIC_WEB_URL"] = "";
    expect(getPublicWebBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to localhost when PUBLIC_WEB_URL is unset", () => {
    expect(getPublicWebBaseUrl()).toBe("http://localhost:3000");
  });
});
