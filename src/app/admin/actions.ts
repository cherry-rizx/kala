"use server";

import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { cekStatusMidtrans } from "@/lib/midtrans/status";

type Hasil = { ok: true } | { ok: false; error: string };

export async function konfirmasiRefundManual(bookingId: string): Promise<Hasil> {
  const user = await getCurrentUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang bisa mengonfirmasi refund" };
  }

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "menunggu_refund") {
    return { ok: false, error: "Booking ini tidak dalam antrian refund" };
  }
  if (!b.midtrans_order_id) {
    return { ok: false, error: "Booking tidak punya order Midtrans, tidak bisa diverifikasi" };
  }

  const st = await cekStatusMidtrans(b.midtrans_order_id);
  if (!st) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  if (st.transaction_status !== "refund") {
    return {
      ok: false,
      error: `Midtrans belum mencatat refund (status: ${st.transaction_status ?? "tidak diketahui"})`,
    };
  }

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({
      status: "dibatalkan",
      refund_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id)
    .eq("status", "menunggu_refund")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan konfirmasi" };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  }

  return { ok: true };
}