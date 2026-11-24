"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ajukanRefundBooking, konfirmasiRefundManual } from "./actions";

export default function TombolRefund({
  bookingId,
  jumlahRefund,
}: {
  bookingId: string;
  jumlahRefund: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function prosesRefund(manual = false) {
    const jumlah = `Rp${jumlahRefund.toLocaleString("id-ID")}`;
    const pertanyaan = manual
      ? `Pastikan refund ${jumlah} sudah diproses di dashboard Midtrans. Konfirmasi sekarang?`
      : `Ajukan refund ${jumlah} ke Midtrans sekarang?`;
    if (!confirm(pertanyaan)) return;

    setLoading(true);
    setPesan(null);
    try {
      const hasil = manual
        ? await konfirmasiRefundManual(bookingId)
        : await ajukanRefundBooking(bookingId);
      if (!hasil.ok) setPesan(hasil.error);
      else router.refresh();
    } catch {
      setPesan("Terjadi error, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => prosesRefund()}
        className="w-fit rounded border border-amber-700 px-3 py-1 text-sm text-amber-800 disabled:opacity-50"
      >
        {loading ? "Memproses refund..." : `Proses refund Rp${jumlahRefund.toLocaleString("id-ID")}`}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => prosesRefund(true)}
        className="w-fit rounded border px-3 py-1 text-xs text-gray-600 disabled:opacity-50"
      >
        Refund sudah diproses manual
      </button>
      {pesan && <p className="text-sm text-red-600">{pesan}</p>}
    </div>
  );
}
