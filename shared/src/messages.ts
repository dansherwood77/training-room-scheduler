export const END_BEFORE_START = "End time has to be after the start.";
export const ROOM_MISSING = "That room no longer exists.";
export const BOOKING_MISSING = "That booking no longer exists.";

export function overlapMessage(
  roomName: string,
  title: string,
  instructor: string,
  when: string,
): string {
  return `${roomName} is already booked then, for ${title} with ${instructor}, ${when}.`;
}

export function duplicateRoomMessage(name: string): string {
  return `There's already a room named ${name}.`;
}

export function cancelBookingMessage(title: string, roomName: string, when: string): string {
  return `Cancel ${title} in ${roomName}? The room is free from ${when}.`;
}

export function cancelRoomMessage(name: string, bookingCount: number): string {
  if (bookingCount === 0) return `Cancel ${name}? This room has no bookings.`;
  if (bookingCount === 1) return `Cancel ${name}? 1 booking on this room will be cancelled too.`;
  return `Cancel ${name}? ${bookingCount} bookings on this room will be cancelled too.`;
}
