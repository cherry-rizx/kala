import "server-only";

import { midtransConfig } from "./config";
import type { StatusMidtrans } from "./status";

const BASE = midtransConfig.isProduction
  ? "https://api.midtrans.com"
  : "https://api.sandbox.midtrans.com";

type ResponsRefund = StatusMidtrans & {
  error_code?: string | number;
  error?: string;
  message?: string;
  error_messages?: string[];
  status_message?: string;
  statusMessage?: string;
  refund_key?: string;
};

type HasilRefund =
  | { ok: true; status: StatusMidtrans }
  | { ok: false; error: string };

export async function ajukanRefundMidtrans(
  orderId: string,
  refundKey: string,
  jumlah: number
): Promise<HasilRefund> {
  if (!midtransConfig.serverKey) {
    return { ok: false, error: "MIDTRANS_SERVER_KEY belum dikonfigurasi" };
  }

  const authorization = Buffer.from(`${midtransConfig.serverKey}:`).toString("base64");
  try {
    const response = await fetch(
      `${BASE}/v2/${encodeURIComponent(orderId)}/refund`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${authorization}`,
        },
        body: JSON.stringify({
          refund_key: refundKey,
          amount: jumlah,
          reason: "Pembatalan booking",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }
    );

    const teksRespons = await response.text();
    let body: ResponsRefund = {} as ResponsRefund;
    try {
      body = JSON.parse(teksRespons) as ResponsRefund;
    } catch {
      // Beberapa penolakan dari gateway dapat mengembalikan teks/HTML, bukan JSON.
    }

    const pesanMidtrans =
      body.status_message ??
      body.statusMessage ??
      body.message ??
      body.error ??
      body.error_messages?.join("; ") ??
      (teksRespons.trim() ? teksRespons.trim().slice(0, 300) : null);

    if (!response.ok || String(body.status_code ?? "") !== "200") {
      if (response.status === 403 && /access denied/i.test(pesanMidtrans ?? "")) {
        return {
          ok: false,
          error: "Akses Refund API ditolak Midtrans. Minta Midtrans mengaktifkan fitur refund untuk akun/metode pembayaran ini; setelah refund manual diproses, gunakan tombol konfirmasi manual.",
        };
      }
      return {
        ok: false,
        error: pesanMidtrans
          ? `Midtrans menolak refund (HTTP ${response.status}): ${pesanMidtrans}`
          : response.status === 403
            ? "Midtrans menolak refund (HTTP 403). Periksa header JSON dan format endpoint refund."
            : `Midtrans menolak refund (HTTP ${response.status}${body.error_code ? `, kode ${body.error_code}` : ""})`,
      };
    }
    if (
      body.transaction_status !== "refund" &&
      body.transaction_status !== "partial_refund"
    ) {
      return {
        ok: false,
        error: body.status_message ?? "Midtrans belum mengonfirmasi permintaan refund",
      };
    }
    return { ok: true, status: body };
  } catch {
    return {
      ok: false,
      error: "Koneksi ke Midtrans terputus; periksa status transaksi sebelum mencoba lagi",
    };
  }
}
