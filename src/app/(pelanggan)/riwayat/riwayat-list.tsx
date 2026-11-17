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
  jenis_paket?: "alat_satuan" | "tektok" | "rombongan";
  jumlah_peserta?: number;
  refund_jumlah: number | null;
  created_at: string;
};

function tampilStatus(status: string) {
  return status === "menunggu_refund" ? "menunggu refund" : status;
}

export default function RiwayatList({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function handleBatal(id: string, status: string) {
    const konfirmasi = status === "menunggu_bayar"
      ? "Batalkan booking yang belum dibayar?"
      : "Ajukan pembatalan booking ini? Ketentuan refund H-8 tetap berlaku.";
    if (!confirm(konfirmasi)) return;

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
        setPesan("Booking hangus, tidak ada refund karena pembatalan kurang dari H-8.");
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
          {b.jenis_paket && b.jenis_paket !== "alat_satuan" && (
            <p className="text-sm text-gray-600">
              Paket {b.jenis_paket === "rombongan" ? "Rombongan" : "Tektok"}
              {b.jumlah_peserta ? ` · ${b.jumlah_peserta} pendaki` : ""}
            </p>
          )}
          <p className="text-sm text-gray-600">
            {b.tanggal_mulai} s/d {b.tanggal_selesai} · status: {tampilStatus(b.status)}
          </p>
          {Number(b.refund_jumlah) > 0 && (
            <p className="text-sm text-gray-600">
              {b.status === "menunggu_refund" ? "Refund yang menunggu diproses" : "Refund tercatat"}: Rp{Number(b.refund_jumlah).toLocaleString("id-ID")}
            </p>
          )}
          {(b.status === "menunggu_bayar" || b.status === "terkonfirmasi") && (
            <button
              type="button"
              onClick={() => handleBatal(b.id, b.status)}
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
