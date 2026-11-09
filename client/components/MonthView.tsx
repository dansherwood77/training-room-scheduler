"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  atTime,
  dayEndMs,
  formatSpan,
  formatTime,
  isSameDay,
  type Booking,
  type MonthCell,
} from "@scheduler/shared";
import { fitMonthItems } from "@/lib/fitMonth";
import { moveToDay } from "@/lib/moveSession";

export function MonthView({
  cells,
  bookings,
  focusRoomId,
  freshId,
  nowMs,
  onCreate,
  onEdit,
  onMove,
  onDelete,
  onFocusDay,
}: {
  cells: MonthCell[];
  bookings: Booking[];
  focusRoomId: string | null;
  freshId: string | null;
  nowMs: number | null;
  onCreate: (startMs: number, endMs: number) => void;
  onEdit: (booking: Booking) => void;
  onMove: (booking: Booking, startMs: number, endMs: number) => void;
  onDelete: (booking: Booking) => void;
  onFocusDay: (dayStartMs: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ anchor: number; current: number } | null>(null);
  const moveRef = useRef<{
    booking: Booking;
    originX: number;
    originY: number;
    moved: boolean;
    next: { startMs: number; endMs: number } | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const [span, setSpan] = useState<{ start: number; end: number } | null>(null);
  const [preview, setPreview] = useState<{ id: string; startMs: number; endMs: number } | null>(null);

  const shown = preview
    ? bookings.map((booking) => (booking.id === preview.id ? { ...booking, startMs: preview.startMs, endMs: preview.endMs } : booking))
    : bookings;

  const labels = cells.slice(0, 7).map((cell) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" }).format(new Date(cell.startMs)),
  );

  function dayFromPoint(x: number, y: number): number | null {
    const node = document.elementFromPoint(x, y);
    const cell = node?.closest<HTMLElement>("[data-day]");
    if (!cell) return null;
    const value = Number(cell.dataset.day);
    return Number.isFinite(value) ? value : null;
  }

  function finish() {
    const drag = dragRef.current;
    dragRef.current = null;
    setSpan(null);
    if (!drag) return;
    const startDay = Math.min(drag.anchor, drag.current);
    const endDay = Math.max(drag.anchor, drag.current);
    const startMs = atTime(startDay, 9, 0);
    const endMs = isSameDay(startDay, endDay) ? atTime(startDay, 10, 0) : atTime(endDay, 17, 0);
    window.setTimeout(() => onCreate(startMs, endMs), 0);
  }

  return (
    <div className="period">
      <div className="month-scroll" ref={scrollRef}>
      <div className="month" aria-hidden="true">
        {labels.map((label) => (
          <div key={label} className="month-dow">
            {label}
          </div>
        ))}
      </div>
      <div
        className="month"
        ref={gridRef}
        role="grid"
        aria-label="Month"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as HTMLElement).closest("[data-booking], [data-open-day]")) return;
          const day = dayFromPoint(event.clientX, event.clientY);
          if (day == null) return;
          event.preventDefault();
          try {
            gridRef.current?.setPointerCapture(event.pointerId);
          } catch {
            // The gesture still tracks if the pointer is already gone.
          }
          dragRef.current = { anchor: day, current: day };
          setSpan({ start: day, end: day });
        }}
        onPointerMove={(event) => {
          const move = moveRef.current;
          if (move) {
            const day = dayFromPoint(event.clientX, event.clientY);
            if (!move.moved && Math.hypot(event.clientX - move.originX, event.clientY - move.originY) >= 6) {
              move.moved = true;
            }
            if (move.moved && day != null) {
              move.next = moveToDay(move.booking, day);
              setPreview({ id: move.booking.id, ...move.next });
            }
            return;
          }
          const drag = dragRef.current;
          if (!drag) return;
          const day = dayFromPoint(event.clientX, event.clientY);
          if (day != null) drag.current = day;
          const start = Math.min(drag.anchor, drag.current);
          const end = Math.max(drag.anchor, drag.current);
          setSpan((current) => (current && current.start === start && current.end === end ? current : { start, end }));
        }}
        onPointerUp={() => {
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
          if (moveRef.current) {
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
        {cells.map((cell) => {
          const selected = span != null && cell.startMs >= span.start && cell.startMs <= span.end;
          const today = nowMs != null && nowMs >= cell.startMs && nowMs < dayEndMs(cell.startMs);
          const onDay = shown.filter((booking) => booking.startMs < dayEndMs(cell.startMs) && booking.endMs > cell.startMs);
          const dayNumber = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(
            new Date(cell.startMs),
          );
          return (
            <div
              key={cell.startMs}
              role="gridcell"
              data-day={cell.startMs}
              className={["cell", cell.inMonth ? "" : "outside", selected ? "in-range" : ""].filter(Boolean).join(" ")}
            >
              <button
                type="button"
                data-open-day
                className={today ? "cell-num today" : "cell-num"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onFocusDay(cell.startMs)}
              >
                {dayNumber}
              </button>
              <FitList total={onDay.length}>
              {(shownCount) => {
              const visible = onDay.slice(0, shownCount);
              const extra = onDay.length - visible.length;
              return (
              <>
              {visible.map((booking) => {
                const dimmed = focusRoomId != null && booking.roomId !== focusRoomId;
                return (
                <div
                  key={booking.id}
                  role="button"
                  tabIndex={0}
                  data-booking
                  className={["month-item", dimmed ? "dim" : "", freshId === booking.id ? "fresh" : ""].filter(Boolean).join(" ")}
                  style={{ background: dimmed ? "var(--paper)" : booking.roomColor, borderRadius: 10 }}
                  aria-label={`${booking.title}, ${booking.instructor}, ${formatSpan(booking.startMs, booking.endMs)}, ${booking.roomName}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (event.button !== 0) return;
                    moveRef.current = {
                      booking,
                      originX: event.clientX,
                      originY: event.clientY,
                      moved: false,
                      next: null,
                    };
                    try {
                      gridRef.current?.setPointerCapture(event.pointerId);
                    } catch {
                      // The gesture still tracks if the pointer is already gone.
                    }
                  }}
                  onClick={() => onEdit(booking)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onEdit(booking);
                  }}
                >
                  <span className="chip-meta">
                    {isSameDay(booking.startMs, cell.startMs) ? formatTime(booking.startMs) : "Continues"}
                  </span>
                  <span className="chip-title">{booking.title}</span>
                  <span className="chip-room">{booking.roomName}</span>
                  <span className="chip-meta who">{booking.instructor}</span>
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Delete ${booking.title}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(booking);
                    }}
                  >
                    ×
                  </button>
                </div>
                );
              })}
              {extra > 0 && (
                <button
                  type="button"
                  className="more"
                  data-booking
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onFocusDay(cell.startMs)}
                >
                  +{extra} more
                </button>
              )}
              </>
              );
              }}
              </FitList>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

function FitList({ total, children }: { total: number; children: (shown: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const heights = useRef<number[]>([]);
  const width = useRef(-1);
  const [shown, setShown] = useState(total);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const items = [...el.querySelectorAll<HTMLElement>(".month-item")];
      // A day can mount empty, then gain its sessions when Today (or another month) finishes loading.
      // Until every session has been measured, render them all. Otherwise the cell stays on "+N more".
      if (heights.current.length !== total && items.length !== total) {
        heights.current = [];
        setShown(total);
        return;
      }
      if (el.clientWidth !== width.current && items.length !== total) {
        width.current = el.clientWidth;
        heights.current = [];
        setShown(total);
        return;
      }
      width.current = el.clientWidth;
      if (items.length === total) {
        heights.current = items.map((item) => item.offsetHeight + Number.parseFloat(getComputedStyle(item).marginTop || "0"));
      }
      if (el.clientHeight <= 0 || heights.current.length !== total) return;
      const fit = fitMonthItems(el.clientHeight, heights.current, 18);
      setShown((current) => (current === fit ? current : fit));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [total, shown]);
  return (
    <div className="cell-list" ref={ref}>
      {children(shown)}
    </div>
  );
}
