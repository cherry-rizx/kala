import type { BookingStatus } from "@/lib/booking/status";

export type Booking = {
  id: string;
  pelangganId: string;
  namaPelanggan: string;
  tanggalSewa: Date;
  status: BookingStatus;
  createdAt: Date;
};