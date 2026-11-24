"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { konfirmasiPembayaran } from "./actions";

export default function TombolKonfirmasiPembayaran({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  async function konfirmasi() {
    if (!confirm("Periksa status pembayaran booking ini langsung ke Midtrans?")) return;
    setLoading(true);
    setPesan(null);
    setBerhasil(false);
    try {
      const hasil = await konfirmasiPembayaran(bookingId);
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }
      if (hasil.pesan) setPesan(hasil.pesan);
      setBerhasil(true);
      router.refresh();
    } catch {
      setPesan("Terjadi error saat memeriksa pembayaran. Coba lagi.");
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
        className="w-fit rounded border border-emerald-700 px-3 py-1 text-sm text-emerald-800 disabled:opacity-50"
      >
        {loading ? "Memeriksa Midtrans..." : "Konfirmasi pembayaran"}
      </button>
      {pesan && <p className={`text-sm ${berhasil ? "text-amber-700" : "text-red-600"}`}>{pesan}</p>}
    </div>
  );
}
