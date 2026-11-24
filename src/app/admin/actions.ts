"use server";

import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { cekStatusMidtrans, terapkanStatusMidtrans } from "@/lib/midtrans/status";
import { ajukanRefundMidtrans } from "@/lib/midtrans/refund";

type Hasil =
  | { ok: true; denda?: number; refund?: number; pesan?: string }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function pastikanAdmin() {
  const user = await getCurrentUser();
  return !!user && user.app_metadata?.role === "admin";
}

export async function konfirmasiPembayaran(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  if (typeof bookingId !== "string" || !UUID_RE.test(bookingId)) {
    return { ok: false, error: "Booking tidak valid" };
  }

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id, jumlah_booking")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };
  if (booking.status !== "menunggu_bayar") {
    return { ok: false, error: "Booking ini tidak lagi menunggu pembayaran" };
  }
  if (!booking.midtrans_order_id) {
    return { ok: false, error: "Booking belum memiliki transaksi Midtrans" };
  }

  const { data: pembayaran, error: errorPembayaran } = await admin
    .from("booking_pembayaran")
    .select("order_id, jumlah")
    .eq("order_id", booking.midtrans_order_id)
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (errorPembayaran || !pembayaran) {
    return { ok: false, error: "Data transaksi pembayaran tidak ditemukan" };
  }

  const status = await cekStatusMidtrans(pembayaran.order_id);
  if (!status) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  if (status.order_id && status.order_id !== pembayaran.order_id) {
    return { ok: false, error: "Order ID dari Midtrans tidak cocok" };
  }
  const nominal = Number(status.gross_amount);
  if (!Number.isFinite(nominal) || Math.round(nominal) !== pembayaran.jumlah) {
    return { ok: false, error: "Nominal pembayaran dari Midtrans tidak cocok" };
  }
  if (status.transaction_status !== "settlement" && status.transaction_status !== "capture") {
    return {
      ok: false,
      error: `Pembayaran belum berhasil (status Midtrans: ${status.transaction_status})`,
    };
  }

  await terapkanStatusMidtrans(pembayaran.order_id, status);

  const { data: bookingTerbaru, error: errorStatusTerbaru } = await admin
    .from("booking")
    .select("status")
    .eq("id", booking.id)
    .maybeSingle();

  if (errorStatusTerbaru || !bookingTerbaru) {
    return { ok: false, error: "Status pembayaran terverifikasi, tetapi booking gagal dimuat ulang" };
  }
  if (bookingTerbaru.status === "terkonfirmasi") return { ok: true };
  if (bookingTerbaru.status === "menunggu_refund") {
    return {
      ok: true,
      pesan: "Pembayaran tercatat setelah batas booking; booking masuk antrian refund.",
    };
  }
  return { ok: false, error: "Pembayaran terverifikasi, tetapi status booking belum berubah" };
}

async function catatRefundTerkonfirmasi(
  bookingId: string,
  orderId: string,
  jumlahDiminta: number,
  status: Awaited<ReturnType<typeof cekStatusMidtrans>>
): Promise<Hasil> {
  if (!status) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  if (status.order_id && status.order_id !== orderId) {
    return { ok: false, error: "Order ID dari Midtrans tidak cocok" };
  }
  if (status.transaction_status !== "refund" && status.transaction_status !== "partial_refund") {
    return { ok: false, error: `Midtrans belum mencatat refund (status: ${status.transaction_status})` };
  }

  const refundJumlah = Number(status.refund_amount);
  if (!Number.isFinite(refundJumlah) || Math.round(refundJumlah) !== jumlahDiminta) {
    return { ok: false, error: "Nominal refund yang tercatat di Midtrans tidak cocok" };
  }

  await terapkanStatusMidtrans(orderId, status);
  const admin = createAdminClient();
  const { data: terbaru, error } = await admin
    .from("booking")
    .select("status, refund_jumlah")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !terbaru) return { ok: false, error: "Refund terverifikasi, tetapi status booking gagal dimuat" };
  if (terbaru.status !== "dibatalkan" || Number(terbaru.refund_jumlah) !== jumlahDiminta) {
    return { ok: false, error: "Refund terverifikasi, tetapi status booking belum tersimpan" };
  }
  return { ok: true, refund: jumlahDiminta };
}

