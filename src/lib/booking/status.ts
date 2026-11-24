export const BOOKING_STATUS = {
  MENUNGGU_BAYAR: "menunggu_bayar",
  TERKONFIRMASI: "terkonfirmasi",
  MENUNGGU_REFUND: "menunggu_refund",
  DIBATALKAN: "dibatalkan",
  HANGUS: "hangus",
  SEDANG_DISEWA: "sedang_disewa",
  MENUNGGU_DENDA: "menunggu_denda",
  SELESAI: "selesai",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const DAFTAR_STATUS = Object.values(BOOKING_STATUS) as BookingStatus[];

const LABEL_STATUS: Record<BookingStatus, string> = {
  menunggu_bayar: "Menunggu pembayaran",
  terkonfirmasi: "Terkonfirmasi",
  menunggu_refund: "Menunggu refund",
  dibatalkan: "Dibatalkan",
  hangus: "Hangus",
  sedang_disewa: "Sedang disewa",
  menunggu_denda: "Menunggu pelunasan denda",
  selesai: "Selesai",
};

const WARNA_STATUS: Record<BookingStatus, string> = {
  menunggu_bayar: "bg-amber-100 text-amber-900",
  terkonfirmasi: "bg-emerald-100 text-emerald-900",
  menunggu_refund: "bg-orange-100 text-orange-900",
  dibatalkan: "bg-stone-200 text-stone-700",
  hangus: "bg-stone-200 text-stone-700",
  sedang_disewa: "bg-sky-100 text-sky-900",
  menunggu_denda: "bg-rose-100 text-rose-900",
  selesai: "bg-emerald-50 text-emerald-800",
};

export function isBookingStatus(nilai: unknown): nilai is BookingStatus {
  return typeof nilai === "string" && (DAFTAR_STATUS as string[]).includes(nilai);
}

export function labelStatus(status: string): string {
  return isBookingStatus(status) ? LABEL_STATUS[status] : status;
}

export function warnaStatus(status: string): string {
  return isBookingStatus(status) ? WARNA_STATUS[status] : "bg-stone-100 text-stone-700";
}
