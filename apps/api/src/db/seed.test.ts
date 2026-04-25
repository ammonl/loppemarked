import { describe, expect, it } from "vitest";
import {
  SEED_ADMIN_EMAILS,
  TOTAL_TABLE_COUNT,
  VISIBLE_TABLE_IDS,
} from "@loppemarked/shared";

import { getTableRows, getAdminEmails } from "./seed.js";

describe("seed data", () => {
  describe("getTableRows", () => {
    const rows = getTableRows();

    it("returns one row per visible table", () => {
      expect(rows).toHaveLength(TOTAL_TABLE_COUNT);
    });

    it("uses the visible catalog ids", () => {
      const ids = rows.map((r) => r.id);
      expect(ids).toEqual([...VISIBLE_TABLE_IDS]);
    });

    it("seeds every table in the available state", () => {
      for (const row of rows) {
        expect(row.state).toBe("available");
      }
    });
  });

  describe("getAdminEmails", () => {
    it("returns the configured seed admin emails", () => {
      const emails = getAdminEmails();
      expect(emails).toEqual(SEED_ADMIN_EMAILS);
      expect(emails).toHaveLength(1);
    });

    it("contains valid email addresses", () => {
      for (const email of getAdminEmails()) {
        expect(email).toMatch(/.+@.+\..+/);
      }
    });
  });
});
