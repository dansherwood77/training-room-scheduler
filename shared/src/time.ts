import { DateTime, Settings } from "luxon";

Settings.defaultLocale = "en-US";

export const VENUE_ZONE = "America/Los_Angeles";

export function at(ms: number, zone = VENUE_ZONE): DateTime {
  return DateTime.fromMillis(ms, { zone });
}

export function startOfDay(ms: number, zone = VENUE_ZONE): DateTime {
  return at(ms, zone).startOf("day");
}

export function dayEndMs(dayStartMs: number, zone = VENUE_ZONE): number {
  return at(dayStartMs, zone).plus({ days: 1 }).toMillis();
}

/** Weeks begin on Sunday. */
export function startOfWeek(ms: number, zone = VENUE_ZONE): DateTime {
  const day = startOfDay(ms, zone);
  return day.minus({ days: day.weekday % 7 });
}

export function weekDays(anchorMs: number, zone = VENUE_ZONE): number[] {
  const start = startOfWeek(anchorMs, zone);
  return Array.from({ length: 7 }, (_, index) => start.plus({ days: index }).toMillis());
}

export function weekBounds(anchorMs: number, zone = VENUE_ZONE): {
  startMs: number;
  endMs: number;
  days: number[];
} {
  const days = weekDays(anchorMs, zone);
  return {
    startMs: days[0],
    endMs: startOfWeek(anchorMs, zone).plus({ days: 7 }).toMillis(),
    days,
  };
}

export type MonthCell = {
  startMs: number;
  inMonth: boolean;
};

export function monthGrid(anchorMs: number, zone = VENUE_ZONE): {
  startMs: number;
  endMs: number;
  days: MonthCell[];
  monthStartMs: number;
} {
  const monthStart = at(anchorMs, zone).startOf("month");
  const gridStart = startOfWeek(monthStart.toMillis(), zone);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = gridStart.plus({ days: index });
    return {
      startMs: day.toMillis(),
      inMonth: day.month === monthStart.month && day.year === monthStart.year,
    };
  });
  return {
    startMs: gridStart.toMillis(),
    endMs: gridStart.plus({ days: 42 }).toMillis(),
    days,
    monthStartMs: monthStart.toMillis(),
  };
}

export type CalendarView = "day" | "week" | "month";

export function shiftAnchor(
  anchorMs: number,
  view: CalendarView,
  direction: -1 | 1,
  zone = VENUE_ZONE,
): number {
  const day = at(anchorMs, zone);
  if (view === "day") return day.plus({ days: direction }).toMillis();
  if (view === "week") return day.plus({ weeks: direction }).toMillis();
  return day.plus({ months: direction }).toMillis();
}

export function viewHeading(
  anchorMs: number,
  view: CalendarView,
  zone = VENUE_ZONE,
): { kicker: string; title: string } {
  if (view === "day") {
    const day = at(anchorMs, zone);
    return { kicker: day.toFormat("MMMM d"), title: day.toFormat("cccc") };
  }
  if (view === "month") {
    const month = at(anchorMs, zone);
    return { kicker: month.toFormat("yyyy"), title: month.toFormat("MMMM") };
  }
  const start = startOfWeek(anchorMs, zone);
  const end = start.plus({ days: 6 });
  const sameMonth = start.month === end.month && start.year === end.year;
  const kicker = sameMonth
    ? start.toFormat("MMMM yyyy")
    : start.year === end.year
      ? start.toFormat("yyyy")
      : `${start.toFormat("yyyy")} – ${end.toFormat("yyyy")}`;
  const title = sameMonth
    ? `${start.day} – ${end.day}`
    : `${start.toFormat("MMM d")} – ${end.toFormat("MMM d")}`;
  return { kicker, title };
}

export function toDateInput(ms: number, zone = VENUE_ZONE): string {
  return at(ms, zone).toFormat("yyyy-MM-dd");
}

export function toTimeInput(ms: number, zone = VENUE_ZONE): string {
  return at(ms, zone).toFormat("HH:mm");
}

