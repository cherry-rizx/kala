"use server";

import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { hitungRefund } from "@/lib/booking/rules";
import { refundMidtrans } from "@/lib/midtrans/refund";

type HasilBatal =
  | { ok: true; status: "dibatalkan" | "hangus"; refund: number }
  | { ok: false; error: string };

export async function batalkanBooking(bookingId: string): Promise<HasilBatal> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu" };

  const supabase = await createSessionClient();
  const { data: booking, error } = await supabase
    .from("booking")
    .select("id, status, tanggal_mulai, jumlah_booking, midtrans_order_id")
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
    if (booking.status === "terkonfirmasi" && refund > 0) {
    const hasilRefund = await refundMidtrans({
      orderId: booking.midtrans_order_id!,
      refundKey: `refund-${booking.id}`,
      amount: refund,
      reason: "Pembatalan booking KALA",
    });
    if (!hasilRefund.ok) {
      return { ok: false, error: "Refund ke Midtrans gagal, coba lagi nanti" };
    }
  }

  const admin = createAdminClient();
  const { data: updated, error: errUpdate } = await admin
    .from("booking")
   .update({status: statusBaru,updated_at: new Date().toISOString(),refund_jumlah: refund,refund_at: refund > 0 ? new Date().toISOString() : null,})
    .eq("id", booking.id)
    .eq("status", booking.status)
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal membatalkan booking" };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Booking tidak berubah, muat ulang halaman" };
  }

  return { ok: true, status: statusBaru, refund };
}