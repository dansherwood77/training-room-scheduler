"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ROOM_COLORS, cancelRoomMessage, offerRoomColors, roomColorLabel, type Room } from "@scheduler/shared";
import { ApiError, api } from "@/lib/api";
import { PaperSheet } from "./PaperSheet";

export function RoomSheet({
  mode,
  room,
  usedColors = [],
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  room?: Room;
  usedColors?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [choices] = useState(() => {
    if (mode === "create") return offerRoomColors(usedColors);
    const named = ROOM_COLORS.map((swatch) => swatch.hex);
    if (room && !named.some((hex) => hex.toLowerCase() === room.color.toLowerCase())) return [room.color, ...named];
    return named;
  });
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : "");
  const [color, setColor] = useState(room?.color ?? choices[0] ?? ROOM_COLORS[0].hex);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"edit" | "confirm">("edit");
  const [saving, setSaving] = useState(false);
  const count = Number(capacity);
  const confirmText = room ? cancelRoomMessage(room.name, room.bookingCount) : "";

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Give the room a name.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setError("Capacity has to be at least 1.");
      return;
    }
    const body = { name: name.trim(), capacity: count, color };
    setSaving(true);
    try {
      if (mode === "create") {
        await api<Room>("/api/rooms", { method: "POST", body: JSON.stringify(body) });
      } else if (room) {
        await api<Room>(`/api/rooms/${room.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That didn't work.");
      setSaving(false);
    }
  }

  async function cancelRoom() {
    if (!room) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/rooms/${room.id}`, { method: "DELETE" });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That didn't work.");
      setSaving(false);
    }
  }

  return (
    <PaperSheet open title={phase === "confirm" ? "Cancel this room?" : mode === "create" ? "New room" : "Edit room"} onClose={onClose}>
      {phase === "confirm" ? (
          <div>
            <p className="confirm-sentence">{confirmText}</p>
            {error && (
              <p className="refusal" role="alert">
                {error}
              </p>
            )}
            <div className="sheet-actions">
              <button type="button" className="text-button danger" disabled={saving} onClick={() => void cancelRoom()}>
                Cancel room
              </button>
              <button type="button" className="ink-button" disabled={saving} onClick={() => setPhase("edit")}>
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
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span>Capacity</span>
              <input
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
            <div className="field">
              <span>Color</span>
              <div className="swatches" role="radiogroup" aria-label="Color">
                {choices.map((hex) => {
                  const on = color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={roomColorLabel(hex)}
                      className={on ? "swatch on" : "swatch"}
                      style={{ background: hex }}
                      onClick={() => setColor(hex)}
                    />
                  );
                })}
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p className="refusal" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="sheet-actions">
              {mode === "edit" ? (
                <button type="button" className="text-button danger" onClick={() => setPhase("confirm")}>
                  Cancel room
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="ink-button" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Add room" : "Save changes"}
              </button>
            </div>
          </form>
        )}
    </PaperSheet>
  );
}
