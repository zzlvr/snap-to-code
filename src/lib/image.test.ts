import { describe, expect, it } from "vitest";
import { planLayout, planSegments } from "./image";

describe("planSegments", () => {
  it("keeps a short page in one piece", () => {
    expect(planSegments(900)).toEqual([{ y: 0, height: 900 }]);
    expect(planSegments(1568)).toEqual([{ y: 0, height: 1568 }]);
  });

  it("cuts a long page into slices that never exceed 1568 px and cover every row", () => {
    for (const total of [1569, 2000, 3136, 5000, 7777, 12000]) {
      const segs = planSegments(total);
      expect(segs.length).toBeGreaterThan(1);
      for (const s of segs) expect(s.height).toBeLessThanOrEqual(1568);
      expect(segs[0].y).toBe(0);
      const last = segs[segs.length - 1];
      expect(last.y + last.height).toBe(total);
      // No gaps: each slice starts inside the previous one (they overlap).
      for (let i = 1; i < segs.length; i++) expect(segs[i].y).toBeLessThanOrEqual(segs[i - 1].y + segs[i - 1].height);
      // And they move forward.
      for (let i = 1; i < segs.length; i++) expect(segs[i].y).toBeGreaterThan(segs[i - 1].y);
    }
  });
});

describe("planLayout", () => {
  it("leaves an ordinary single screenshot as one image, fitted to 1568 px", () => {
    expect(planLayout([{ width: 1280, height: 800 }])).toEqual({
      width: 1280,
      heights: [800],
      total: 800,
      segments: [{ y: 0, height: 800 }],
    });
    const big = planLayout([{ width: 3000, height: 2000 }]);
    expect(big.width).toBe(1568);
    expect(big.segments).toHaveLength(1);
  });

  it("does not slice a phone screenshot", () => {
    const phone = planLayout([{ width: 1170, height: 2532 }]);
    expect(phone.segments).toHaveLength(1);
    expect(Math.max(phone.width, phone.total)).toBeLessThanOrEqual(1568);
  });

  it("slices one very tall screenshot, keeping its width", () => {
    const tall = planLayout([{ width: 1280, height: 5000 }]);
    expect(tall.width).toBe(1280);
    expect(tall.total).toBe(5000);
    expect(tall.segments.length).toBeGreaterThan(2);
  });

  it("stacks several screenshots at the widest width, in order", () => {
    const l = planLayout([
      { width: 1280, height: 800 },
      { width: 640, height: 400 },
      { width: 1280, height: 900 },
    ]);
    expect(l.width).toBe(1280);
    expect(l.heights).toEqual([800, 800, 900]);
    expect(l.total).toBe(2500);
    expect(l.segments.length).toBe(2);
  });

  it("scales stacked 4K captures down to 1568 px wide", () => {
    const l = planLayout([
      { width: 3840, height: 2160 },
      { width: 3840, height: 2160 },
    ]);
    expect(l.width).toBe(1568);
    expect(l.heights).toEqual([882, 882]);
  });

  it("refuses a page that would be too tall to read", () => {
    expect(() => planLayout([{ width: 1000, height: 20000 }])).toThrow(/taller than 12,000 px/);
  });

  it("refuses an empty list", () => {
    expect(() => planLayout([])).toThrow();
  });
});
