import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/session";
import BookingForm from "./booking-form";

async function FormBooking() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSessionClient();
  const { data: alat, error } = await supabase
    .from("alat")
    .select("id, nama, harga_sewa, stok_total")
    .eq("aktif", true)
    .order("nama");

  if (error) {
    return <p className="text-red-600">Gagal memuat daftar alat: {error.message}</p>;
  }

  return <BookingForm alat={alat ?? []} />;
}

export default function BookingPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Booking Alat Pendakian</h1>
      <Suspense fallback={<p className="mt-6 text-gray-600">Memuat daftar alat...</p>}>
        <FormBooking />
      </Suspense>
    </main>
  );
}