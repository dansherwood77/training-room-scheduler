import { randomUUID } from "node:crypto";
import {
  BOOKING_MISSING,
  END_BEFORE_START,
  ROOM_MISSING,
  canonicalRoomColor,
  duplicateRoomMessage,
  endIsAfterStart,
  formatWhen,
  overlapMessage,
  type Booking,
  type Room,
} from "@scheduler/shared";
import type { DB } from "./db";

export type Failure = { ok: false; status: number; message: string };
export type Success<T> = { ok: true; value: T };
export type Result<T> = Success<T> | Failure;

function fail(status: number, message: string): Failure {
  return { ok: false, status, message };
}

type RoomRecord = {
  id: string;
  name: string;
  color: string;
  capacity: number;
  booking_count: number;
};

type BookingRecord = {
  id: string;
  room_id: string;
  room_name: string;
  room_color: string;
  title: string;
  instructor: string;
  start_ms: number;
  end_ms: number;
};

function toRoom(row: RoomRecord): Room {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    capacity: row.capacity,
    bookingCount: row.booking_count,
  };
}

function toBooking(row: BookingRecord): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    roomColor: row.room_color,
    title: row.title,
    instructor: row.instructor,
    startMs: row.start_ms,
    endMs: row.end_ms,
  };
}

const roomSelect = `
  SELECT r.id, r.name, r.color, r.capacity,
    (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id) AS booking_count
  FROM rooms r
`;

const bookingSelect = `
  SELECT b.id, b.room_id, r.name AS room_name, r.color AS room_color,
    b.title, b.instructor, b.start_ms, b.end_ms
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
`;

export function listRooms(db: DB): Room[] {
  const rows = db.prepare(`${roomSelect} ORDER BY r.created_at ASC`).all() as RoomRecord[];
  return rows.map(toRoom);
}

export function createRoom(db: DB, input: { name: string; color: string; capacity: number }): Result<Room> {
  const name = input.name.trim();
  const color = canonicalRoomColor(input.color);
  if (!color) return fail(400, "Pick a color for the room.");
  const existing = db
    .prepare("SELECT name FROM rooms WHERE lower(name) = lower(?)")
    .get(name) as { name: string } | undefined;
  if (existing) return fail(409, duplicateRoomMessage(existing.name));

  const id = randomUUID();
  db.prepare("INSERT INTO rooms (id, name, color, capacity, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    name,
    color,
    input.capacity,
    Date.now(),
  );
  const row = db.prepare(`${roomSelect} WHERE r.id = ?`).get(id) as RoomRecord;
  return { ok: true, value: toRoom(row) };
}

export function updateRoom(
  db: DB,
  id: string,
  input: { name: string; color: string; capacity: number },
): Result<Room> {
  const current = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id) as { id: string } | undefined;
  if (!current) return fail(404, ROOM_MISSING);
  const color = canonicalRoomColor(input.color);
  if (!color) return fail(400, "Pick a color for the room.");

  const name = input.name.trim();
  const existing = db
    .prepare("SELECT name FROM rooms WHERE lower(name) = lower(?) AND id != ?")
    .get(name, id) as { name: string } | undefined;
  if (existing) return fail(409, duplicateRoomMessage(existing.name));

  db.prepare("UPDATE rooms SET name = ?, color = ?, capacity = ? WHERE id = ?").run(name, color, input.capacity, id);
  const row = db.prepare(`${roomSelect} WHERE r.id = ?`).get(id) as RoomRecord;
  return { ok: true, value: toRoom(row) };
}

export function deleteRoom(db: DB, id: string): Result<{ removedBookings: number }> {
  const current = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id) as { id: string } | undefined;
  if (!current) return fail(404, ROOM_MISSING);
  const count = db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE room_id = ?").get(id) as { n: number };
  const remove = db.transaction(() => {
    db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  });
  remove();
  return { ok: true, value: { removedBookings: count.n } };
}

