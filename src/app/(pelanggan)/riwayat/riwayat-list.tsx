"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batalkanBooking } from "../booking/batal";

type Booking = {
  id: string;
  nama_pelanggan: string;
  status: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  created_at: string;
};

function tampilStatus(status: string) {
  return status === "menunggu_refund" ? "dibatalkan" : status;
}

export default function RiwayatList({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function handleBatal(id: string) {
    setLoadingId(id);
    setPesan(null);
    try {
      const hasil = await batalkanBooking(id);
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }
      if (hasil.status === "menunggu_refund") {
        setPesan(
          `Pembatalan diterima. Refund Rp${hasil.refund.toLocaleString("id-ID")} menunggu konfirmasi admin.`
        );
      } else if (hasil.status === "dibatalkan") {
        setPesan("Booking dibatalkan.");
      } else {
        setPesan("Booking hangus, tidak ada refund karena pembatalan H-7 atau kurang.");
      }
      router.refresh();
    } catch {
      setPesan("Terjadi error saat membatalkan, coba lagi.");
    } finally {
      setLoadingId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="mt-6 text-gray-600">Belum ada booking.</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {pesan && <p className="text-sm">{pesan}</p>}
      {bookings.map((b) => (
        <div key={b.id} className="rounded border p-4">
          <p className="font-medium">{b.nama_pelanggan}</p>
          <p className="text-sm text-gray-600">
            {b.tanggal_mulai} s/d {b.tanggal_selesai} · status: {tampilStatus(b.status)}
          </p>
          {b.status === "terkonfirmasi" && (
            <button
              type="button"
              onClick={() => handleBatal(b.id)}
              disabled={loadingId === b.id}
              className="mt-3 rounded border border-red-600 px-3 py-1 text-red-600 disabled:opacity-50"
            >
              {loadingId === b.id ? "Memproses..." : "Batalkan booking"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}