"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tandaiSedangDisewa } from "./actions";

export default function TombolLokasi({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function konfirmasi() {
    if (!confirm("Pelanggan sudah datang dan membayar sisa sewa di lokasi?")) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await tandaiSedangDisewa(bookingId);
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
        {loading ? "Memproses..." : "Konfirmasi di lokasi"}
      </button>
      {pesan && <p className="text-sm text-red-600">{pesan}</p>}
    </div>
  );
}