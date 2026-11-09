"use server";

import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { hitungRefund } from "@/lib/booking/rules";

type HasilBatal =
  | { ok: true; status: "dibatalkan" | "hangus"; refund: number }
  | { ok: false; error: string };

export async function batalkanBooking(bookingId: string): Promise<HasilBatal> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu" };

  const supabase = await createSessionClient();
  const { data: booking, error } = await supabase
    .from("booking")
    .select("id, status, tanggal_mulai, jumlah_booking")
    .eq("id", bookingId)
    .single();

  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };

  if (booking.status !== "menunggu_bayar" && booking.status !== "terkonfirmasi") {
    return { ok: false, error: "Booking ini tidak bisa dibatalkan" };
  }

  const refund =
    booking.status === "menunggu_bayar"
      ? 0
      : hitungRefund(new Date(`${booking.tanggal_mulai}T00:00:00`), new Date(), booking.jumlah_booking);

  const statusBaru = booking.status === "menunggu_bayar" || refund > 0 ? "dibatalkan" : "hangus";

  const admin = createAdminClient();
  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: statusBaru, updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", booking.status)
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal membatalkan booking" };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Booking tidak berubah, muat ulang halaman" };
  }

  return { ok: true, status: statusBaru, refund };
}