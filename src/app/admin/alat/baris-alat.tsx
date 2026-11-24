"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { perbaruiAlat } from "./actions";

export type DataAlat = {
  id: string;
  kodeProduk: string | null;
  nama: string;
  kategori: string | null;
  jenisBarang: string;
  skemaHarga: string;
  stokDikelola: boolean;
  hargaSewa: number;
  hargaBarang: number;
  stokTotal: number;
  aktif: boolean;
};

const inputKelas =
  "w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/15 disabled:bg-stone-100";

export default function BarisAlat({ alat }: { alat: DataAlat }) {
  const router = useRouter();
  const [hargaSewa, setHargaSewa] = useState(String(alat.hargaSewa));
  const [hargaBarang, setHargaBarang] = useState(String(alat.hargaBarang));
  const [stokTotal, setStokTotal] = useState(String(alat.stokTotal));
  const [aktif, setAktif] = useState(alat.aktif);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "ok" | "error"; teks: string } | null>(null);

  const berubah =
    hargaSewa !== String(alat.hargaSewa) ||
    hargaBarang !== String(alat.hargaBarang) ||
    stokTotal !== String(alat.stokTotal) ||
    aktif !== alat.aktif;

  async function simpan() {
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await perbaruiAlat(alat.id, {
        hargaSewa: Number(hargaSewa),
        hargaBarang: Number(hargaBarang),
        stokTotal: Number(stokTotal),
        aktif,
      });
      if (!hasil.ok) {
        setPesan({ tipe: "error", teks: hasil.error });
        return;
      }
      setPesan({
        tipe: "ok",
        teks: hasil.snapshotDiperbarui > 0
          ? `Tersimpan. Nilai barang juga dilengkapi pada ${hasil.snapshotDiperbarui} item booking aktif.`
          : "Tersimpan.",
      });
      router.refresh();
    } catch {
      setPesan({ tipe: "error", teks: "Terjadi error, coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className={`border-t border-stone-100 align-top ${aktif ? "" : "bg-stone-50 text-stone-500"}`}>
      <td className="px-4 py-3">
        <p className="font-semibold text-stone-900">{alat.nama}</p>
        <p className="text-xs text-stone-500">
          {[alat.kodeProduk, alat.kategori, alat.jenisBarang === "add_on" ? "add-on" : alat.jenisBarang].filter(Boolean).join(" · ")}
        </p>
        {alat.hargaBarang === 0 && alat.jenisBarang !== "add_on" && (
          <p className="mt-1 text-xs font-medium text-amber-700">Harga barang belum diisi: denda kerusakan akan Rp0.</p>
        )}
        {alat.jenisBarang === "paket" && alat.stokTotal === 0 && (
          <p className="mt-1 text-xs font-medium text-amber-700">Stok 0: paket belum bisa dibooking.</p>
        )}
        {pesan && (
          <p className={`mt-1 text-xs ${pesan.tipe === "ok" ? "text-emerald-700" : "text-red-600"}`}>{pesan.teks}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <input aria-label={`Harga sewa ${alat.nama}`} type="number" min={0} step={1000} value={hargaSewa}
          onChange={(e) => setHargaSewa(e.target.value)} className={inputKelas} />
        <p className="mt-1 text-[11px] text-stone-500">
          {alat.skemaHarga === "harian" ? "per hari" : alat.skemaHarga === "sekali_sewa" ? "sekali sewa" : alat.skemaHarga === "paket" ? "per paket" : "beli putus"}
        </p>
      </td>
      <td className="px-4 py-3">
        <input aria-label={`Harga barang ${alat.nama}`} type="number" min={0} step={1000} value={hargaBarang}
          onChange={(e) => setHargaBarang(e.target.value)} disabled={alat.jenisBarang === "add_on"} className={inputKelas} />
        <p className="mt-1 text-[11px] text-stone-500">dasar denda</p>
      </td>
      <td className="px-4 py-3">
        <input aria-label={`Stok ${alat.nama}`} type="number" min={0} step={1} value={stokTotal}
          onChange={(e) => setStokTotal(e.target.value)} disabled={!alat.stokDikelola} className={`${inputKelas} w-20`} />
        {!alat.stokDikelola && <p className="mt-1 text-[11px] text-stone-500">tidak dikelola</p>}
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="size-4 accent-emerald-900" />
          {aktif ? "Aktif" : "Nonaktif"}
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={simpan} disabled={loading || !berubah}
          className="rounded-lg bg-emerald-950 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </td>
    </tr>
  );
}
