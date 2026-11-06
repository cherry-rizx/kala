export const BOOKING_STATUS = {
  MENUNGGU_BAYAR: "menunggu_bayar",
  TERKONFIRMASI: "terkonfirmasi",
  DIBATALKAN: "dibatalkan",
  HANGUS: "hangus",
  SEDANG_DISEWA: "sedang_disewa",
  MENUNGGU_DENDA: "menunggu_denda",
  SELESAI: "selesai",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];