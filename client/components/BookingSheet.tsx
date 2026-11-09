"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  END_BEFORE_START,
  cancelBookingMessage,
  formatWhen,
  fromDateAndTime,
  toDateInput,
  toTimeInput,
  type Booking,
  type Room,
} from "@scheduler/shared";
import { ApiError, api } from "@/lib/api";
import { PaperSheet } from "./PaperSheet";

type Initial = {
  roomId: string;
  title: string;
  instructor: string;
  startMs: number;
  endMs: number;
};

export function BookingSheet({
  mode,
  bookingId,
  rooms,
  initial,
  intent = "edit",
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  bookingId?: string;
  rooms: Room[];
  initial: Initial;
  intent?: "edit" | "delete";
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [roomId, setRoomId] = useState(initial.roomId);
  const [title, setTitle] = useState(initial.title);
  const [instructor, setInstructor] = useState(initial.instructor);
  const [startDate, setStartDate] = useState(toDateInput(initial.startMs));
  const [startTime, setStartTime] = useState(toTimeInput(initial.startMs));
  const [endDate, setEndDate] = useState(toDateInput(initial.endMs));
  const [endTime, setEndTime] = useState(toTimeInput(initial.endMs));
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"edit" | "confirm">(intent === "delete" ? "confirm" : "edit");
  const [saving, setSaving] = useState(false);

  const startMs = fromDateAndTime(startDate, startTime);
  const endMs = fromDateAndTime(endDate, endTime);
  const summary = startMs != null && endMs != null && endMs > startMs ? formatWhen(startMs, endMs) : null;
  const room = rooms.find((item) => item.id === roomId);
  const savedRoom = rooms.find((item) => item.id === initial.roomId) ?? room;
  const confirmText = savedRoom
    ? cancelBookingMessage(initial.title.trim() || title.trim() || "this session", savedRoom.name, formatWhen(initial.startMs, initial.endMs))
    : "Cancel this session?";

  async function save() {
    setError(null);
    if (rooms.length === 0) {
      setError("Add a room before booking one.");
      return;
    }
    if (!title.trim()) {
      setError("Add a session title.");
      return;
    }
    if (!instructor.trim()) {
      setError("Add an instructor.");
      return;
    }
    if (!roomId) {
      setError("Choose a room.");
      return;
    }
    if (startMs == null || endMs == null) {
      setError("Those times aren't valid.");
      return;
    }
    if (endMs <= startMs) {
      setError(END_BEFORE_START);
      return;
    }
    const body = {
      roomId,
      title: title.trim(),
      instructor: instructor.trim(),
      startMs,
      endMs,
    };
    setSaving(true);
    try {
      if (mode === "create") {
        const created = await api<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(body) });
        onSaved(created.id);
      } else if (bookingId) {
        await api<Booking>(`/api/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify(body) });
        onSaved(bookingId);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That didn't work.");
      setSaving(false);
    }
  }

  async function cancelBooking() {
    if (!bookingId) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/bookings/${bookingId}`, { method: "DELETE" });
      onSaved(bookingId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That didn't work.");
      setSaving(false);
    }
  }

  return (
    <PaperSheet open title={phase === "confirm" ? "Cancel this session?" : mode === "create" ? "New session" : "Edit session"} onClose={onClose}>
      {phase === "confirm" ? (
          <div>
            <p className="confirm-sentence">{confirmText}</p>
            {error && (
              <p className="refusal" role="alert">
                {error}
              </p>
            )}
            <div className="sheet-actions">
              <button type="button" className="text-button danger" disabled={saving} onClick={() => void cancelBooking()}>
                Cancel booking
              </button>
              <button type="button" className="ink-button" disabled={saving} onClick={() => (intent === "delete" ? onClose() : setPhase("edit"))}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {summary && <p className="when-line">{summary}</p>}
            <label className="field">
              <span>Session</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span>Instructor</span>
              <input value={instructor} onChange={(event) => setInstructor(event.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              <span className="field-label">
                Room
                {room && <i className="room-swatch" style={{ background: room.color }} aria-hidden="true" />}
              </span>
              <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                <option value="">Choose a room</option>
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="time-grid">
              <label className="field">
                <span>Starts</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="field">
                <span>Start time</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>
              <label className="field">
                <span>Ends</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label className="field">
                <span>End time</span>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p
                  className="refusal"
                  role="alert"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="sheet-actions">
              {mode === "edit" ? (
                <button type="button" className="text-button danger" onClick={() => setPhase("confirm")}>
                  Cancel booking
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="ink-button" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Book room" : "Save changes"}
              </button>
            </div>
          </form>
        )}
    </PaperSheet>
  );
}
