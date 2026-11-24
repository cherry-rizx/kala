import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { wajibAdmin } from "@/lib/auth/admin";
import TabelDenda, { type BarisDenda } from "./table";

type ItemBookingDenda = {
  id: string;
  jumlah: number;
  harga_barang_satuan: number | null;
  denda_jumlah: number | null;
  alat: { nama: string; harga_barang: number } | null;
};

type BookingDenda = {
  id: string;
  nama_pelanggan: string;
  tanggal_mulai: string;
  status: string;
  denda_persen: number | null;
  denda_jumlah: number;
  items: ItemBookingDenda[] | null;
};

async function KontenDenda() {
  await wajibAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("booking")
    .select("id, nama_pelanggan, tanggal_mulai, status, denda_persen, denda_jumlah, items:booking_item(id, jumlah, harga_barang_satuan, denda_jumlah, alat:alat_id(nama, harga_barang))")
    .in("status", ["menunggu_denda", "selesai"])
    .gt("denda_jumlah", 0)
    .order("tanggal_mulai", { ascending: false });

  if (error) {
    return (
      <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
        <h2 className="font-bold">Riwayat denda belum dapat dimuat</h2>
        <p className="mt-1 text-sm">Periksa koneksi database dan pastikan migrasi denda sudah dijalankan.</p>
      </div>
    );
  }

  const bookings = (data ?? []) as unknown as BookingDenda[];
  const baris: BarisDenda[] = bookings.map((booking) => ({
    id: booking.id,
    namaPelanggan: booking.nama_pelanggan,
    tanggalMulai: booking.tanggal_mulai,
    status: booking.status,
    persen: Number(booking.denda_persen ?? 0),
    totalDenda: Number(booking.denda_jumlah),
    items: (booking.items ?? [])
      .filter((item) => Number(item.denda_jumlah ?? 0) > 0)
      .map((item) => ({
        nama: item.alat?.nama ?? "Alat dihapus",
        jumlah: item.jumlah,
        hargaBarang: Number(item.harga_barang_satuan ?? item.alat?.harga_barang ?? 0),
      })),
  }));
  const totalDenda = baris.reduce((jumlah, item) => jumlah + item.totalDenda, 0);
  const totalBelumLunas = baris
    .filter((item) => item.status === "menunggu_denda")
    .reduce((jumlah, item) => jumlah + item.totalDenda, 0);
  const jumlahBelumLunas = baris.filter((item) => item.status === "menunggu_denda").length;
  const jumlahLunas = baris.filter((item) => item.status === "selesai").length;
  const rupiah = (jumlah: number) => `Rp${jumlah.toLocaleString("id-ID")}`;

  return (
    <>
      <section aria-label="Ringkasan denda" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">Total denda tercatat</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-amber-950">{rupiah(totalDenda)}</p>
          <p className="mt-1 text-xs text-amber-800">{baris.length} booking dengan denda</p>
        </article>
        <article className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-sm font-medium text-orange-800">Belum lunas</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-orange-950">{rupiah(totalBelumLunas)}</p>
          <p className="mt-1 text-xs text-orange-800">{jumlahBelumLunas} booking menunggu pembayaran</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-medium text-emerald-800">Sudah lunas</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-950">{jumlahLunas}</p>
          <p className="mt-1 text-xs text-emerald-800">booking selesai membayar denda</p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-600">Rata-rata kerusakan</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-stone-950">
            {baris.length
              ? `${Math.round(baris.reduce((jumlah, item) => jumlah + item.persen, 0) / baris.length)}%`
              : "0%"}
          </p>
          <p className="mt-1 text-xs text-stone-500">persentase per booking</p>
        </article>
      </section>

      <section aria-labelledby="tabel-denda-heading" className="mt-8 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Rincian</p>
            <h2 id="tabel-denda-heading" className="mt-1 text-xl font-bold text-stone-950">Daftar denda booking</h2>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            {baris.length} data
          </span>
        </div>
        <TabelDenda baris={baris} />
      </section>
    </>
  );
}

export default function DendaPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-stone-800 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-16 size-56 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Operasional admin</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Riwayat denda</h1>
          <p className="mt-3 text-sm leading-6 text-stone-300 sm:text-base">
            Pantau denda kerusakan barang, nominal yang perlu ditagih, dan pembayaran yang sudah dicatat.
          </p>
        </div>
      </header>

      <Suspense fallback={<p className="mt-6 text-sm text-stone-600">Memuat riwayat denda...</p>}>
        <KontenDenda />
      </Suspense>
    </main>
  );
}
