"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tandaiNoShow } from "./actions";

export default function TombolNoShow({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function konfirmasi() {
    if (!confirm("Pelanggan tidak datang sampai tanggal pengambilan lewat? Tandai booking hangus?")) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await tandaiNoShow(bookingId);
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
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
      <button
        type="button"
        disabled={loading}
        onClick={konfirmasi}
        className="w-fit rounded border border-red-600 px-3 py-1 text-sm text-red-600 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Tandai no-show / hangus"}
      </button>
      {pesan && <p className="text-sm text-red-600">{pesan}</p>}
    </div>
  );
}
