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
  startMs: number;
  endMs: number;
};
