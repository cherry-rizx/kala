"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { kembalikanAlat } from "./actions";

export default function TombolKembali({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [persen, setPersen] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function konfirmasi() {
    if (!confirm(`Konfirmasi pengembalian dengan kerusakan ${persen}%?`)) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await kembalikanAlat(bookingId, persen);
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }
      if (hasil.denda && hasil.denda > 0) {
        setPesan(`Denda Rp${hasil.denda.toLocaleString("id-ID")} menunggu dibayar di lokasi.`);
      }
      router.refresh();
    } catch {
      setPesan("Terjadi error, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor={`persen-${bookingId}`}>Kerusakan (%)</label>
        <input
          id={`persen-${bookingId}`}
          type="number"
          min={0}
          max={100}
          value={persen}
          onChange={(e) => setPersen(Number(e.target.value))}
          className="w-20 rounded border p-1"
        />
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={konfirmasi}
        className="w-fit rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Alat dikembalikan"}
      </button>
      {pesan && <p className="text-sm text-gray-700">{pesan}</p>}
    </div>
  );
}