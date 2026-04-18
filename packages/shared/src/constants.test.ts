import { describe, expect, it } from "vitest";
import {
  BOX_CATALOG,
  GREENHOUSES,
  KRONEN_BOX_RANGE,
  SOEN_BOX_RANGE,
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  TOTAL_BOX_COUNT,
  FLOOR_DOOR_REQUIRED_NUMBERS,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  SEED_ADMIN_EMAILS,
  getTableById,
} from "./constants.js";

describe("GREENHOUSES", () => {
  it("contains exactly Kronen and Søen", () => {
    expect(GREENHOUSES).toEqual(["Kronen", "Søen"]);
  });
});

describe("BOX_CATALOG", () => {
  it("has 29 entries", () => {
    expect(BOX_CATALOG).toHaveLength(TOTAL_BOX_COUNT);
  });

  it("has sequential IDs from 1 to 29", () => {
    const ids = BOX_CATALOG.map((b) => b.id);
    expect(ids).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
  });

  it("assigns Kronen boxes to IDs 1-14", () => {
    const kronenBoxes = BOX_CATALOG.filter((b) => b.greenhouse === "Kronen");
    expect(kronenBoxes).toHaveLength(14);
    kronenBoxes.forEach((b) => {
      expect(b.id).toBeGreaterThanOrEqual(KRONEN_BOX_RANGE.start);
      expect(b.id).toBeLessThanOrEqual(KRONEN_BOX_RANGE.end);
    });
  });

  it("assigns Søen boxes to IDs 15-29", () => {
    const soenBoxes = BOX_CATALOG.filter((b) => b.greenhouse === "Søen");
    expect(soenBoxes).toHaveLength(15);
    soenBoxes.forEach((b) => {
      expect(b.id).toBeGreaterThanOrEqual(SOEN_BOX_RANGE.start);
      expect(b.id).toBeLessThanOrEqual(SOEN_BOX_RANGE.end);
    });
  });

  it("has unique names", () => {
    const names = BOX_CATALOG.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("starts with Linaria and ends with Black bird", () => {
    expect(BOX_CATALOG[0].name).toBe("Linaria");
    expect(BOX_CATALOG[28].name).toBe("Black bird");
  });
});

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
  it("has two seed admin emails", () => {
    expect(SEED_ADMIN_EMAILS).toEqual([
      "ammonl@hotmail.com",
    ]);
  });
});

describe("TABLE_CATALOG", () => {
  it("has one entry per planter box", () => {
    expect(TABLE_CATALOG).toHaveLength(TOTAL_BOX_COUNT);
  });

  it("numbers tables 1-29 matching id", () => {
    TABLE_CATALOG.forEach((t, i) => {
      expect(t.id).toBe(i + 1);
      expect(t.number).toBe(i + 1);
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

  it("assigns positive sizes and prices", () => {
    for (const table of TABLE_CATALOG) {
      expect(table.sizeMeters).toBeGreaterThan(0);
      expect(table.priceDkk).toBeGreaterThan(0);
      expect(table.width).toBeGreaterThan(0);
      expect(table.height).toBeGreaterThan(0);
    }
  });

  it("resolves by id via getTableById", () => {
    expect(getTableById(1)?.number).toBe(1);
    expect(getTableById(29)?.number).toBe(29);
    expect(getTableById(999)).toBeUndefined();
  });
});
