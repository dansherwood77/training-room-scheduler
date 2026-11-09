import { addMinutes, at, snapToQuarter, type Booking } from "@scheduler/shared";

const MIN_MINUTES = 15;

export function moveByPointer(booking: Booking, pointerMs: number, offsetMs: number) {
  const startMs = snapToQuarter(pointerMs - offsetMs);
  return { startMs, endMs: startMs + (booking.endMs - booking.startMs) };
}

export function resizeEdge(booking: Booking, edge: "start" | "end", pointerMs: number) {
  const snapped = snapToQuarter(pointerMs);
  if (edge === "start") {
    const latest = addMinutes(booking.endMs, -MIN_MINUTES);
    return { startMs: Math.min(snapped, latest), endMs: booking.endMs };
  }
  const earliest = addMinutes(booking.startMs, MIN_MINUTES);
  return { startMs: booking.startMs, endMs: Math.max(snapped, earliest) };
}

export function moveToDay(booking: Booking, dayStartMs: number) {
  const start = at(booking.startMs);
  const next = at(dayStartMs).set({
    hour: start.hour,
    minute: start.minute,
    second: 0,
    millisecond: 0,
  });
  const startMs = next.toMillis();
  return { startMs, endMs: startMs + (booking.endMs - booking.startMs) };
}
