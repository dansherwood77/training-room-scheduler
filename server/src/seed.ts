import { ROOM_COLORS, atTime, startOfWeek } from "@scheduler/shared";
import type { DB } from "./db";
import { createBooking, createRoom, listRooms } from "./store";

const sun = ROOM_COLORS[0].hex;
const ember = ROOM_COLORS[1].hex;
const rose = ROOM_COLORS[3].hex;
const dusk = ROOM_COLORS[5].hex;

export function seedIfEmpty(db: DB) {
  if (listRooms(db).length > 0) return;

  const rooms = [
    { name: "Sun Room", capacity: 18, color: sun },
    { name: "Palm Studio", capacity: 12, color: ember },
    { name: "Tide Room", capacity: 8, color: rose },
    { name: "The Loft", capacity: 24, color: dusk },
  ].map((room) => {
    const created = createRoom(db, room);
    if (!created.ok) throw new Error(created.message);
    return created.value;
  });

  const byName = Object.fromEntries(rooms.map((room) => [room.name, room.id]));
  const week = startOfWeek(Date.now());
  const at = (dayIndex: number, hour: number, minute: number) =>
    atTime(week.plus({ days: dayIndex }).toMillis(), hour, minute);

  const sessions: Array<{
    room: string;
    title: string;
    instructor: string;
    start: number;
    end: number;
  }> = [
    { room: "The Loft", title: "Bell Check", instructor: "Lena Ortiz", start: at(0, 7, 15), end: at(0, 8, 0) },
    { room: "Sun Room", title: "Morning Flow", instructor: "Ana Ruiz", start: at(0, 8, 0), end: at(0, 12, 30) },
    { room: "Palm Studio", title: "First Aid", instructor: "Jordan Hale", start: at(0, 9, 0), end: at(0, 12, 0) },
    { room: "Sun Room", title: "Harbor Table", instructor: "Priya Shah", start: at(0, 13, 0), end: at(0, 16, 30) },
    { room: "Tide Room", title: "Skills Lab", instructor: "Jordan Hale", start: at(0, 17, 0), end: at(0, 18, 30) },
    { room: "Tide Room", title: "New Hire Orientation", instructor: "Priya Shah", start: at(1, 8, 30), end: at(1, 13, 0) },
    { room: "The Loft", title: "Overnight Lab", instructor: "Sam Okonkwo", start: at(2, 20, 0), end: at(3, 7, 0) },
    { room: "Sun Room", title: "Safety Brief", instructor: "Chris Adeyemi", start: at(3, 10, 0), end: at(3, 11, 30) },
    { room: "Palm Studio", title: "Clay Lab", instructor: "Lena Ortiz", start: at(3, 13, 0), end: at(3, 16, 0) },
    { room: "Sun Room", title: "Kit Check", instructor: "Chris Adeyemi", start: at(4, 9, 0), end: at(4, 11, 0) },
    { room: "Palm Studio", title: "Closing Workshop", instructor: "Lena Ortiz", start: at(4, 12, 0), end: at(4, 17, 0) },
    { room: "Tide Room", title: "Shoreline Drill", instructor: "Ana Ruiz", start: at(5, 9, 30), end: at(5, 12, 30) },
    { room: "The Loft", title: "Open Water", instructor: "Sam Okonkwo", start: at(5, 13, 0), end: at(5, 14, 30) },
    { room: "The Loft", title: "Opening Circle", instructor: "Lena Ortiz", start: at(6, 9, 0), end: at(6, 10, 15) },
    { room: "Palm Studio", title: "Weekend Studio", instructor: "Ana Ruiz", start: at(6, 11, 0), end: at(6, 15, 30) },
  ];

  for (const session of sessions) {
    const created = createBooking(db, {
      roomId: byName[session.room],
      title: session.title,
      instructor: session.instructor,
      startMs: session.start,
      endMs: session.end,
    });
    if (!created.ok) throw new Error(created.message);
  }
}
