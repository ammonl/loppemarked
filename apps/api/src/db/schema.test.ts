import { describe, expect, it } from "vitest";
import * as initial from "./migrations/001_initial_schema.js";
import * as renumber from "./migrations/002_renumber_tables.js";
import * as extend24 from "./migrations/003_extend_to_24_tables.js";

describe("initial schema migration", () => {
  it("exports up function", () => {
    expect(typeof initial.up).toBe("function");
  });

  it("exports down function", () => {
    expect(typeof initial.down).toBe("function");
  });
});

describe("renumber tables migration", () => {
  it("exports up function", () => {
    expect(typeof renumber.up).toBe("function");
  });

  it("exports down function", () => {
    expect(typeof renumber.down).toBe("function");
  });
});

describe("extend to 24 tables migration", () => {
  it("exports up function", () => {
    expect(typeof extend24.up).toBe("function");
  });

  it("exports down function", () => {
    expect(typeof extend24.down).toBe("function");
  });
});

describe("migration structure", () => {
  it("up and down are async functions", () => {
    expect(initial.up.constructor.name).toBe("AsyncFunction");
    expect(initial.down.constructor.name).toBe("AsyncFunction");
    expect(renumber.up.constructor.name).toBe("AsyncFunction");
    expect(renumber.down.constructor.name).toBe("AsyncFunction");
    expect(extend24.up.constructor.name).toBe("AsyncFunction");
    expect(extend24.down.constructor.name).toBe("AsyncFunction");
  });
});
