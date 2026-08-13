import { describe, expect, it } from "vitest";
import { executeRule } from "../calculators/engine.js";
import { getRuleById } from "../formulas/registry.js";
import { convert, normalizeToMetres } from "../units/converter.js";

describe("unit conversion", () => {
  it("converts cm to m", () => {
    expect(normalizeToMetres(250, "cm")).toBe(2.5);
  });

  it("converts mm to m", () => {
    expect(normalizeToMetres(5000, "mm")).toBe(5);
  });

  it("converts ft to m", () => {
    expect(normalizeToMetres(1, "ft")).toBeCloseTo(0.3048, 4);
  });

  it("returns same value for identical units", () => {
    expect(convert(5, "m", "m")).toBe(5);
  });
});

describe("VERIFY-EX-001: Masonry Platform — Centre Line Excavation", () => {
  it("computes total centre line length", () => {
    const rule = getRuleById("RULE-GEO-005")!;
    const result = executeRule(rule, {
      c_to_c_long: 5.6,
      c_to_c_short: 4.6,
      long_wall_count: 2,
      short_wall_count: 2,
    });
    expect(result.result).toBe(20.4);
  });

  it("computes excavation volume via centre line", () => {
    const rule = getRuleById("RULE-QTY-003")!;
    const result = executeRule(rule, {
      total_cl: 20.4,
      breadth: 0.8,
      height_or_depth: 0.7,
    });
    expect(result.result).toBe(11.42);
  });
});

describe("VERIFY-EX-002: Masonry Platform — Long/Short Wall Excavation", () => {
  it("computes long and short wall lengths", () => {
    const longRule = getRuleById("RULE-GEO-003")!;
    const shortRule = getRuleById("RULE-GEO-004")!;
    expect(executeRule(longRule, { c_to_c_long: 5.6, offset: 0.8 }).result).toBe(6.4);
    expect(executeRule(shortRule, { c_to_c_short: 4.6, offset: 0.8 }).result).toBe(3.8);
  });

  it("computes combined excavation volume", () => {
    const rule = getRuleById("RULE-QTY-002")!;
    const result = executeRule(rule, {
      long_wall_count: 2,
      long_wall_length: 6.4,
      short_wall_count: 2,
      short_wall_length: 3.8,
      breadth: 0.8,
      height_or_depth: 0.7,
    });
    expect(result.result).toBe(11.42);
  });
});

describe("VERIFY-EX-003: Motor Garage — Plinth Area Rate", () => {
  it("computes plinth area rate", () => {
    const rule = getRuleById("RULE-COST-005")!;
    const result = executeRule(rule, {
      grand_total: 15306.57,
      plinth_length: 7.1,
      plinth_width: 3.6,
    });
    expect(result.result).toBeCloseTo(598.85, 1);
  });
});

describe("centre-to-centre geometry", () => {
  it("computes c-to-c long wall from Ex. 1", () => {
    const rule = getRuleById("RULE-GEO-001")!;
    const result = executeRule(rule, { external_length: 6.0, wall_thickness: 0.4 });
    expect(result.result).toBe(5.6);
  });

  it("computes c-to-c short wall from Ex. 1", () => {
    const rule = getRuleById("RULE-GEO-002")!;
    const result = executeRule(rule, { external_width: 5.0, wall_thickness: 0.4 });
    expect(result.result).toBe(4.6);
  });
});

describe("costing rules", () => {
  it("computes contingencies at 3%", () => {
    const rule = getRuleById("RULE-COST-002")!;
    expect(executeRule(rule, { subtotal: 8176.68, contingency_rate: 0.03 }).result).toBeCloseTo(245.3, 1);
  });

  it("computes grand total", () => {
    const rule = getRuleById("RULE-COST-004")!;
    expect(
      executeRule(rule, { subtotal: 8176.68, contingencies: 245.3, wce: 163.53 }).result
    ).toBeCloseTo(8585.51, 0);
  });
});
