import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { DateTime } from "luxon";
import { ROOM_COLORS, VENUE_ZONE } from "@scheduler/shared";
import { createApp } from "./app";
import { openDatabase } from "./db";

const db = openDatabase(":memory:");
const app = createApp(db);

function ms(iso: string): number {
  return DateTime.fromISO(iso, { zone: VENUE_ZONE }).toMillis();
}

async function makeRoom(name = "Sun Room", capacity = 12, color: string = ROOM_COLORS[0].hex) {
  const response = await request(app).post("/rooms").send({ name, capacity, color });
  expect(response.status).toBe(201);
  return response.body as { id: string; name: string; color: string; capacity: number; bookingCount: number };
}

async function book(roomId: string, start: string, end: string, title = "Morning Flow", instructor = "Ana Ruiz") {
  return request(app).post("/bookings").send({
    roomId,
    title,
    instructor,
    startMs: ms(start),
    endMs: ms(end),
  });
}

beforeEach(() => {
  db.exec("DELETE FROM bookings; DELETE FROM rooms;");
});

afterAll(() => {
  db.close();
});

describe("rooms", () => {
  it("adds, edits, and refuses a duplicate name", async () => {
    const room = await makeRoom("Sun Room", 18);
    expect(room.color).toBe(ROOM_COLORS[0].hex);
    const renamed = await request(app)
      .patch(`/rooms/${room.id}`)
      .send({ name: "Palm Studio", capacity: 10, color: ROOM_COLORS[2].hex });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Palm Studio");
    expect(renamed.body.capacity).toBe(10);
    expect(renamed.body.color).toBe(ROOM_COLORS[2].hex);

    await makeRoom("Tide Room", 8);
    const duplicate = await request(app)
      .post("/rooms")
      .send({ name: "tide room", capacity: 4, color: ROOM_COLORS[3].hex });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe("There's already a room named Tide Room.");

    const missingColor = await request(app).post("/rooms").send({ name: "Courtyard", capacity: 6, color: "#000000" });
    expect(missingColor.status).toBe(400);
    expect(missingColor.body.message).toBe("Pick a color for the room.");
  });

  it("cancels a room and the bookings on it", async () => {
    const room = await makeRoom();
    const other = await makeRoom("The Loft", 20);
    expect((await book(room.id, "2026-11-08T09:00", "2026-11-08T10:00")).status).toBe(201);
    expect((await book(room.id, "2026-11-08T10:00", "2026-11-08T11:00", "Skills Lab", "Jordan Hale")).status).toBe(201);
    expect((await book(other.id, "2026-11-08T09:00", "2026-11-08T10:00", "First Aid", "Jordan Hale")).status).toBe(201);

    const removed = await request(app).delete(`/rooms/${room.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.removedBookings).toBe(2);

    const rooms = await request(app).get("/rooms");
    expect(rooms.body).toHaveLength(1);
    const bookings = await request(app).get("/bookings").query({ from: ms("2026-11-08T00:00"), to: ms("2026-11-09T00:00") });
    expect(bookings.body).toHaveLength(1);
    expect(bookings.body[0].roomName).toBe("The Loft");
    expect(bookings.body[0].roomColor).toBe(ROOM_COLORS[0].hex);
  });

  it("asks for a name and a real capacity", async () => {
    const response = await request(app).post("/rooms").send({ name: "  ", capacity: 0 });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/name|capacity/i);
  });
});

describe("bookings", () => {
  it("refuses an end that is not after the start", async () => {
    const room = await makeRoom();
    const response = await book(room.id, "2026-11-08T11:00", "2026-11-08T10:00");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("End time has to be after the start.");
  });

  it("allows back-to-back bookings and a session that crosses midnight", async () => {
    const room = await makeRoom();
    const first = await book(room.id, "2026-11-08T09:00", "2026-11-08T10:00");
    const second = await book(room.id, "2026-11-08T10:00", "2026-11-08T11:30", "Skills Lab", "Jordan Hale");
    const overnight = await book(room.id, "2026-11-08T22:30", "2026-11-09T00:30", "Overnight Lab", "Sam Okonkwo");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(overnight.status).toBe(201);
  });

  it("names the session that blocks an overlap, including across midnight", async () => {
    const room = await makeRoom();
    await book(room.id, "2026-11-08T22:00", "2026-11-09T00:30", "Overnight Lab", "Sam Okonkwo");
    const response = await book(room.id, "2026-11-09T00:00", "2026-11-09T01:00", "Early Drill", "Ana Ruiz");
    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Sun Room is already booked then, for Overnight Lab with Sam Okonkwo, 10:00 PM on Nov 8 to 12:30 AM on Nov 9.",
    );

    const touching = await book(room.id, "2026-11-09T00:30", "2026-11-09T02:00", "Early Drill", "Ana Ruiz");
    expect(touching.status).toBe(201);
  });

  it("lets an edit keep its own time and refuses one that collides", async () => {
    const room = await makeRoom();
    const created = await book(room.id, "2026-11-08T09:00", "2026-11-08T10:00");
    const neighbor = await book(room.id, "2026-11-08T10:00", "2026-11-08T11:00", "Skills Lab", "Jordan Hale");
    expect(neighbor.status).toBe(201);

    const sameSlot = await request(app).patch(`/bookings/${created.body.id}`).send({
      roomId: room.id,
      title: "Morning Flow",
      instructor: "Ana Ruiz",
      startMs: ms("2026-11-08T09:00"),
      endMs: ms("2026-11-08T10:00"),
    });
    expect(sameSlot.status).toBe(200);

    const collision = await request(app).patch(`/bookings/${created.body.id}`).send({
      roomId: room.id,
      title: "Morning Flow",
      instructor: "Ana Ruiz",
      startMs: ms("2026-11-08T09:30"),
      endMs: ms("2026-11-08T10:30"),
    });
    expect(collision.status).toBe(409);
    expect(collision.body.message).toContain("Skills Lab");
  });

  it("cancels a booking and filters the list by room", async () => {
    const sun = await makeRoom("Sun Room", 10);
    const tide = await makeRoom("Tide Room", 8);
    const created = await book(sun.id, "2026-11-08T09:00", "2026-11-08T10:00");
    await book(tide.id, "2026-11-08T09:00", "2026-11-08T10:00", "Shoreline Drill", "Priya Shah");

    const filtered = await request(app)
      .get("/bookings")
      .query({ from: ms("2026-11-08T00:00"), to: ms("2026-11-09T00:00"), roomId: tide.id });
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].title).toBe("Shoreline Drill");

    const removed = await request(app).delete(`/bookings/${created.body.id}`);
    expect(removed.status).toBe(200);
    const again = await request(app).delete(`/bookings/${created.body.id}`);
    expect(again.status).toBe(404);
    expect(again.body.message).toBe("That booking no longer exists.");
  });

  it("refuses a booking for a room that is gone", async () => {
    const response = await book("missing", "2026-11-08T09:00", "2026-11-08T10:00");
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("That room no longer exists.");
  });
});
