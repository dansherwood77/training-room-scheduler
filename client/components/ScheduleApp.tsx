"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  dayEndMs,
  monthGrid,
  shiftAnchor,
  startOfDay,
  viewHeading,
  weekBounds,
  type Booking,
  type CalendarView,
  type Room,
} from "@scheduler/shared";
import { ApiError, api } from "@/lib/api";
import { BookingSheet } from "./BookingSheet";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { RoomRail } from "./RoomRail";
import { RoomSheet } from "./RoomSheet";
import { WeekView } from "./WeekView";

type View = CalendarView;

const EASE = [0.22, 1, 0.36, 1] as const;

const paneVariants = {
  enter: { opacity: 0, pointerEvents: "none" as const },
  center: {
    opacity: 1,
    pointerEvents: "auto" as const,
    transition: { duration: 0.42, ease: EASE },
  },
  exit: {
    opacity: 0,
    pointerEvents: "none" as const,
    transition: { duration: 0.22, ease: EASE },
  },
};

function coversNow(anchorMs: number, view: View, nowMs: number): boolean {
  if (view === "day") return startOfDay(anchorMs).toMillis() === startOfDay(nowMs).toMillis();
  if (view === "week") return weekBounds(anchorMs).startMs === weekBounds(nowMs).startMs;
  return monthGrid(anchorMs).monthStartMs === monthGrid(nowMs).monthStartMs;
}

type BookingDialog =
  | { mode: "create"; roomId: string; startMs: number; endMs: number }
  | { mode: "edit"; booking: Booking; intent: "edit" | "delete" };

type RoomDialog = { mode: "create" } | { mode: "edit"; room: Room };

