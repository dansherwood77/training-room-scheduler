import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { canonicalRoomColor } from "@scheduler/shared";
import type { DB } from "./db";
import {
  createBooking,
  createRoom,
  deleteBooking,
  deleteRoom,
  listBookings,
  listRooms,
  updateBooking,
  updateRoom,
} from "./store";

const roomBody = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(80, "That room name is too long."),
  capacity: z
    .number({ invalid_type_error: "Capacity has to be a whole number." })
    .int("Capacity has to be a whole number.")
    .min(1, "Capacity has to be at least 1.")
    .max(1000, "Capacity has to be 1000 or less."),
  color: z.string().trim().refine((value) => canonicalRoomColor(value) != null, "Pick a color for the room."),
});

const bookingBody = z.object({
  roomId: z.string().trim().min(1, "Choose a room."),
  title: z.string().trim().min(1, "Add a session title.").max(120, "That title is too long."),
  instructor: z.string().trim().min(1, "Add an instructor.").max(80, "That name is too long."),
  startMs: z.number().int(),
  endMs: z.number().int(),
});

function sendFailure(res: Response, status: number, message: string) {
  res.status(status).json({ message });
}

function invalid(res: Response, error: z.ZodError) {
  sendFailure(res, 400, error.issues[0]?.message ?? "That request isn't complete.");
}

export function createApp(db: DB): Express {
  const app = express();
  app.use(express.json());

  app.get("/rooms", (_req, res) => {
    res.json(listRooms(db));
  });

  app.post("/rooms", (req, res) => {
    const parsed = roomBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const result = createRoom(db, parsed.data);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.status(201).json(result.value);
  });

  app.patch("/rooms/:id", (req, res) => {
    const parsed = roomBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const result = updateRoom(db, req.params.id, parsed.data);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.json(result.value);
  });

  app.delete("/rooms/:id", (req, res) => {
    const result = deleteRoom(db, req.params.id);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.json(result.value);
  });

  app.get("/bookings", (req, res) => {
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return sendFailure(res, 400, "Pick a valid range of days.");
    }
    const roomId = typeof req.query.roomId === "string" && req.query.roomId.length > 0 ? req.query.roomId : undefined;
    res.json(listBookings(db, { from, to, roomId }));
  });

  app.post("/bookings", (req, res) => {
    const parsed = bookingBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const result = createBooking(db, parsed.data);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.status(201).json(result.value);
  });

  app.patch("/bookings/:id", (req, res) => {
    const parsed = bookingBody.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const result = updateBooking(db, req.params.id, parsed.data);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.json(result.value);
  });

  app.delete("/bookings/:id", (req, res) => {
    const result = deleteBooking(db, req.params.id);
    if (!result.ok) return sendFailure(res, result.status, result.message);
    res.json(result.value);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    if (res.headersSent) return;
    res.status(500).json({ message: "Something went wrong on the server." });
  });

  return app;
}
