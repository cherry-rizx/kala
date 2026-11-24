import { Suspense } from "react";
import Link from "next/link";
import BadgeStatus from "@/components/badge-status";
import { DAFTAR_STATUS, isBookingStatus, labelStatus } from "@/lib/booking/status";
import { createAdminClient } from "@/lib/supabase/server";
import { wajibAdmin } from "@/lib/auth/admin";
import TombolRefund from "./tombol-refund";
import TombolLokasi from "./tombol-lokasi";
import TombolKembali from "./tombol-kembali";
import TombolLunasiDenda from "./tombol-lunasi-denda";
import TombolNoShow from "./tombol-no-show";
import TombolKonfirmasiPembayaran from "./tombol-konfirmasi-pembayaran";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function ambilParam(nilai: string | string[] | undefined) {
  return (Array.isArray(nilai) ? nilai[0] : nilai)?.trim() ?? "";
}

async function DaftarBooking({ searchParams }: { searchParams: SearchParams }) {
  await wajibAdmin();
  const params = await searchParams;
  const filterParam = ambilParam(params.status);
  const filter = filterParam === "perlu" || isBookingStatus(filterParam) ? filterParam : "semua";
  const cari = ambilParam(params.q).slice(0, 80);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("booking")
    .select("id, nama_pelanggan, status, tanggal_mulai, tanggal_selesai, items:booking_item(id, jumlah, harga_satuan, alat:alat_id(nama, harga_barang))")
    .order("tanggal_mulai", { ascending: false });

  if (error) return <p className="text-red-600">Gagal memuat data: {error.message}</p>;
  if (!data || data.length === 0) return <p className="mt-6 text-gray-600">Belum ada booking.</p>;

  // Kolom refund/denda ditambahkan oleh migrasi opsional; data booking utama
  // tetap bisa ditampilkan sebelum migrasi tersebut dijalankan.
  const { data: nilaiTambahan } = await admin
    .from("booking")
    .select("id, refund_jumlah, denda_jumlah")
    .in("id", data.map((booking) => booking.id));
  const { data: detailPaket } = await admin
    .from("booking")
    .select("id, jenis_paket, jumlah_peserta")
    .in("id", data.map((booking) => booking.id));
  const idItem = data.flatMap((booking) =>
    ((booking.items ?? []) as unknown as { id: string }[]).map((item) => item.id)
  );
  const { data: skemaSnapshot } = idItem.length
    ? await admin.from("booking_item").select("id, skema_harga, opsi_pilihan").in("id", idItem)
    : { data: [] };
  const skemaPerItem = new Map(
    (skemaSnapshot ?? []).map((item) => [item.id, item.skema_harga as string])
  );
  const { data: hargaSnapshot } = idItem.length
    ? await admin.from("booking_item").select("id, harga_barang_satuan").in("id", idItem)
    : { data: [] };
  const nilaiPerBooking = new Map(
    (nilaiTambahan ?? []).map((booking) => [booking.id, booking])
  );
  const paketPerBooking = new Map(
    (detailPaket ?? []).map((booking) => [booking.id, booking])
  );
  const hargaPerItem = new Map(
    (hargaSnapshot ?? []).map((item) => [item.id, Number(item.harga_barang_satuan)])
  );
  type ItemAdmin = { id: string; jumlah: number; harga_satuan: number; alat: { nama: string; harga_barang: number } };
  type BookingAdmin = {
    id: string;
    nama_pelanggan: string;
    status: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    items: ItemAdmin[] | null;
    jenis_paket?: string;
    jumlah_peserta?: number;
  };
  const semua = data as unknown as BookingAdmin[];
  const hariIniWIB = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  // "Perlu tindakan": antrian yang menunggu keputusan admin hari ini.
  const perluTindakan = (b: BookingAdmin) =>
    b.status === "menunggu_refund"
    || b.status === "menunggu_denda"
    || (b.status === "terkonfirmasi" && b.tanggal_mulai <= hariIniWIB)
    || (b.status === "sedang_disewa" && b.tanggal_selesai <= hariIniWIB);

  const kataKunci = cari.toLowerCase();
  const cocokCari = (b: BookingAdmin) => !kataKunci || b.nama_pelanggan.toLowerCase().includes(kataKunci);
  const hasilCari = semua.filter(cocokCari);
  const jumlahPerStatus = new Map<string, number>();
  for (const b of hasilCari) jumlahPerStatus.set(b.status, (jumlahPerStatus.get(b.status) ?? 0) + 1);
  const daftar = hasilCari.filter((b) =>
    filter === "semua" ? true : filter === "perlu" ? perluTindakan(b) : b.status === filter
  );

  const tab = (nilai: string, label: string, jumlah: number) => {
    const query = new URLSearchParams();
    if (nilai !== "semua") query.set("status", nilai);
    if (cari) query.set("q", cari);
    const aktif = filter === nilai;
    return (
      <Link
        key={nilai}
        href={`/admin${query.size ? `?${query}` : ""}`}
        aria-current={aktif ? "page" : undefined}
        className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${aktif ? "border-emerald-950 bg-emerald-950 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-100"}`}
      >
        {label} <span className="tabular-nums opacity-70">{jumlah}</span>
      </Link>
    );
  };

  return (
    <>
      <form action="/admin" className="mt-6 flex gap-2">
        {filter !== "semua" && <input type="hidden" name="status" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={cari}
          placeholder="Cari nama pelanggan..."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border px-3 py-2 text-sm">Cari</button>
      </form>
      <nav aria-label="Filter status booking" className="mt-3 flex flex-wrap gap-2">
        {tab("semua", "Semua", hasilCari.length)}
        {tab("perlu", "Perlu tindakan", hasilCari.filter(perluTindakan).length)}
        {DAFTAR_STATUS.filter((st) => jumlahPerStatus.has(st)).map((st) => tab(st, labelStatus(st), jumlahPerStatus.get(st) ?? 0))}
      </nav>
      {daftar.length === 0 && <p className="mt-6 text-sm text-gray-600">Tidak ada booking pada filter ini.</p>}
      <div className="mt-4 flex flex-col gap-3">
        {daftar.map((b) => {
        const lamaSewa = Math.max(1, Math.floor((Date.parse(`${b.tanggal_selesai}T00:00:00Z`) - Date.parse(`${b.tanggal_mulai}T00:00:00Z`)) / 86400000) + 1);
        const estimasiSewa = (b.items ?? []).reduce((total, item) => {
          const skema = skemaPerItem.get(item.id) ?? "harian";
          const hari = skema === "harian" ? lamaSewa : 1;
          return total + Number(item.harga_satuan ?? 0) * item.jumlah * hari;
        }, 0);
        const nilaiGantiBelumDiatur = (b.items ?? []).some((item) => !hargaPerItem.get(item.id));
        const adaTarifBelumDiatur = (b.items ?? []).some((item) => Number(item.harga_satuan) === 0);
        const nilai = nilaiPerBooking.get(b.id) as { refund_jumlah?: number; denda_jumlah?: number } | undefined;
        const paket = paketPerBooking.get(b.id) as { jenis_paket?: string; jumlah_peserta?: number } | undefined;
        const refund = Number(nilai?.refund_jumlah ?? 0);
        const denda = Number(nilai?.denda_jumlah ?? 0);
        return (
        <div key={b.id} className="rounded border p-4">
          <p className="font-medium">{b.nama_pelanggan}</p>
          {paket?.jenis_paket && paket.jenis_paket !== "alat_satuan" && (
            <p className="text-sm text-gray-600">
              Paket {paket.jenis_paket === "camp" ? "Camp" : paket.jenis_paket === "rombongan" ? "Rombongan" : "Tektok"}
              {paket.jumlah_peserta ? ` · ${paket.jumlah_peserta} pendaki` : ""}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{b.tanggal_mulai} s/d {b.tanggal_selesai}</span>
            <BadgeStatus status={b.status} />
            {b.status === "sedang_disewa" && b.tanggal_selesai < hariIniWIB && (
              <span className="text-xs font-semibold text-red-700">Terlambat dikembalikan</span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Estimasi sewa barang bertarif: Rp{estimasiSewa.toLocaleString("id-ID")}
          </p>
          {nilaiGantiBelumDiatur && <p className="text-sm text-amber-700">Nilai barang untuk perhitungan denda belum diisi; lengkapi harga barang pengganti di tabel alat.</p>}
          {adaTarifBelumDiatur && <p className="text-sm text-amber-700">Ada barang paket yang tarifnya dikonfirmasi di toko.</p>}
          {b.status === "menunggu_bayar" && <TombolKonfirmasiPembayaran bookingId={b.id} />}
          {refund > 0 ? (
            <p className="text-sm text-gray-600">Refund: Rp{refund.toLocaleString("id-ID")}</p>
          ) : null}
          {denda > 0 ? (
            <p className="text-sm text-gray-600">Denda: Rp{denda.toLocaleString("id-ID")}</p>
          ) : null}
          {b.status === "terkonfirmasi" && (
            <>
              <TombolLokasi bookingId={b.id} />
              {b.tanggal_mulai < hariIniWIB && <TombolNoShow bookingId={b.id} />}
            </>
          )}
          {b.status === "sedang_disewa" && (
            <TombolKembali
              bookingId={b.id}
              items={((b.items ?? []) as unknown as {
                id: string;
                jumlah: number;
                alat: { nama: string; harga_barang: number };
              }[]).map((item) => ({
                id: item.id,
                nama: item.alat.nama,
                jumlah: item.jumlah,
                hargaBarang: hargaPerItem.get(item.id) ?? Number(item.alat.harga_barang),
              }))}
            />
          )}
          {b.status === "menunggu_denda" && (
            denda > 0
              ? <TombolLunasiDenda bookingId={b.id} jumlahDenda={denda} />
              : <p className="text-sm text-amber-700">Nominal denda belum dapat dimuat; perbarui migrasi database.</p>
          )}
          {b.status === "menunggu_refund" && <TombolRefund bookingId={b.id} jumlahRefund={refund} />}
        </div>
        );})}
      </div>
    </>
  );
}

export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <p className="mt-2 text-sm text-gray-600">Riwayat semua booking dan antrian refund.</p>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat...</p>}>
        <DaftarBooking searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