export async function ajukanRefundBooking(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  if (typeof bookingId !== "string" || !UUID_RE.test(bookingId)) {
    return { ok: false, error: "Booking tidak valid" };
  }

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id, jumlah_booking, refund_jumlah")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };
  if (booking.status !== "menunggu_refund") return { ok: false, error: "Booking ini tidak dalam antrian refund" };
  if (!booking.midtrans_order_id) return { ok: false, error: "Booking tidak punya order Midtrans" };

  const jumlahRefund = Number(booking.refund_jumlah);
  if (!Number.isInteger(jumlahRefund) || jumlahRefund <= 0 || jumlahRefund > booking.jumlah_booking) {
    return { ok: false, error: "Nominal refund booking tidak valid" };
  }

  const { data: pembayaran, error: errorPembayaran } = await admin
    .from("booking_pembayaran")
    .select("order_id, booking_id, jumlah")
    .eq("order_id", booking.midtrans_order_id)
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (errorPembayaran || !pembayaran) {
    return { ok: false, error: "Data transaksi pembayaran tidak ditemukan" };
  }
  if (pembayaran.jumlah !== booking.jumlah_booking) {
    return { ok: false, error: "Nominal transaksi tidak cocok dengan booking" };
  }

  let statusMidtrans = await cekStatusMidtrans(pembayaran.order_id);
  if (!statusMidtrans) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  const nominalTransaksi = Number(statusMidtrans.gross_amount);
  if (!Number.isFinite(nominalTransaksi) || Math.round(nominalTransaksi) !== pembayaran.jumlah) {
    return { ok: false, error: "Nominal transaksi dari Midtrans tidak cocok" };
  }

  if (statusMidtrans.transaction_status === "refund" || statusMidtrans.transaction_status === "partial_refund") {
    return catatRefundTerkonfirmasi(booking.id, pembayaran.order_id, jumlahRefund, statusMidtrans);
  }
  if (statusMidtrans.transaction_status !== "settlement") {
    return {
      ok: false,
      error: `Refund otomatis hanya tersedia setelah pembayaran settlement (status: ${statusMidtrans.transaction_status})`,
    };
  }

  const hasilRefund = await ajukanRefundMidtrans(
    statusMidtrans.transaction_id ?? pembayaran.order_id,
    `booking-${booking.id}`,
    jumlahRefund
  );
  if (hasilRefund.ok) {
    statusMidtrans = hasilRefund.status;
  } else {
    // Jika request timeout atau refund_key sudah pernah dipakai, cek status
    // dulu sebelum mengizinkan tindakan ulang agar tidak terjadi refund ganda.
    const statusTerbaru = await cekStatusMidtrans(pembayaran.order_id);
    if (
      statusTerbaru?.transaction_status !== "refund" &&
      statusTerbaru?.transaction_status !== "partial_refund"
    ) {
      return { ok: false, error: hasilRefund.error };
    }
    statusMidtrans = statusTerbaru;
  }

  const nominalRefundMidtrans = Number(statusMidtrans.refund_amount);
  if (!Number.isFinite(nominalRefundMidtrans) || Math.round(nominalRefundMidtrans) !== jumlahRefund) {
    return { ok: false, error: "Midtrans menerima refund dengan nominal berbeda; periksa transaksi sebelum mencoba lagi" };
  }
  return catatRefundTerkonfirmasi(booking.id, pembayaran.order_id, jumlahRefund, statusMidtrans);
}

export async function konfirmasiRefundManual(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  if (typeof bookingId !== "string" || !UUID_RE.test(bookingId)) {
    return { ok: false, error: "Booking tidak valid" };
  }

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id, refund_jumlah, jumlah_booking")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) return { ok: false, error: "Booking tidak ditemukan" };
  if (booking.status !== "menunggu_refund") return { ok: false, error: "Booking ini tidak dalam antrian refund" };
  if (!booking.midtrans_order_id) return { ok: false, error: "Booking tidak punya order Midtrans" };

  const jumlahRefund = Number(booking.refund_jumlah);
  if (!Number.isInteger(jumlahRefund) || jumlahRefund <= 0 || jumlahRefund > booking.jumlah_booking) {
    return { ok: false, error: "Nominal refund booking tidak valid" };
  }

  const { data: pembayaran, error: errorPembayaran } = await admin
    .from("booking_pembayaran")
    .select("order_id, jumlah")
    .eq("order_id", booking.midtrans_order_id)
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (errorPembayaran || !pembayaran || pembayaran.jumlah !== booking.jumlah_booking) {
    return { ok: false, error: "Data transaksi pembayaran tidak cocok dengan booking" };
  }

  // Jalur ini dipakai setelah admin memproses refund secara manual di dashboard
  // Midtrans. Jangan bergantung pada API status yang dapat terlambat diperbarui.
  const sekarang = new Date().toISOString();
  const { data: updated, error: errorUpdate } = await admin
    .from("booking")
    .update({ status: "dibatalkan", refund_at: sekarang, updated_at: sekarang })
    .eq("id", booking.id)
    .eq("status", "menunggu_refund")
    .eq("refund_jumlah", jumlahRefund)
    .select("id");

  if (errorUpdate) return { ok: false, error: "Gagal menyimpan konfirmasi refund manual" };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Status booking berubah. Muat ulang halaman." };
  }
  return { ok: true, refund: jumlahRefund };
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
