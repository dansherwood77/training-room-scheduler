export type Room = {
  id: string;
  name: string;
  color: string;
  capacity: number;
  bookingCount: number;
};

export type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  roomColor: string;
  title: string;
  instructor: string;
  attendees: number | null;
  startMs: number;
  endMs: number;
};
