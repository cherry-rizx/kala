import { midtransConfig } from "./config";
import { createAdminClient } from "@/lib/supabase/server";

const BASE = midtransConfig.isProduction
  ? "https://api.midtrans.com"
  : "https://api.sandbox.midtrans.com";

export type StatusMidtrans = {
  status_code?: string | number;
  order_id?: string;
  transaction_id?: string;
  payment_type?: string;
  transaction_status: string;
  refund_amount?: string | number;
  gross_amount?: string | number;
};

export async function cekStatusMidtrans(orderId: string): Promise<StatusMidtrans | null> {
  if (!midtransConfig.serverKey) return null;
  const auth = Buffer.from(`${midtransConfig.serverKey}:`).toString("base64");
  try {
    const res = await fetch(`${BASE}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: { Accept: "application/json", Authorization: `Basic ${auth}` },
      cache: "no-store",
      // Halaman riwayat menunggu pemanggilan ini; jangan biarkan menggantung.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as StatusMidtrans;
    // Midtrans dapat membungkus order tidak ditemukan dalam HTTP 200.
    if (body.status_code && String(body.status_code) !== "200") return null;
    if (typeof body.transaction_status !== "string") return null;
    return body;
  } catch {
    return null;
  }
}

// Menutup transaksi pending agar QR tidak bisa dibayar lagi, misalnya
// setelah pelanggan membatalkan booking. Gagal di sini tidak fatal:
// pembayaran yang tetap masuk akan diarahkan ke antrian refund.
export async function kedaluwarsakanTransaksiMidtrans(orderId: string): Promise<boolean> {
  if (!midtransConfig.serverKey) return false;
  const auth = Buffer.from(`${midtransConfig.serverKey}:`).toString("base64");
  try {
    const res = await fetch(`${BASE}/v2/${encodeURIComponent(orderId)}/expire`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Basic ${auth}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function terapkanStatusMidtrans(orderId: string, status: StatusMidtrans) {
  const admin = createAdminClient();
  const { data: pembayaran } = await admin
    .from("booking_pembayaran")
    .select("order_id, booking_id, jumlah, status, transaction_status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!pembayaran) return;
  if (status.gross_amount !== undefined) {
    const nominalTransaksi = Number(status.gross_amount);
    if (!Number.isFinite(nominalTransaksi) || Math.round(nominalTransaksi) !== pembayaran.jumlah) return;
  }

  const { data: booking } = await admin
    .from("booking")
    .select("id, status, jumlah_booking, batas_bayar")
    .eq("id", pembayaran.booking_id)
    .maybeSingle();
  if (!booking) return;

  const sekarang = new Date().toISOString();
  const transactionStatus = status.transaction_status;
  const statusPercobaan =
    transactionStatus === "settlement" || transactionStatus === "capture"
      ? "berhasil"
      : transactionStatus === "refund"
        ? "refund"
        : transactionStatus === "partial_refund"
          ? "partial_refund"
          : ["expire", "deny", "cancel", "failure"].includes(transactionStatus)
            ? "gagal"
            : "pending";

  // Notifikasi bisa datang tidak berurutan atau dikirim ulang oleh Midtrans.
  // "pending" yang terlambat tidak boleh menimpa percobaan yang sudah final,
  // dan "settlement" duplikat tidak boleh menimpa percobaan yang sudah di-refund.
  const statusSebelumnya = pembayaran.status as string;
  const sudahFinal = !["dibuat", "pending"].includes(statusSebelumnya);
  const sudahDibayar = ["berhasil", "refund", "partial_refund"].includes(statusSebelumnya);
  if (statusPercobaan === "berhasil" && (statusSebelumnya === "refund" || statusSebelumnya === "partial_refund")) {
    return;
  }
  if (!(statusPercobaan === "pending" && sudahFinal)) {
    await admin
      .from("booking_pembayaran")
      .update({ status: statusPercobaan, transaction_status: transactionStatus, updated_at: sekarang })
      .eq("order_id", orderId);
  }

  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    // Settlement untuk order ini sudah pernah diproses. Booking yang sejak itu
    // berubah (mis. hangus karena batal < H-8 atau no-show) jangan dipindah
    // ke antrian refund hanya karena notifikasi yang sama datang lagi.
    if (sudahDibayar && booking.status !== "menunggu_bayar") return;

    const batasLewat = booking.batas_bayar && new Date(booking.batas_bayar).getTime() <= Date.now();
    if (booking.status === "menunggu_bayar" && !batasLewat) {
      await admin
        .from("booking")
        .update({ status: "terkonfirmasi", updated_at: sekarang })
        .eq("id", booking.id)
        .eq("status", "menunggu_bayar");
    } else if (["menunggu_bayar", "dibatalkan", "hangus"].includes(booking.status)) {
      // Pembayaran yang masuk setelah pembatalan harus dikembalikan, bukan
      // menghidupkan kembali reservasi alat yang sudah dilepas.
      await admin
        .from("booking")
        .update({
          status: "menunggu_refund",
          refund_jumlah: booking.jumlah_booking,
          midtrans_order_id: orderId,
          updated_at: sekarang,
        })
        .eq("id", booking.id)
        .in("status", ["menunggu_bayar", "dibatalkan", "hangus"]);
    }
    return;
  }

  if (transactionStatus === "refund" || transactionStatus === "partial_refund") {
    const refundJumlah = Number(status.refund_amount);
    if (!Number.isFinite(refundJumlah) || refundJumlah <= 0 || refundJumlah > booking.jumlah_booking) return;

    await admin
      .from("booking")
      .update({
        status: "dibatalkan",
        refund_jumlah: Math.round(refundJumlah),
        refund_at: sekarang,
        midtrans_order_id: orderId,
        updated_at: sekarang,
      })
      .eq("id", booking.id)
      .in("status", ["terkonfirmasi", "menunggu_refund", "dibatalkan"]);
    return;
  }

  if (["expire", "deny", "cancel", "failure"].includes(transactionStatus)
      && booking.status === "menunggu_bayar"
      && booking.batas_bayar
      && new Date(booking.batas_bayar).getTime() <= Date.now()) {
    await admin
      .from("booking")
      .update({ status: "dibatalkan", updated_at: sekarang })
      .eq("id", booking.id)
      .eq("status", "menunggu_bayar");
  }

  if (transactionStatus === "cancel" && pembayaran.transaction_status === "capture"
      && ["terkonfirmasi", "menunggu_refund"].includes(booking.status)) {
    await admin
      .from("booking")
      .update({ status: "dibatalkan", refund_jumlah: 0, refund_at: null, updated_at: sekarang })
      .eq("id", booking.id)
      .in("status", ["terkonfirmasi", "menunggu_refund"]);
  }
}

// Hanya menyinkronkan order milik pelanggan yang sedang membuka halaman,
// agar satu kunjungan tidak memicu puluhan panggilan API untuk user lain.
export async function sinkronkanBookingMenunggu(pelangganId: string) {
  const admin = createAdminClient();
  const { data: daftar, error } = await admin
    .from("booking_pembayaran")
    .select("order_id, booking:booking_id!inner(pelanggan_id)")
    .eq("booking.pelanggan_id", pelangganId)
    .in("status", ["dibuat", "pending"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return;

  await Promise.all(
    (daftar ?? []).map(async (pembayaran) => {
      const status = await cekStatusMidtrans(pembayaran.order_id);
      if (status) await terapkanStatusMidtrans(pembayaran.order_id, status);
    })
  );
}
