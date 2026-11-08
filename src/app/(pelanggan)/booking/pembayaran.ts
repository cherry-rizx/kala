"use server";

import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
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

  // order_id unik per percobaan bayar: <uuid booking> (36 karakter) + "-" + timestamp
  const orderId = `${booking.id}-${Date.now()}`;

  const { redirectUrl } = await buatTransaksiSnap({
    orderId,
    jumlah: booking.jumlah_booking,
    namaPelanggan: booking.nama_pelanggan,
    email: user.email ?? "",
  });

  return { ok: true, redirectUrl };
}