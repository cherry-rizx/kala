import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { wajibAdmin } from "@/lib/auth/admin";
import BarisAlat, { type DataAlat } from "./baris-alat";

const URUTAN_JENIS: Record<string, number> = { paket: 0, satuan: 1, add_on: 2 };

async function DaftarAlat() {
  await wajibAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("alat")
    .select("id, kode_produk, nama, kategori, jenis_barang, skema_harga, stok_dikelola, harga_sewa, harga_barang, stok_total, aktif")
    .order("nama");

  if (error) {
    return (
      <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
        Daftar alat belum dapat dimuat. Pastikan migrasi-daftar-harga-excel.sql sudah dijalankan. ({error.message})
      </p>
    );
  }

  const daftar: DataAlat[] = (data ?? [])
    .map((a) => ({
      id: a.id,
      kodeProduk: a.kode_produk,
      nama: a.nama,
      kategori: a.kategori,
      jenisBarang: a.jenis_barang,
      skemaHarga: a.skema_harga,
      stokDikelola: a.stok_dikelola,
      hargaSewa: Number(a.harga_sewa),
      hargaBarang: Number(a.harga_barang),
      stokTotal: Number(a.stok_total),
      aktif: a.aktif,
    }))
    .sort((a, b) =>
      Number(b.aktif) - Number(a.aktif)
      || (URUTAN_JENIS[a.jenisBarang] ?? 9) - (URUTAN_JENIS[b.jenisBarang] ?? 9)
      || (a.kodeProduk ?? a.nama).localeCompare(b.kodeProduk ?? b.nama)
    );

  const belumAdaHargaBarang = daftar.filter((a) => a.aktif && a.jenisBarang !== "add_on" && a.hargaBarang === 0).length;

  return (
    <>
      {belumAdaHargaBarang > 0 && (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {belumAdaHargaBarang} alat aktif belum punya harga barang, sehingga denda kerusakannya dihitung Rp0.
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-600">
            <tr>
              <th className="px-4 py-3">Alat</th>
              <th className="px-4 py-3">Harga sewa</th>
              <th className="px-4 py-3">Harga barang</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {daftar.map((alat) => <BarisAlat key={alat.id} alat={alat} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function KelolaAlatPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">Kelola Alat</h1>
      <p className="mt-2 text-sm text-gray-600">
        Ubah harga sewa, harga barang (dasar denda kerusakan), stok, dan status tampil di katalog.
        Harga sewa baru hanya berlaku untuk booking berikutnya.
      </p>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat daftar alat...</p>}>
        <DaftarAlat />
      </Suspense>
    </main>
  );
}
