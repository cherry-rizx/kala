"use server";

import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { buatTransaksiSnap } from "@/lib/midtrans/snap";

type HasilBayar = { ok: true; redirectUrl: string } | { ok: false; error: string };

export async function bayarBooking(bookingId: string): Promise<HasilBayar> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu" };

  const supabase = await createSessionClient();
  const { data: booking, error } = await supabase
    .from("booking")
    .select("id, status, jumlah_booking, batas_bayar, nama_pelanggan")
    .eq("id", bookingId)
    .single();

  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };
  if (booking.status !== "menunggu_bayar") {
    return { ok: false, error: "Booking ini sudah tidak menunggu pembayaran" };
  }
  if (booking.batas_bayar && new Date(booking.batas_bayar) < new Date()) {
    return { ok: false, error: "Batas waktu pembayaran sudah lewat" };
  }

  const orderId = `${booking.id}-${Date.now()}`;

  const admin = createAdminClient();
  const { data: pembayaranAktif } = await admin
    .from("booking_pembayaran")
    .select("status, redirect_url")
    .eq("booking_id", booking.id)
    .in("status", ["dibuat", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pembayaranAktif) {
    if (pembayaranAktif.redirect_url) return { ok: true, redirectUrl: pembayaranAktif.redirect_url };
    return { ok: false, error: "Transaksi sedang dibuat. Tunggu sebentar lalu coba lagi." };
  }

  const { error: errAttempt } = await admin.rpc("buat_percobaan_pembayaran", {
    p_booking_id: booking.id,
    p_order_id: orderId,
  });
  if (errAttempt) {
    const { data: existing } = await admin
      .from("booking_pembayaran")
      .select("redirect_url")
      .eq("booking_id", booking.id)
      .in("status", ["dibuat", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.redirect_url) return { ok: true, redirectUrl: existing.redirect_url };
    return { ok: false, error: "Batas pembayaran sudah lewat atau booking sudah berubah. Muat ulang halaman." };
  }

  try {
    const { redirectUrl } = await buatTransaksiSnap({
      orderId,
      jumlah: booking.jumlah_booking,
      namaPelanggan: booking.nama_pelanggan,
      email: user.email ?? "",
    });

    await admin
      .from("booking_pembayaran")
      .update({ status: "pending", redirect_url: redirectUrl, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);

    return { ok: true, redirectUrl };
  } catch {
    await admin
      .from("booking_pembayaran")
      .update({ status: "gagal_membuat", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { ok: false, error: "Transaksi pembayaran gagal dibuat. Silakan coba lagi." };
  }
}
