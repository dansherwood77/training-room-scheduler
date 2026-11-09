"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  addMinutes,
  clipToDays,
  dayEndMs,
  formatSpan,
  formatTime,
  fractionOfDay,
  hoursInDay,
  packLanes,
  snapToQuarter,
  type Booking,
} from "@scheduler/shared";
import { moveByPointer, resizeEdge } from "@/lib/moveSession";

type Draft = { startMs: number; endMs: number };

type Drag = {
  anchorMs: number;
  originX: number;
  originY: number;
  moved: boolean;
  pointerMs: number;
};

function rangeFrom(anchorMs: number, pointerMs: number): Draft {
  const anchor = snapToQuarter(anchorMs);
  const pointer = snapToQuarter(pointerMs);
  if (pointer >= anchor) return { startMs: anchor, endMs: addMinutes(pointer, 15) };
  return { startMs: pointer, endMs: addMinutes(anchor, 15) };
}

export function WeekView({
  days,
  bookings,
  focusRoomId,
  freshId,
  nowMs,
  onCreate,
  onEdit,
  onMove,
  onDelete,
  onOpenDay,
}: {
  days: number[];
  bookings: Booking[];
  focusRoomId: string | null;
  freshId: string | null;
  nowMs: number | null;
  onCreate: (startMs: number, endMs: number) => void;
  onEdit: (booking: Booking) => void;
  onMove: (booking: Booking, startMs: number, endMs: number) => void;
  onDelete: (booking: Booking) => void;
  onOpenDay: (day: number) => void;
}) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{ id: string; startMs: number; endMs: number } | null>(null);
  const moveRef = useRef<{
    booking: Booking;
    offset: number;
    originX: number;
    originY: number;
    moved: boolean;
    next: { startMs: number; endMs: number } | null;
  } | null>(null);
  const resizeRef = useRef<{
    booking: Booking;
    edge: "start" | "end";
    originX: number;
    originY: number;
    moved: boolean;
    next: { startMs: number; endMs: number } | null;
  } | null>(null);
  const daysRef = useRef(days);
  daysRef.current = days;

  function pointToMs(clientX: number, clientY: number): number | null {
    const currentDays = daysRef.current;
    let bestIndex = 0;
    let bestDist = Infinity;
    currentDays.forEach((_, index) => {
      const col = colRefs.current[index];
      if (!col) return;
      const rect = col.getBoundingClientRect();
      const dist = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });
    const col = colRefs.current[bestIndex];
    const dayStart = currentDays[bestIndex];
    if (!col || dayStart == null) return null;
    const rect = col.getBoundingClientRect();
    if (rect.height <= 0) return null;
    // Y is not clamped, so a drag past the bottom of a day continues into the next one.
    const ratio = (clientY - rect.top) / rect.height;
    return dayStart + ratio * (dayEndMs(dayStart) - dayStart);
  }

  function publish(drag: Drag) {
    if (!drag.moved) return;
    const next = rangeFrom(drag.anchorMs, drag.pointerMs);
    setDraft((current) => {
      if (current && current.startMs === next.startMs && current.endMs === next.endMs) return current;
      return next;
    });
  }

  function finish() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setDraft(null);
    const chosen = drag.moved
      ? rangeFrom(drag.anchorMs, drag.pointerMs)
      : { startMs: drag.anchorMs, endMs: addMinutes(drag.anchorMs, 60) };
    window.setTimeout(() => onCreate(chosen.startMs, chosen.endMs), 0);
  }

  const nowRef = useRef(nowMs);
  nowRef.current = nowMs;

  const shown = preview
    ? bookings.map((booking) => (booking.id === preview.id ? { ...booking, startMs: preview.startMs, endMs: preview.endMs } : booking))
    : bookings;

  useEffect(() => {
    const scroller = scrollRef.current;
    const now = nowRef.current;
    if (!scroller || now == null) return;
    const today = days.findIndex((day) => now >= day && now < dayEndMs(day));
    if (today < 0) return;
    const column = colRefs.current[today];
    if (!column) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    scroller.scrollLeft += columnRect.left - scrollerRect.left - 68;
  }, [days]);

  const marks = days[0] != null ? hoursInDay(days[0]).filter((mark) => mark.hour % 3 === 0) : [];
  const draftSegments = draft ? clipToDays(draft.startMs, draft.endMs, days) : [];

  return (
    <div className="period">
      <div
      className="week-scroll"
      ref={scrollRef}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest("[data-booking]")) return;
        if (!(event.target as HTMLElement).closest("[data-day-col]")) return;
        const mapped = pointToMs(event.clientX, event.clientY);
        if (mapped == null) return;
        event.preventDefault();
        try {
          scrollRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // The gesture still tracks if the pointer is already gone.
        }
        const anchorMs = snapToQuarter(mapped);
        dragRef.current = {
          anchorMs,
          originX: event.clientX,
          originY: event.clientY,
          moved: false,
          pointerMs: mapped,
        };
      }}
      onPointerMove={(event) => {
        const resize = resizeRef.current;
        if (resize) {
          const mapped = pointToMs(event.clientX, event.clientY);
          if (!resize.moved && Math.hypot(event.clientX - resize.originX, event.clientY - resize.originY) >= 6) {
            resize.moved = true;
          }
          if (resize.moved && mapped != null) {
            resize.next = resizeEdge(resize.booking, resize.edge, mapped);
            setPreview({ id: resize.booking.id, ...resize.next });
          }
          return;
        }
        const move = moveRef.current;
        if (move) {
          const mapped = pointToMs(event.clientX, event.clientY);
          if (!move.moved && Math.hypot(event.clientX - move.originX, event.clientY - move.originY) >= 6) {
            move.moved = true;
          }
          if (move.moved && mapped != null) {
            move.next = moveByPointer(move.booking, mapped, move.offset);
            setPreview({ id: move.booking.id, ...move.next });
          }
          return;
        }
        const drag = dragRef.current;
        if (!drag) return;
        const mapped = pointToMs(event.clientX, event.clientY);
        if (mapped != null) drag.pointerMs = mapped;
        if (!drag.moved && Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) >= 6) {
          drag.moved = true;
        }
        publish(drag);
      }}
      onPointerUp={() => {
        const resize = resizeRef.current;
        if (resize) {
          resizeRef.current = null;
          setPreview(null);
          suppressClick.current = true;
          if (
            resize.moved &&
            resize.next &&
            (resize.next.startMs !== resize.booking.startMs || resize.next.endMs !== resize.booking.endMs)
          ) {
            onMove(resize.booking, resize.next.startMs, resize.next.endMs);
          } else if (!resize.moved) {
            onEdit(resize.booking);
          }
          return;
        }
        const move = moveRef.current;
        if (move) {
          moveRef.current = null;
          setPreview(null);
          suppressClick.current = true;
          if (move.moved && move.next && move.next.startMs !== move.booking.startMs) {
            onMove(move.booking, move.next.startMs, move.next.endMs);
          } else if (!move.moved) {
            onEdit(move.booking);
          }
          return;
        }
        finish();
      }}
      onPointerCancel={() => {
        if (resizeRef.current || moveRef.current) {
          resizeRef.current = null;
          moveRef.current = null;
          setPreview(null);
          return;
        }
        finish();
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="week-head">
        <div />
        {days.map((day) => {
          const date = new Date(day);
          const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" }).format(date);
          const dayNumber = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(date);
          const today = nowMs != null && nowMs >= day && nowMs < dayEndMs(day);
          return (
            <div key={day} className="day-head">
              <span className="dow">{weekday}</span>
              <button
                type="button"
                className={today ? "date-num today" : "date-num"}
                onClick={() => onOpenDay(day)}
              >
                {dayNumber}
              </button>
            </div>
          );
        })}
      </div>
      <div className="week-body">
        <div className="hour-gutter" aria-hidden="true">
          {marks.map((mark) => {
            const y = `${fractionOfDay(mark.ms, days[0]) * 100}%`;
            return (
              <span key={mark.hour} className={mark.hour === 0 ? "hour-label first" : "hour-label"} style={{ top: y }}>
                {mark.label}
              </span>
            );
          })}
        </div>
        {days.map((day, index) => {
          const dayBookings = shown.flatMap((booking) => {
            const parts = clipToDays(booking.startMs, booking.endMs, [day]);
            return parts.map((part, partIndex) => ({
              ...part,
              booking,
              anchor: partIndex === 0 && clipToDays(booking.startMs, booking.endMs, days)[0]?.dayStartMs === day,
            }));
          });
          const placed = packLanes(dayBookings);
          const lines = hoursInDay(day).filter((mark) => mark.hour % 3 === 0 && mark.hour !== 0);
          const showNow = nowMs != null && nowMs >= day && nowMs < dayEndMs(day);
          return (
            <div
              key={day}
              className="day-col"
              data-day-col
              ref={(node) => {
                colRefs.current[index] = node;
              }}
            >
              {lines.map((mark) => (
                <div key={mark.hour} className="hour-line" style={{ top: `${fractionOfDay(mark.ms, day) * 100}%` }} />
              ))}
              {placed.map((item) => {
                const top = fractionOfDay(item.startMs, day) * 100;
                const height = Math.max((fractionOfDay(item.endMs, day) - fractionOfDay(item.startMs, day)) * 100, 0);
                const dimmed = focusRoomId != null && item.booking.roomId !== focusRoomId;
                return (
                  <div
                    key={`${item.booking.id}-${day}`}
                    role="button"
                    tabIndex={0}
                    data-booking
                    className={["chip", dimmed ? "dim" : "", freshId === item.booking.id && item.anchor ? "fresh" : ""].filter(Boolean).join(" ")}
                    style={{
                      top: `calc(${top}% + 2px)`,
                      height: `calc(${height}% - 4px)`,
                      left: `calc(${(item.lane / item.lanes) * 100}% + 4px)`,
                      width: `calc(${(1 / item.lanes) * 100}% - 8px)`,
                      background: dimmed ? "var(--paper)" : item.booking.roomColor,
                      borderRadius: 12,
                    }}
                    aria-label={`${item.booking.title}, ${item.booking.instructor}, ${formatSpan(item.booking.startMs, item.booking.endMs)}, ${item.booking.roomName}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (event.button !== 0) return;
                      const mapped = pointToMs(event.clientX, event.clientY);
                      moveRef.current = {
                        booking: item.booking,
                        offset: (mapped ?? item.booking.startMs) - item.booking.startMs,
                        originX: event.clientX,
                        originY: event.clientY,
                        moved: false,
                        next: null,
                      };
                      try {
                        scrollRef.current?.setPointerCapture(event.pointerId);
                      } catch {
                        // The gesture still tracks if the pointer is already gone.
                      }
                    }}
                    onClick={() => onEdit(item.booking)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onEdit(item.booking);
                    }}
                  >
                    {item.isFirst && (
                      <button
                        type="button"
                        className="chip-edge top"
                        aria-label={`Change the start of ${item.booking.title}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (event.button !== 0) return;
                          resizeRef.current = {
                            booking: item.booking,
                            edge: "start",
                            originX: event.clientX,
                            originY: event.clientY,
                            moved: false,
                            next: null,
                          };
                          try {
                            scrollRef.current?.setPointerCapture(event.pointerId);
                          } catch {
                            // The gesture still tracks if the pointer is already gone.
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    {item.isLast && (
                      <button
                        type="button"
                        className="chip-edge bottom"
                        aria-label={`Change the end of ${item.booking.title}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (event.button !== 0) return;
                          resizeRef.current = {
                            booking: item.booking,
                            edge: "end",
                            originX: event.clientX,
                            originY: event.clientY,
                            moved: false,
                            next: null,
                          };
                          try {
                            scrollRef.current?.setPointerCapture(event.pointerId);
                          } catch {
                            // The gesture still tracks if the pointer is already gone.
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    <span className="chip-meta time">{formatTime(item.booking.startMs)}</span>
                    <span className="chip-title">{item.booking.title}</span>
                    <span className="chip-room">{item.booking.roomName}</span>
                    <span className="chip-meta who">{item.booking.instructor}</span>
                    <button
                      type="button"
                      className="chip-x"
                      aria-label={`Delete ${item.booking.title}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item.booking);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {draftSegments
                .filter((segment) => segment.dayStartMs === day)
                .map((segment) => {
                  const top = fractionOfDay(segment.startMs, day) * 100;
                  const height = Math.max((fractionOfDay(segment.endMs, day) - fractionOfDay(segment.startMs, day)) * 100, 1.2);
                  return (
                    <motion.div
                      key={`draft-${day}`}
                      className="draft"
                      initial={false}
                      animate={{ top: `${top}%`, height: `${height}%` }}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40, mass: 0.4 }}
                    >
                      {segment.isFirst && draft && <span className="draft-time">{formatTime(draft.startMs)}</span>}
                      {height > 8 && segment.isFirst && <span className="draft-name">New session</span>}
                      {segment.isLast && draft && <span className="draft-time end">{formatTime(draft.endMs)}</span>}
                    </motion.div>
                  );
                })}
              {showNow && nowMs != null && (
                <div className="now-line" style={{ top: `${fractionOfDay(nowMs, day) * 100}%` }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
