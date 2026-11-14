"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { konfirmasiRefundManual } from "./actions";

export default function TombolRefund({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function konfirmasi() {
    if (!confirm("Pastikan refund sudah dilakukan di dashboard Midtrans. Lanjutkan?")) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await konfirmasiRefundManual(bookingId);
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
        onClick={konfirmasi}
        className="w-fit rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        {loading ? "Memeriksa..." : "Konfirmasi refund"}
      </button>
      {pesan && <p className="text-sm text-red-600">{pesan}</p>}
    </div>
  );
}