import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import RiwayatList from "./riwayat-list";
import { sinkronkanBookingMenunggu } from "@/lib/midtrans/status";

async function DaftarRiwayat() {
  await connection();
  await sinkronkanBookingMenunggu();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // RLS memastikan hanya booking milik user ini yang terambil
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("booking")
    .select("id, nama_pelanggan, status, tanggal_mulai, tanggal_selesai, created_at")
    .order("created_at", { ascending: false });

  if (error) return <p className="text-red-600">Gagal memuat riwayat: {error.message}</p>;

  return <RiwayatList bookings={data ?? []} />;
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