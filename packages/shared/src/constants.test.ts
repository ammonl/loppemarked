import { describe, expect, it } from "vitest";
import {
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  TOTAL_TABLE_COUNT,
  VISIBLE_TABLE_IDS,
  FLOOR_DOOR_REQUIRED_NUMBERS,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  SEED_ADMIN_EMAILS,
  EVENT_CONTACT,
  getTableById,
  formatTableLabel,
} from "./constants.js";

describe("FLOOR_DOOR_REQUIRED_NUMBERS", () => {
  it("includes 138 and 144", () => {
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).toContain(138);
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).toContain(144);
  });

  it("includes all numbers 161-202", () => {
    for (let n = 161; n <= 202; n++) {
      expect(FLOOR_DOOR_REQUIRED_NUMBERS).toContain(n);
    }
  });

  it("does not include numbers that should not require floor/door", () => {
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).not.toContain(122);
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).not.toContain(130);
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).not.toContain(139);
    expect(FLOOR_DOOR_REQUIRED_NUMBERS).not.toContain(160);
  });
});

describe("address constants", () => {
  it("has correct house number range", () => {
    expect(HOUSE_NUMBER_MIN).toBe(122);
    expect(HOUSE_NUMBER_MAX).toBe(202);
  });
});

describe("seed data", () => {
  it("has the seed admin emails", () => {
    expect(SEED_ADMIN_EMAILS).toEqual([
      "ammonl@hotmail.com",
    ]);
  });
});

describe("EVENT_CONTACT", () => {
  it("exposes Ammon Larson as the primary event contact", () => {
    expect(EVENT_CONTACT).toEqual({
      name: "Ammon Larson",
      email: "ammonl@hotmail.com",
    });
  });
});

describe("TABLE_CATALOG", () => {
  it("matches the published Fælledhuset map (23 visible tables)", () => {
    expect(TABLE_CATALOG).toHaveLength(23);
    expect(TOTAL_TABLE_COUNT).toBe(23);
  });

  it("uses ids matching the reference numbering, with a deliberate gap at 22", () => {
    const ids = TABLE_CATALOG.map((t) => t.id);
    const expected = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24,
    ];
    expect(ids).toEqual(expected);
    expect(VISIBLE_TABLE_IDS).toEqual(expected);
    TABLE_CATALOG.forEach((t) => {
      expect(t.number).toBe(t.id);
    });
  });

  it("positions every table within the hall viewBox", () => {
    const { width, height } = TABLE_MAP_VIEWBOX;
    for (const table of TABLE_CATALOG) {
      expect(table.x).toBeGreaterThanOrEqual(0);
      expect(table.y).toBeGreaterThanOrEqual(0);
      expect(table.x + table.width).toBeLessThanOrEqual(width);
      expect(table.y + table.height).toBeLessThanOrEqual(height);
    }
  });

  it("assigns positive sizes", () => {
    for (const table of TABLE_CATALOG) {
      expect(table.sizeMeters).toBeGreaterThan(0);
      expect(table.width).toBeGreaterThan(0);
      expect(table.height).toBeGreaterThan(0);
    }
  });

  it("resolves by id via getTableById", () => {
    expect(getTableById(1)?.number).toBe(1);
    expect(getTableById(24)?.number).toBe(24);
    expect(getTableById(22)).toBeUndefined();
    expect(getTableById(999)).toBeUndefined();
  });
});

describe("formatTableLabel", () => {
  it("renders a short label by default", () => {
    expect(formatTableLabel(1)).toBe("Table #1");
    expect(formatTableLabel(24)).toBe("Table #24");
  });

  it("renders size when details requested", () => {
    expect(formatTableLabel(1, { includeDetails: true })).toBe("Table #1 · 2 m");
    expect(formatTableLabel(23, { includeDetails: true })).toBe("Table #23 · 2 m");
  });

  it("falls back to the raw id for unknown tables", () => {
    expect(formatTableLabel(999)).toBe("Table #999");
    expect(formatTableLabel(999, { includeDetails: true })).toBe("Table #999");
  });
});
