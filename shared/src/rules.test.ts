import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  END_BEFORE_START,
  VENUE_ZONE,
  cancelBookingMessage,
  cancelRoomMessage,
  endIsAfterStart,
  overCapacityMessage,
  overlapMessage,
  rangesOverlap,
} from "./index";
import { fromDateAndTime } from "./time";

function ms(iso: string): number {
  const value = DateTime.fromISO(iso, { zone: VENUE_ZONE }).toMillis();
  if (!Number.isFinite(value)) throw new Error(`Bad instant ${iso}`);
  return value;
}

describe("rangesOverlap", () => {
  const morning = [ms("2026-11-08T09:00"), ms("2026-11-08T10:00")] as const;
  const backToBack = [ms("2026-11-08T10:00"), ms("2026-11-08T11:00")] as const;
  const overlap = [ms("2026-11-08T09:30"), ms("2026-11-08T10:30")] as const;
  const inside = [ms("2026-11-08T09:15"), ms("2026-11-08T09:45")] as const;

  it("treats a shared endpoint as free", () => {
    expect(rangesOverlap(...morning, ...backToBack)).toBe(false);
  });

  it("catches a partial overlap and a booking inside another", () => {
    expect(rangesOverlap(...morning, ...overlap)).toBe(true);
    expect(rangesOverlap(...morning, ...inside)).toBe(true);
  });

  it("catches a booking that crosses midnight into an existing one", () => {
    const overnight = [ms("2026-11-08T22:00"), ms("2026-11-09T00:30")] as const;
    const afterMidnight = [ms("2026-11-09T00:00"), ms("2026-11-09T01:00")] as const;
    const later = [ms("2026-11-09T00:30"), ms("2026-11-09T02:00")] as const;
    expect(rangesOverlap(...overnight, ...afterMidnight)).toBe(true);
    expect(rangesOverlap(...overnight, ...later)).toBe(false);
  });
});

describe("endIsAfterStart", () => {
  it("requires the end to be later", () => {
    const start = ms("2026-11-08T22:00");
    const end = ms("2026-11-09T00:30");
    expect(endIsAfterStart(start, end)).toBe(true);
    expect(endIsAfterStart(end, start)).toBe(false);
    expect(endIsAfterStart(start, start)).toBe(false);
  });
});

describe("refusal copy", () => {
  it("names the session that is in the way", () => {
    expect(overlapMessage("Sun Room", "Morning Flow", "Ana Ruiz", "9:00 AM to 10:30 AM")).toBe(
      "Sun Room is already booked then, for Morning Flow with Ana Ruiz, 9:00 AM to 10:30 AM.",
    );
    expect(END_BEFORE_START).toMatch(/after the start/);
    expect(overCapacityMessage("Tide Room", 8, 9)).toBe(
      "Tide Room holds 8 people. 9 people are more than that room can take.",
    );
    expect(overCapacityMessage("The Loft", 1, 2)).toBe(
      "The Loft holds 1 person. 2 people are more than that room can take.",
    );
  });

  it("states what a cancel will free or remove", () => {
    expect(cancelBookingMessage("Morning Flow", "Sun Room", "9:00 AM to 10:30 AM")).toBe(
      "Cancel Morning Flow in Sun Room? The room is free from 9:00 AM to 10:30 AM.",
    );
    expect(cancelRoomMessage("Palm Studio", 0)).toBe("Cancel Palm Studio? This room has no bookings.");
    expect(cancelRoomMessage("Palm Studio", 1)).toBe(
      "Cancel Palm Studio? 1 booking on this room will be cancelled too.",
    );
    expect(cancelRoomMessage("Palm Studio", 3)).toBe(
      "Cancel Palm Studio? 3 bookings on this room will be cancelled too.",
    );
  });

  it("parses a venue date and time", () => {
    expect(fromDateAndTime("2026-11-08", "22:30")).toBe(ms("2026-11-08T22:30"));
    expect(fromDateAndTime("nope", "22:30")).toBeNull();
  });
});