export function fromDateAndTime(date: string, time: string, zone = VENUE_ZONE): number | null {
  const parsed = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!parsed.isValid) return null;
  return parsed.toMillis();
}

export function atTime(dayStartMs: number, hour: number, minute: number, zone = VENUE_ZONE): number {
  return at(dayStartMs, zone).set({ hour, minute, second: 0, millisecond: 0 }).toMillis();
}

export function addMinutes(ms: number, minutes: number, zone = VENUE_ZONE): number {
  return at(ms, zone).plus({ minutes }).toMillis();
}

export function snapToQuarter(ms: number, zone = VENUE_ZONE): number {
  const time = at(ms, zone);
  const minute = Math.floor(time.minute / 15) * 15;
  return time.set({ minute, second: 0, millisecond: 0 }).toMillis();
}

export function isSameDay(a: number, b: number, zone = VENUE_ZONE): boolean {
  return at(a, zone).hasSame(at(b, zone), "day");
}

export function formatTime(ms: number, zone = VENUE_ZONE): string {
  return at(ms, zone).toFormat("h:mm a");
}

export function formatWhen(startMs: number, endMs: number, zone = VENUE_ZONE): string {
  const start = at(startMs, zone);
  const end = at(endMs, zone);
  if (start.hasSame(end, "day")) {
    return `${start.toFormat("h:mm a")} to ${end.toFormat("h:mm a")}`;
  }
  return `${start.toFormat("h:mm a 'on' MMM d")} to ${end.toFormat("h:mm a 'on' MMM d")}`;
}

export function formatSpan(startMs: number, endMs: number, zone = VENUE_ZONE): string {
  const start = at(startMs, zone);
  const end = at(endMs, zone);
  if (start.hasSame(end, "day")) {
    return `${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")}`;
  }
  return `${start.toFormat("ccc h:mm a")} – ${end.toFormat("ccc h:mm a")}`;
}

export function formatDaySpan(startMs: number, endMs: number, zone = VENUE_ZONE): string {
  const start = at(Math.min(startMs, endMs), zone);
  const end = at(Math.max(startMs, endMs), zone);
  if (start.hasSame(end, "day")) return start.toFormat("ccc, MMM d");
  if (start.hasSame(end, "month")) return `${start.toFormat("MMM d")} – ${end.toFormat("d")}`;
  return `${start.toFormat("MMM d")} – ${end.toFormat("MMM d")}`;
}

export type DaySegment = {
  dayStartMs: number;
  startMs: number;
  endMs: number;
  isFirst: boolean;
  isLast: boolean;
};

export function clipToDays(
  startMs: number,
  endMs: number,
  dayStarts: number[],
  zone = VENUE_ZONE,
): DaySegment[] {
  const segments: DaySegment[] = [];
  for (const dayStartMs of dayStarts) {
    const dayEnd = dayEndMs(dayStartMs, zone);
    const segStart = Math.max(startMs, dayStartMs);
    const segEnd = Math.min(endMs, dayEnd);
    if (segStart < segEnd) {
      segments.push({
        dayStartMs,
        startMs: segStart,
        endMs: segEnd,
        isFirst: segStart === startMs,
        isLast: segEnd === endMs,
      });
    }
  }
  return segments;
}

export type HourMark = {
  ms: number;
  label: string;
  hour: number;
};

export function hoursInDay(dayStartMs: number, zone = VENUE_ZONE): HourMark[] {
  const start = at(dayStartMs, zone).startOf("day");
  const end = start.plus({ days: 1 });
  const marks: HourMark[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const mark = start.set({ hour, minute: 0, second: 0, millisecond: 0 });
    if (mark < start || mark >= end || mark.hour !== hour) continue;
    marks.push({ ms: mark.toMillis(), hour, label: mark.toFormat("h a") });
  }
  return marks;
}

export function fractionOfDay(ms: number, dayStartMs: number, zone = VENUE_ZONE): number {
  const end = dayEndMs(dayStartMs, zone);
  return (ms - dayStartMs) / (end - dayStartMs);
}
