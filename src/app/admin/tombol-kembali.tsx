"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { kembalikanAlat } from "./actions";

type ItemKembali = {
  id: string;
  nama: string;
  jumlah: number;
  hargaBarang: number;
};

export default function TombolKembali({
  bookingId,
  items,
}: {
  bookingId: string;
  items: ItemKembali[];
}) {
  const router = useRouter();
  const [persen, setPersen] = useState<Record<string, number>>(
    Object.fromEntries(items.map((item) => [item.id, 0]))
  );
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function konfirmasi() {
    const ringkasan = items
      .map((item) => `${item.nama} (${item.jumlah}): rusak ${persen[item.id] ?? 0}%`)
      .join("\n");
    if (!confirm(`Konfirmasi pengembalian dengan tingkat kerusakan per alat berikut?\n\n${ringkasan}`)) return;

    setLoading(true);
    setPesan(null);
    try {
      const hasil = await kembalikanAlat(
        bookingId,
        items.map((item) => ({ bookingItemId: item.id, persenRusak: persen[item.id] ?? 0 }))
      );
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }
      if (hasil.denda && hasil.denda > 0) {
        setPesan(`Total denda Rp${hasil.denda.toLocaleString("id-ID")} menunggu dibayar di lokasi.`);
      }
      router.refresh();
    } catch {
      setPesan("Terjadi error, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor={`persen-${item.id}`}>
            {item.nama} × {item.jumlah} · harga barang Rp{item.hargaBarang.toLocaleString("id-ID")}
          </label>
          <div className="flex shrink-0 items-center gap-1">
            <input
              id={`persen-${item.id}`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={persen[item.id] ?? 0}
              onChange={(e) => setPersen((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
              className="w-20 rounded border p-1"
            />
            <span>% rusak</span>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={loading || items.length === 0}
        onClick={konfirmasi}
        className="w-fit rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Alat dikembalikan"}
      </button>
      {pesan && <p className="text-sm text-gray-700">{pesan}</p>}
    </div>
  );
}
