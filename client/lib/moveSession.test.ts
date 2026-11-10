import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { VENUE_ZONE, type Booking } from "@scheduler/shared";
import { moveByPointer, moveToDay, resizeEdge } from "./moveSession";

function ms(iso: string): number {
  const value = DateTime.fromISO(iso, { zone: VENUE_ZONE }).toMillis();
  if (!Number.isFinite(value)) throw new Error(`Bad instant ${iso}`);
  return value;
}

function booking(start: string, end: string): Booking {
  return {
    id: "booking",
    roomId: "room",
    roomName: "Sun Room",
    roomColor: "#F0C84A",
    title: "Morning Flow",
    instructor: "Ana Ruiz",
    attendees: null,
    startMs: ms(start),
    endMs: ms(end),
  };
}

describe("moveByPointer", () => {
  it("snaps the grab to a quarter hour and keeps the length", () => {
    const session = booking("2026-11-08T09:00", "2026-11-08T10:30");
    const moved = moveByPointer(session, ms("2026-11-08T11:14"), 0);
    expect(moved.startMs).toBe(ms("2026-11-08T11:00"));
    expect(moved.endMs).toBe(ms("2026-11-08T12:30"));
  });
});

describe("resizeEdge", () => {
  const session = booking("2026-11-08T09:00", "2026-11-08T10:30");

  it("snaps the start and will not leave less than 15 minutes", () => {
    expect(resizeEdge(session, "start", ms("2026-11-08T09:20"))).toEqual({
      startMs: ms("2026-11-08T09:15"),
      endMs: ms("2026-11-08T10:30"),
    });
    expect(resizeEdge(session, "start", ms("2026-11-08T10:20"))).toEqual({
      startMs: ms("2026-11-08T10:15"),
      endMs: ms("2026-11-08T10:30"),
    });
  });

  it("snaps the end and will not leave less than 15 minutes", () => {
    expect(resizeEdge(session, "end", ms("2026-11-08T11:10"))).toEqual({
      startMs: ms("2026-11-08T09:00"),
      endMs: ms("2026-11-08T11:00"),
    });
    expect(resizeEdge(session, "end", ms("2026-11-08T09:05"))).toEqual({
      startMs: ms("2026-11-08T09:00"),
      endMs: ms("2026-11-08T09:15"),
    });
  });
});

describe("moveToDay", () => {
  it("keeps the clock time when the session moves to another day", () => {
    const moved = moveToDay(booking("2026-11-08T09:00", "2026-11-08T10:30"), ms("2026-11-11T00:00"));
    expect(moved.startMs).toBe(ms("2026-11-11T09:00"));
    expect(moved.endMs).toBe(ms("2026-11-11T10:30"));
  });

  it("keeps a session that crosses midnight crossing midnight", () => {
    const moved = moveToDay(booking("2026-11-10T21:00", "2026-11-11T03:00"), ms("2026-11-13T00:00"));
    expect(moved.startMs).toBe(ms("2026-11-13T21:00"));
    expect(moved.endMs).toBe(ms("2026-11-14T03:00"));
  });
});
