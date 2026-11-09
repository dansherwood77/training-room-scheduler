import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { packLanes } from "./layout";
import {
  VENUE_ZONE,
  clipToDays,
  formatWhen,
  hoursInDay,
  monthGrid,
  shiftAnchor,
  snapToQuarter,
  viewHeading,
  weekDays,
} from "./time";

function ms(iso: string): number {
  return DateTime.fromISO(iso, { zone: VENUE_ZONE }).toMillis();
}

describe("time", () => {
  it("starts the week on Sunday and clips a booking across midnight", () => {
    const days = weekDays(ms("2026-11-11T15:00"));
    expect(DateTime.fromMillis(days[0], { zone: VENUE_ZONE }).toISODate()).toBe("2026-11-08");
    expect(days).toHaveLength(7);

    const segments = clipToDays(ms("2026-11-10T22:30"), ms("2026-11-11T00:30"), days);
    expect(segments).toHaveLength(2);
    expect(segments[0].isFirst).toBe(true);
    expect(segments[0].isLast).toBe(false);
    expect(segments[1].isFirst).toBe(false);
    expect(segments[1].isLast).toBe(true);
  });

  it("snaps down to a quarter hour and describes a cross-midnight span", () => {
    expect(snapToQuarter(ms("2026-11-08T09:14"))).toBe(ms("2026-11-08T09:00"));
    expect(snapToQuarter(ms("2026-11-08T09:15"))).toBe(ms("2026-11-08T09:15"));
    expect(formatWhen(ms("2026-11-08T22:30"), ms("2026-11-09T00:30"))).toBe(
      "10:30 PM on Nov 8 to 12:30 AM on Nov 9",
    );
  });

  it("builds a six-week month and a poster heading", () => {
    const grid = monthGrid(ms("2026-11-08T09:00"));
    expect(grid.days).toHaveLength(42);
    expect(grid.days.some((day) => DateTime.fromMillis(day.startMs, { zone: VENUE_ZONE }).day === 1 && day.inMonth)).toBe(
      true,
    );
    expect(viewHeading(ms("2026-11-08T09:00"), "week")).toEqual({
      kicker: "November 2026",
      title: "8 – 14",
    });
    expect(viewHeading(ms("2026-11-08T09:00"), "month").title).toBe("November");
    expect(viewHeading(ms("2026-11-08T09:00"), "day")).toEqual({
      kicker: "November 8",
      title: "Sunday",
    });
    expect(shiftAnchor(ms("2026-11-08T09:00"), "day", 1)).toBe(ms("2026-11-09T09:00"));
  });

  it("skips the missing hour when the clocks spring forward", () => {
    const spring = DateTime.fromISO("2026-03-08", { zone: VENUE_ZONE }).startOf("day").toMillis();
    const labels = hoursInDay(spring).map((mark) => mark.label);
    expect(labels).toHaveLength(23);
    expect(labels).not.toContain("2 AM");
    expect(hoursInDay(ms("2026-11-08T00:00"))).toHaveLength(24);
  });
});

describe("packLanes", () => {
  it("shares a lane when two bookings only touch", () => {
    const packed = packLanes([
      { id: "a", startMs: 0, endMs: 60 },
      { id: "b", startMs: 60, endMs: 120 },
    ]);
    expect(packed.every((item) => item.lane === 0 && item.lanes === 1)).toBe(true);
  });

  it("places an overlap in a second lane", () => {
    const packed = packLanes([
      { id: "a", startMs: 0, endMs: 90 },
      { id: "b", startMs: 30, endMs: 120 },
    ]);
    const lanes = new Set(packed.map((item) => item.lane));
    expect(lanes.size).toBe(2);
    expect(packed.every((item) => item.lanes === 2)).toBe(true);
  });
});
