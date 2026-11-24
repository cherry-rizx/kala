import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import RiwayatList from "./riwayat-list";
import { sinkronkanBookingMenunggu } from "@/lib/midtrans/status";

async function DaftarRiwayat() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await sinkronkanBookingMenunggu(user.id);

  // RLS memastikan hanya booking milik user ini yang terambil
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("booking")
    .select("id, nama_pelanggan, status, tanggal_mulai, tanggal_selesai, batas_bayar, created_at, items:booking_item(id, jumlah, alat:alat_id(nama))")
    .order("created_at", { ascending: false });

  if (error) return <p className="text-red-600">Gagal memuat riwayat: {error.message}</p>;

  const refundById = new Map<string, number>();
  if (data?.length) {
    const { data: refundRows } = await supabase
      .from("booking")
      .select("id, refund_jumlah")
      .in("id", data.map((booking) => booking.id));
    for (const item of refundRows ?? []) refundById.set(item.id, Number(item.refund_jumlah ?? 0));
  }
  const paketById = new Map<string, { jenis: "alat_satuan" | "tektok" | "rombongan" | "camp"; peserta: number; totalSewa: number }>();
  if (data?.length) {
    const { data: paketRows } = await supabase
      .from("booking")
      .select("id, jenis_paket, jumlah_peserta, total_sewa")
      .in("id", data.map((booking) => booking.id));
    for (const item of paketRows ?? []) {
      if (["alat_satuan", "tektok", "rombongan", "camp"].includes(item.jenis_paket)) {
        paketById.set(item.id, {
          jenis: item.jenis_paket as "alat_satuan" | "tektok" | "rombongan" | "camp",
          peserta: Number(item.jumlah_peserta ?? 1),
          totalSewa: Number(item.total_sewa ?? 0),
        });
      }
    }
  }
  type ItemRiwayat = { id: string; jumlah: number; alat: { nama: string } | null };
  const bookings = (data ?? []).map((booking) => ({
    ...booking,
    items: ((booking.items ?? []) as unknown as ItemRiwayat[]).map((item) => ({
      id: item.id,
      jumlah: item.jumlah,
      nama: item.alat?.nama ?? "Alat tidak lagi tersedia",
    })),
    total_sewa: paketById.get(booking.id)?.totalSewa ?? 0,
    refund_jumlah: refundById.get(booking.id) ?? 0,
    jenis_paket: paketById.get(booking.id)?.jenis,
    jumlah_peserta: paketById.get(booking.id)?.peserta,
  }));

  return <RiwayatList bookings={bookings} />;
}

export default function RiwayatPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Riwayat Booking</h1>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat riwayat...</p>}>
        <DaftarRiwayat />
      </Suspense>
    </main>
  );
}