export function ScheduleApp() {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [anchorMs, setAnchorMs] = useState<number | null>(null);
  const [view, setView] = useState<View>("week");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [bookingDialog, setBookingDialog] = useState<BookingDialog | null>(null);
  const [roomDialog, setRoomDialog] = useState<RoomDialog | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    setNowMs(now);
    setAnchorMs(now);
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loaded = useMemo(() => (anchorMs == null ? null : monthGrid(anchorMs)), [anchorMs]);
  const requestId = useRef(0);

  const range = useMemo(() => {
    if (anchorMs == null || loaded == null) return null;
    if (view === "day") {
      const day = startOfDay(anchorMs).toMillis();
      return { startMs: day, endMs: dayEndMs(day), days: [day], cells: null };
    }
    if (view === "week") {
      const week = weekBounds(anchorMs);
      return { startMs: week.startMs, endMs: week.endMs, days: week.days, cells: null };
    }
    return { startMs: loaded.startMs, endMs: loaded.endMs, days: null, cells: loaded.days };
  }, [anchorMs, view, loaded]);

  const visibleBookings = useMemo(() => {
    if (!range) return [];
    return bookings.filter((booking) => booking.startMs < range.endMs && booking.endMs > range.startMs);
  }, [bookings, range]);

  const windowStart = loaded?.startMs ?? null;
  const windowEnd = loaded?.endMs ?? null;

  const refresh = useCallback(async () => {
    if (windowStart == null || windowEnd == null) return;
    const id = ++requestId.current;
    try {
      const query = new URLSearchParams({ from: String(windowStart), to: String(windowEnd) });
      const [nextRooms, nextBookings] = await Promise.all([
        api<Room[]>("/api/rooms"),
        api<Booking[]>(`/api/bookings?${query.toString()}`),
      ]);
      if (id !== requestId.current) return;
      setRooms(nextRooms);
      setBookings(nextBookings);
      setRoomId((current) => (current && !nextRooms.some((room) => room.id === current) ? null : current));
      setStatus("ready");
      setLoadError(null);
    } catch (caught) {
      if (id !== requestId.current) return;
      setStatus("error");
      setLoadError(caught instanceof ApiError ? caught.message : "The schedule couldn't load.");
    }
  }, [windowStart, windowEnd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!freshId) return;
    const timer = window.setTimeout(() => setFreshId(null), 800);
    return () => window.clearTimeout(timer);
  }, [freshId]);

  const changeView = useCallback((next: View) => {
    setView((current) => (next === current ? current : next));
  }, []);

  const shift = useCallback((direction: -1 | 1) => {
    setMoveError(null);
    setAnchorMs((current) => (current == null ? current : shiftAnchor(current, view, direction)));
  }, [view]);

  const moveBooking = useCallback(
    async (booking: Booking, startMs: number, endMs: number) => {
      setMoveError(null);
      setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, startMs, endMs } : item)));
      try {
        await api<Booking>(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            roomId: booking.roomId,
            title: booking.title,
            instructor: booking.instructor,
            attendees: booking.attendees,
            startMs,
            endMs,
          }),
        });
        await refresh();
      } catch (caught) {
        setMoveError(caught instanceof ApiError ? caught.message : "That session couldn't move.");
        await refresh();
      }
    },
    [refresh],
  );

  if (anchorMs == null || !range) {
    return (
      <main className="page">
        <p className="wordmark">Training rooms</p>
      </main>
    );
  }

  const heading = viewHeading(anchorMs, view);
  const away = nowMs != null && !coversNow(anchorMs, view, nowMs);
  const previousLabel = view === "day" ? "Previous day" : view === "week" ? "Previous week" : "Previous month";
  const nextLabel = view === "day" ? "Next day" : view === "week" ? "Next week" : "Next month";
  const emptyCopy =
    rooms.length === 0
      ? "Add a room first."
      : `Nothing booked ${view === "day" ? "this day" : view === "week" ? "this week" : "this month"}.`;

  function openCreate(startMs: number, endMs: number) {
    setRoomDialog(null);
    setMoveError(null);
    setBookingDialog({ mode: "create", roomId: roomId ?? "", startMs, endMs });
  }

  function openEdit(booking: Booking) {
    setRoomDialog(null);
    setMoveError(null);
    setBookingDialog({ mode: "edit", booking, intent: "edit" });
  }

  function openDelete(booking: Booking) {
    setRoomDialog(null);
    setMoveError(null);
    setBookingDialog({ mode: "edit", booking, intent: "delete" });
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ layout: { type: "spring", bounce: 0.12, visualDuration: 0.48 } }}>
      <main className="page">
        <header className="top">
          <div>
            <p className="wordmark">Training rooms</p>
            <div className="date-line">
              <button type="button" className="shift" aria-label={previousLabel} onClick={() => shift(-1)}>
                ‹
              </button>
              <div className="heading-slot">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={`${view}-${heading.title}`}
                    className="heading-swap"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.32, ease: EASE }}
                  >
                    <p className="kicker">{heading.kicker}</p>
                    <h1>{heading.title}</h1>
                  </motion.div>
                </AnimatePresence>
              </div>
              <button type="button" className="shift" aria-label={nextLabel} onClick={() => shift(1)}>
                ›
              </button>
              {away && (
                <button type="button" className="text-button today-return" onClick={() => setAnchorMs(Date.now())}>
                  Today
                </button>
              )}
            </div>
          </div>
          <div className="view-side">
            <div className="view-switch" role="group" aria-label="Calendar view">
              <button type="button" aria-pressed={view === "day"} onClick={() => changeView("day")}>
                Day
                {view === "day" && (
                  <motion.span layoutId="view-sun" className="sun-underline" transition={{ type: "spring", stiffness: 340, damping: 32 }} />
                )}
              </button>
              <button type="button" aria-pressed={view === "week"} onClick={() => changeView("week")}>
                Week
                {view === "week" && (
                  <motion.span layoutId="view-sun" className="sun-underline" transition={{ type: "spring", stiffness: 340, damping: 32 }} />
                )}
              </button>
              <button type="button" aria-pressed={view === "month"} onClick={() => changeView("month")}>
                Month
                {view === "month" && (
                  <motion.span layoutId="view-sun" className="sun-underline" transition={{ type: "spring", stiffness: 340, damping: 32 }} />
                )}
              </button>
            </div>
          </div>
        </header>

        {status === "error" && loadError && (
          <p className="load-error" role="alert">
            {loadError}
          </p>
        )}
        {moveError && (
          <p className="load-error" role="alert">
            {moveError}
          </p>
        )}
        {status === "ready" && visibleBookings.length === 0 && <p className="empty-line">{emptyCopy}</p>}

        <div className="shell">
          <RoomRail
            rooms={rooms}
            roomId={roomId}
            onSelect={setRoomId}
            onAdd={() => {
              setBookingDialog(null);
              setRoomDialog({ mode: "create" });
            }}
            onEdit={(room) => {
              setBookingDialog(null);
              setRoomDialog({ mode: "edit", room });
            }}
          />
          <section className="schedule" aria-label={view === "day" ? "Day schedule" : view === "week" ? "Week schedule" : "Month schedule"}>
            <div className="view-stage">
              <AnimatePresence initial={false}>
                <motion.div
                  key={view}
                  className="view-layer"
                  variants={paneVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {view === "day" && range.days ? (
                    <DayView
                      day={range.days[0]}
                      bookings={visibleBookings}
                      focusRoomId={roomId}
                      freshId={freshId}
                      nowMs={nowMs}
                      onCreate={openCreate}
                      onEdit={openEdit}
                      onMove={(booking, startMs, endMs) => void moveBooking(booking, startMs, endMs)}
                      onDelete={openDelete}
                    />
                  ) : view === "week" && range.days ? (
                    <WeekView
                      days={range.days}
                      bookings={visibleBookings}
                      focusRoomId={roomId}
                      freshId={freshId}
                      nowMs={nowMs}
                      onCreate={openCreate}
                      onEdit={openEdit}
                      onMove={(booking, startMs, endMs) => void moveBooking(booking, startMs, endMs)}
                      onDelete={openDelete}
                      onOpenDay={(day) => {
                        setAnchorMs(day);
                        changeView("day");
                      }}
                    />
                  ) : range.cells ? (
                    <MonthView
                      cells={range.cells}
                      bookings={visibleBookings}
                      focusRoomId={roomId}
                      freshId={freshId}
                      nowMs={nowMs}
                      onCreate={openCreate}
                      onEdit={openEdit}
                      onMove={(booking, startMs, endMs) => void moveBooking(booking, startMs, endMs)}
                      onDelete={openDelete}
                      onFocusDay={(day) => {
                        setAnchorMs(day);
                        changeView("day");
                      }}
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="hint">Drag to create or move a session. Drag an edge to shorten or lengthen it. Click it to edit. Click × to delete.</p>
          </section>
        </div>

        {bookingDialog && (
          <BookingSheet
            key={bookingDialog.mode === "edit" ? `${bookingDialog.booking.id}-${bookingDialog.intent}` : `new-${bookingDialog.startMs}-${bookingDialog.endMs}`}
            mode={bookingDialog.mode}
            bookingId={bookingDialog.mode === "edit" ? bookingDialog.booking.id : undefined}
            intent={bookingDialog.mode === "edit" ? bookingDialog.intent : "edit"}
            rooms={rooms}
            initial={
              bookingDialog.mode === "edit"
                ? {
                    roomId: bookingDialog.booking.roomId,
                    title: bookingDialog.booking.title,
                    instructor: bookingDialog.booking.instructor,
                    attendees: bookingDialog.booking.attendees,
                    startMs: bookingDialog.booking.startMs,
                    endMs: bookingDialog.booking.endMs,
                  }
                : {
                    roomId: bookingDialog.roomId,
                    title: "",
                    instructor: "",
                    startMs: bookingDialog.startMs,
                    endMs: bookingDialog.endMs,
                  }
            }
            onClose={() => setBookingDialog(null)}
            onSaved={(id) => {
              setFreshId(id);
              setBookingDialog(null);
              void refresh();
            }}
          />
        )}
        {roomDialog && (
          <RoomSheet
            key={roomDialog.mode === "edit" ? roomDialog.room.id : "new-room"}
            mode={roomDialog.mode}
            room={roomDialog.mode === "edit" ? roomDialog.room : undefined}
            usedColors={rooms.map((room) => room.color)}
            onClose={() => setRoomDialog(null)}
            onSaved={() => {
              if (roomDialog.mode === "edit") {
                setRoomId((current) => current);
              }
              setRoomDialog(null);
              void refresh();
            }}
          />
        )}
      </main>
    </MotionConfig>
  );
}
