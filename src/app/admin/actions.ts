"use server";

import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { cekStatusMidtrans } from "@/lib/midtrans/status";

type Hasil = { ok: true; denda?: number; refund?: number } | { ok: false; error: string };

async function pastikanAdmin() {
  const user = await getCurrentUser();
  return !!user && user.app_metadata?.role === "admin";
}

export async function konfirmasiRefundManual(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id, jumlah_booking")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "menunggu_refund") return { ok: false, error: "Booking ini tidak dalam antrian refund" };
  if (!b.midtrans_order_id) return { ok: false, error: "Booking tidak punya order Midtrans" };

  const st = await cekStatusMidtrans(b.midtrans_order_id);
  if (!st) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  if (st.transaction_status !== "refund" && st.transaction_status !== "partial_refund") {
    return { ok: false, error: `Midtrans belum mencatat refund (status: ${st.transaction_status ?? "tidak diketahui"})` };
  }
  const refundJumlah = Number(st.refund_amount);
  if (!Number.isFinite(refundJumlah) || refundJumlah <= 0 || refundJumlah > b.jumlah_booking) {
    return { ok: false, error: "Nominal refund dari Midtrans tidak valid" };
  }

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({
      status: "dibatalkan",
      refund_jumlah: Math.round(refundJumlah),
      refund_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id)
    .eq("status", "menunggu_refund")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan konfirmasi" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true, refund: Math.round(refundJumlah) };
}

export async function tandaiSedangDisewa(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, tanggal_mulai")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "terkonfirmasi") return { ok: false, error: "Booking ini belum terkonfirmasi atau sudah diambil" };

  const hariIni = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  if (b.tanggal_mulai > hariIni) return { ok: false, error: `Alat baru bisa diambil mulai ${b.tanggal_mulai}` };

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: "sedang_disewa", updated_at: new Date().toISOString() })
    .eq("id", b.id)
    .eq("status", "terkonfirmasi")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan perubahan" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true };
}

type KerusakanItem = { bookingItemId: string; persenRusak: number };

export async function kembalikanAlat(bookingId: string, kerusakan: KerusakanItem[]): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  if (!Array.isArray(kerusakan) || kerusakan.length === 0 || kerusakan.some(
    (item) => !item || typeof item.bookingItemId !== "string" || !item.bookingItemId
      || !Number.isInteger(item.persenRusak) || item.persenRusak < 0 || item.persenRusak > 100
  )) {
    return { ok: false, error: "Persentase kerusakan setiap alat harus bilangan bulat 0 sampai 100" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("catat_pengembalian_atomik", {
    p_booking_id: bookingId,
    p_kerusakan: kerusakan.map((item) => ({
      booking_item_id: item.bookingItemId,
      persen: item.persenRusak,
    })),
  });

  if (error) {
    if (error.message.includes("BOOKING_TIDAK_DITEMUKAN")) return { ok: false, error: "Booking tidak ditemukan" };
    if (error.message.includes("BOOKING_BUKAN_SEDANG_DISEWA")) return { ok: false, error: "Booking ini tidak sedang disewa" };
    if (error.message.includes("KERUSAKAN_TIDAK_VALID")) return { ok: false, error: "Persentase kerusakan setiap alat harus bilangan bulat 0 sampai 100" };
    if (error.message.includes("ITEM_KERUSAKAN_TIDAK_COCOK")) return { ok: false, error: "Daftar alat berubah. Muat ulang halaman." };
    return { ok: false, error: "Gagal menyimpan pengembalian" };
  }
  if (!data) return { ok: false, error: "Gagal menyimpan pengembalian" };
  const hasil = data as { denda_total: number };
  return { ok: true, denda: Number(hasil.denda_total) };
}

export async function konfirmasiPelunasanDenda(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, denda_jumlah")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "menunggu_denda") return { ok: false, error: "Booking ini tidak menunggu pelunasan denda" };
  if (!b.denda_jumlah || b.denda_jumlah <= 0) {
    return { ok: false, error: "Nominal denda tidak valid" };
  }

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: "selesai", updated_at: new Date().toISOString() })
    .eq("id", b.id)
    .eq("status", "menunggu_denda")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan pelunasan denda" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true, denda: b.denda_jumlah };
}

export async function tandaiNoShow(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("booking")
    .select("id, status, tanggal_mulai")
    .eq("id", bookingId)
    .single();

  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };
  if (booking.status !== "terkonfirmasi") return { ok: false, error: "Booking ini tidak lagi terkonfirmasi" };
  const hariIniWIB = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  if (booking.tanggal_mulai >= hariIniWIB) {
    return { ok: false, error: "Booking baru bisa ditandai no-show setelah tanggal ambil lewat" };
  }

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: "hangus", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", "terkonfirmasi")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan status no-show" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true };
}
