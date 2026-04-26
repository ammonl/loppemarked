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
  formatTableSize,
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

  it("uses contiguous ids 1..23 after the right-wall renumbering", () => {
    const ids = TABLE_CATALOG.map((t) => t.id);
    const expected = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ];
    expect(ids).toEqual(expected);
    expect(VISIBLE_TABLE_IDS).toEqual(expected);
    TABLE_CATALOG.forEach((t) => {
      expect(t.number).toBe(t.id);
    });
  });

  it("matches the on-site table inventory totals", () => {
    const counts = new Map<string, number>();
    for (const table of TABLE_CATALOG) {
      const key = `${table.widthCm}x${table.lengthCm}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.get("80x180")).toBe(13);
    expect(counts.get("60x140")).toBe(2);
    expect(counts.get("75x150")).toBe(2);
    expect(counts.get("150x135")).toBe(2);
    expect(counts.get("80x80")).toBe(1);
    expect(counts.get("60x110")).toBe(1);
    expect(counts.get("60x120")).toBe(1);
    expect(counts.get("75x180")).toBe(1);
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

  it("assigns positive dimensions", () => {
    for (const table of TABLE_CATALOG) {
      expect(table.widthCm).toBeGreaterThan(0);
      expect(table.lengthCm).toBeGreaterThan(0);
      expect(table.width).toBeGreaterThan(0);
      expect(table.height).toBeGreaterThan(0);
    }
  });

  it("resolves by id via getTableById", () => {
    expect(getTableById(1)?.number).toBe(1);
    expect(getTableById(22)?.number).toBe(22);
    expect(getTableById(23)?.number).toBe(23);
    expect(getTableById(24)).toBeUndefined();
    expect(getTableById(999)).toBeUndefined();
  });
});

describe("formatTableSize", () => {
  it("renders a width × length cm label", () => {
    expect(formatTableSize({ widthCm: 80, lengthCm: 180 })).toBe("80x180 cm");
    expect(formatTableSize({ widthCm: 60, lengthCm: 140 })).toBe("60x140 cm");
  });
});

describe("formatTableLabel", () => {
  it("renders a short label by default", () => {
    expect(formatTableLabel(1)).toBe("Table #1");
    expect(formatTableLabel(23)).toBe("Table #23");
  });

  it("renders size when details requested", () => {
    expect(formatTableLabel(1, { includeDetails: true })).toBe("Table #1 · 60x140 cm");
    expect(formatTableLabel(2, { includeDetails: true })).toBe("Table #2 · 80x180 cm");
    expect(formatTableLabel(23, { includeDetails: true })).toBe("Table #23 · 80x180 cm");
  });

  it("falls back to the raw id for unknown tables", () => {
    expect(formatTableLabel(999)).toBe("Table #999");
    expect(formatTableLabel(999, { includeDetails: true })).toBe("Table #999");
  });
});