export function listBookings(
  db: DB,
  query: { from: number; to: number; roomId?: string },
): Booking[] {
  const rows = db
    .prepare(
      `${bookingSelect}
       WHERE b.start_ms < @to
         AND b.end_ms > @from
         AND (@roomId IS NULL OR b.room_id = @roomId)
       ORDER BY b.start_ms ASC, b.title ASC`,
    )
    .all({ from: query.from, to: query.to, roomId: query.roomId ?? null }) as BookingRecord[];
  return rows.map(toBooking);
}

function findConflict(
  db: DB,
  input: { roomId: string; startMs: number; endMs: number; excludeId?: string },
): BookingRecord | undefined {
  // Half-open intervals: a booking that ends at 11:00 does not block one that starts at 11:00.
  return db
    .prepare(
      `SELECT b.id, b.room_id, r.name AS room_name, r.color AS room_color, b.title, b.instructor, b.start_ms, b.end_ms
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       WHERE b.room_id = @roomId
         AND b.start_ms < @endMs
         AND b.end_ms > @startMs
         AND b.id != @excludeId
       ORDER BY b.start_ms ASC
       LIMIT 1`,
    )
    .get({
      roomId: input.roomId,
      startMs: input.startMs,
      endMs: input.endMs,
      excludeId: input.excludeId ?? "",
    }) as BookingRecord | undefined;
}

function validateBooking(
  db: DB,
  input: { roomId: string; title: string; instructor: string; startMs: number; endMs: number; excludeId?: string },
): Failure | { ok: true; roomName: string; roomColor: string } {
  if (!endIsAfterStart(input.startMs, input.endMs)) return fail(400, END_BEFORE_START);
  const room = db.prepare("SELECT name, color FROM rooms WHERE id = ?").get(input.roomId) as
    | { name: string; color: string }
    | undefined;
  if (!room) return fail(404, ROOM_MISSING);
  const conflict = findConflict(db, input);
  if (conflict) {
    return fail(
      409,
      overlapMessage(room.name, conflict.title, conflict.instructor, formatWhen(conflict.start_ms, conflict.end_ms)),
    );
  }
  return { ok: true, roomName: room.name, roomColor: room.color };
}

export function createBooking(
  db: DB,
  input: { roomId: string; title: string; instructor: string; startMs: number; endMs: number },
): Result<Booking> {
  const check = validateBooking(db, input);
  if (!check.ok) return check;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO bookings (id, room_id, title, instructor, start_ms, end_ms)
     VALUES (@id, @roomId, @title, @instructor, @startMs, @endMs)`,
  ).run({
    id,
    roomId: input.roomId,
    title: input.title.trim(),
    instructor: input.instructor.trim(),
    startMs: input.startMs,
    endMs: input.endMs,
  });
  return {
    ok: true,
    value: {
      id,
      roomId: input.roomId,
      roomName: check.roomName,
      roomColor: check.roomColor,
      title: input.title.trim(),
      instructor: input.instructor.trim(),
      startMs: input.startMs,
      endMs: input.endMs,
    },
  };
}

export function updateBooking(
  db: DB,
  id: string,
  input: { roomId: string; title: string; instructor: string; startMs: number; endMs: number },
): Result<Booking> {
  const current = db.prepare("SELECT id FROM bookings WHERE id = ?").get(id) as { id: string } | undefined;
  if (!current) return fail(404, BOOKING_MISSING);
  const check = validateBooking(db, { ...input, excludeId: id });
  if (!check.ok) return check;
  db.prepare(
    `UPDATE bookings
     SET room_id = @roomId, title = @title, instructor = @instructor, start_ms = @startMs, end_ms = @endMs
     WHERE id = @id`,
  ).run({
    id,
    roomId: input.roomId,
    title: input.title.trim(),
    instructor: input.instructor.trim(),
    startMs: input.startMs,
    endMs: input.endMs,
  });
  return {
    ok: true,
    value: {
      id,
      roomId: input.roomId,
      roomName: check.roomName,
      roomColor: check.roomColor,
      title: input.title.trim(),
      instructor: input.instructor.trim(),
      startMs: input.startMs,
      endMs: input.endMs,
    },
  };
}

export function deleteBooking(db: DB, id: string): Result<{ id: string }> {
  const result = db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  if (result.changes === 0) return fail(404, BOOKING_MISSING);
  return { ok: true, value: { id } };
}
