import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import BookingForm from "./booking-form";

async function FormBooking() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hariIni = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  const supabase = await createSessionClient();
  const { data: katalog, error } = await supabase
    .from("alat")
    .select("id, nama, harga_sewa, stok_total, jenis_barang, tipe_paket, minimal_peserta, maksimal_peserta, deskripsi, kategori, skema_harga, stok_dikelola, durasi_hari, opsi_varian")
    .eq("aktif", true)
    .order("nama");

  if (error) {
    // Tetap tampilkan katalog satuan ketika kolom paket belum dimigrasikan.
    const fallback = await supabase
      .from("alat")
      .select("id, nama, harga_sewa, stok_total")
      .eq("aktif", true)
      .order("nama");
    if (fallback.error) {
      return <p className="text-red-600">Gagal memuat daftar alat: {fallback.error.message}</p>;
    }
    const alatSatuan = (fallback.data ?? []).map((item) => ({
      ...item,
      jenis_barang: "satuan" as const,
      tipe_paket: null,
      minimal_peserta: 1,
      maksimal_peserta: null,
      deskripsi: null,
      kategori: null,
      skema_harga: "harian" as const,
      stok_dikelola: true,
      durasi_hari: null,
      opsi_varian: {} as Record<string, string[]>,
    }));
    return <BookingForm alat={alatSatuan} paketKatalogAktif={false} hariIni={hariIni} />;
  }

  return <BookingForm alat={katalog ?? []} paketKatalogAktif hariIni={hariIni} />;
}

export default function BookingPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-800 px-6 py-8 text-white shadow-lg sm:px-9 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">KALA · SEWA ALAT PENDAKIAN</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Siapkan perlengkapan pendakianmu</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">
          Pilih perlengkapan yang dibutuhkan. Uang booking Rp20.000 dibayar online; pelunasan sewa dilakukan di toko.
        </p>
      </div>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat daftar alat...</p>}>
        <FormBooking />
      </Suspense>
    </main>
  );
}
