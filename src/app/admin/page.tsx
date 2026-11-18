import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import TombolRefund from "./tombol-refund";
import TombolLokasi from "./tombol-lokasi";
import TombolKembali from "./tombol-kembali";
import TombolLunasiDenda from "./tombol-lunasi-denda";
import TombolNoShow from "./tombol-no-show";

async function DaftarBooking() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/booking");

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
  const daftar = data as unknown as BookingAdmin[];
  const hariIniWIB = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <div className="mt-6 flex flex-col gap-3">
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
          <p className="text-sm text-gray-600">
            {b.tanggal_mulai} s/d {b.tanggal_selesai} · status: {b.status}
          </p>
          <p className="text-sm text-gray-600">
            Estimasi sewa barang bertarif: Rp{estimasiSewa.toLocaleString("id-ID")}
          </p>
          {nilaiGantiBelumDiatur && <p className="text-sm text-amber-700">Nilai barang untuk perhitungan denda belum diisi; lengkapi harga barang pengganti di tabel alat.</p>}
          {adaTarifBelumDiatur && <p className="text-sm text-amber-700">Ada barang paket yang tarifnya dikonfirmasi di toko.</p>}
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
          {b.status === "menunggu_refund" && <TombolRefund bookingId={b.id} />}
        </div>
      );})}
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <p className="mt-2 text-sm text-gray-600">Riwayat semua booking dan antrian refund.</p>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat...</p>}>
        <DaftarBooking />
      </Suspense>
    </main>
  );
}
