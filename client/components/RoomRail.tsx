"use client";

import type { Room } from "@scheduler/shared";
import { people } from "@/lib/wash";

export function RoomRail({
  rooms,
  roomId,
  onSelect,
  onAdd,
  onEdit,
}: {
  rooms: Room[];
  roomId: string | null;
  onSelect: (roomId: string | null) => void;
  onAdd: () => void;
  onEdit: (room: Room) => void;
}) {
  return (
    <aside className="rail" aria-label="Rooms">
      <p className="rail-label">Rooms</p>
      <div className={roomId === null ? "room selected" : "room"}>
        <button
          type="button"
          className="room-select"
          aria-pressed={roomId === null}
          onClick={() => onSelect(null)}
        >
          <span className="room-name">All rooms</span>
          <span className="room-meta">{rooms.length === 1 ? "1 room" : `${rooms.length} rooms`}</span>
        </button>
      </div>
      {rooms.map((room) => {
        const selected = room.id === roomId;
        return (
          <div key={room.id} className={selected ? "room selected" : "room"} style={selected ? { background: room.color } : undefined}>
            <button
              type="button"
              className="room-select"
              aria-pressed={selected}
              onClick={() => onSelect(room.id)}
            >
              <span className="room-name">
                <i className="room-swatch" style={{ background: room.color }} aria-hidden="true" />
                {room.name}
              </span>
              <span className="room-meta">{people(room.capacity)}</span>
            </button>
            <button type="button" className="text-button" onClick={() => onEdit(room)}>
              Edit
            </button>
          </div>
        );
      })}
      <button type="button" className="text-button add-room" onClick={onAdd}>
        + Add a room
      </button>
    </aside>
  );
}
