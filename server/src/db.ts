import fs from "node:fs";
import Database from "better-sqlite3";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructor TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  CHECK (end_ms > start_ms)
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_span
  ON bookings (room_id, start_ms, end_ms);
`;

export function openDatabase(filename: string): DB {
  if (filename !== ":memory:") {
    const directory = filename.slice(0, filename.lastIndexOf("/"));
    if (directory) fs.mkdirSync(directory, { recursive: true });
  }
  const db = new Database(filename);
  if (filename !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const columns = db.prepare("PRAGMA table_info(rooms)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "color")) {
    db.exec("ALTER TABLE rooms ADD COLUMN color TEXT NOT NULL DEFAULT '#F0C84A'");
  }
  return db;
}
