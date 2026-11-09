import { describe, expect, it } from "vitest";
import { fitMonthItems } from "./fitMonth";

describe("fitMonthItems", () => {
  it("shows every chip when the cell can hold them", () => {
    expect(fitMonthItems(100, [20, 20, 20], 18)).toBe(3);
  });

  it("holds back a chip so the more-link still fits", () => {
    expect(fitMonthItems(50, [20, 20, 20], 18)).toBe(1);
  });

  it("keeps the first chip when the more-link would be the part that overflows", () => {
    expect(fitMonthItems(30, [20, 20], 18)).toBe(1);
  });

  it("shows nothing when even one chip is taller than the cell", () => {
    expect(fitMonthItems(10, [20], 18)).toBe(0);
  });
});
