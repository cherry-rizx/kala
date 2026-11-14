import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";

async function DaftarBooking() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/booking");

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("booking")
    .select("id, nama_pelanggan, status, tanggal_mulai, tanggal_selesai, refund_jumlah")
    .order("tanggal_mulai", { ascending: false });

  if (error) return <p className="text-red-600">Gagal memuat data: {error.message}</p>;
  if (!data || data.length === 0) {
    return <p className="mt-6 text-gray-600">Belum ada booking.</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {data.map((b) => (
        <div key={b.id} className="rounded border p-4">
          <p className="font-medium">{b.nama_pelanggan}</p>
          <p className="text-sm text-gray-600">
            {b.tanggal_mulai} s/d {b.tanggal_selesai} · status: {b.status}
          </p>
          {b.refund_jumlah ? (
            <p className="text-sm text-gray-600">
              Refund: Rp{b.refund_jumlah.toLocaleString("id-ID")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <p className="mt-2 text-sm text-gray-600">Riwayat semua booking.</p>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat...</p>}>
        <DaftarBooking />
      </Suspense>
    </main>
  );
}