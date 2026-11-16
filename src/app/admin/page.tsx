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
    .select("id, nama_pelanggan, status, tanggal_mulai, tanggal_selesai, total_sewa, refund_jumlah, denda_jumlah, items:booking_item(id, jumlah, harga_barang_satuan, alat:alat_id(nama))")
    .order("tanggal_mulai", { ascending: false });

  if (error) return <p className="text-red-600">Gagal memuat data: {error.message}</p>;
  if (!data || data.length === 0) return <p className="mt-6 text-gray-600">Belum ada booking.</p>;
  const hariIniWIB = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <div className="mt-6 flex flex-col gap-3">
      {data.map((b) => (
        <div key={b.id} className="rounded border p-4">
          <p className="font-medium">{b.nama_pelanggan}</p>
          <p className="text-sm text-gray-600">
            {b.tanggal_mulai} s/d {b.tanggal_selesai} · status: {b.status}
          </p>
          <p className="text-sm text-gray-600">
            Total sewa: Rp{Number(b.total_sewa ?? 0).toLocaleString("id-ID")}
          </p>
          {b.refund_jumlah ? (
            <p className="text-sm text-gray-600">Refund: Rp{Number(b.refund_jumlah).toLocaleString("id-ID")}</p>
          ) : null}
          {b.denda_jumlah ? (
            <p className="text-sm text-gray-600">Denda: Rp{Number(b.denda_jumlah).toLocaleString("id-ID")}</p>
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
                harga_barang_satuan: number;
                alat: { nama: string };
              }[]).map((item) => ({
                id: item.id,
                nama: item.alat.nama,
                jumlah: item.jumlah,
                hargaBarang: Number(item.harga_barang_satuan),
              }))}
            />
          )}
          {b.status === "menunggu_denda" && (
            <TombolLunasiDenda bookingId={b.id} jumlahDenda={Number(b.denda_jumlah ?? 0)} />
          )}
          {b.status === "menunggu_refund" && <TombolRefund bookingId={b.id} />}
        </div>
      ))}
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
