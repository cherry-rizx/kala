"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batalkanBooking } from "../booking/batal";
import { bayarBooking } from "../booking/pembayaran";
import BadgeStatus from "@/components/badge-status";

type Booking = {
  id: string;
  nama_pelanggan: string;
  status: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jenis_paket?: "alat_satuan" | "tektok" | "rombongan" | "camp";
  jumlah_peserta?: number;
  refund_jumlah: number | null;
  batas_bayar: string | null;
  total_sewa: number;
  items: { id: string; jumlah: number; nama: string }[];
  created_at: string;
};

function formatWaktuWIB(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RiwayatList({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function handleBayar(id: string) {
    setLoadingId(id);
    setPesan(null);
    try {
      const hasil = await bayarBooking(id);
      if (!hasil.ok) {
        setPesan(hasil.error);
        router.refresh();
        return;
      }
      window.location.assign(hasil.redirectUrl);
    } catch {
      setPesan("Pembayaran belum dapat dibuka. Silakan coba lagi.");
    } finally {
      setLoadingId(null);
    }
  }

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
              Paket {b.jenis_paket === "camp" ? "Camp" : b.jenis_paket === "rombongan" ? "Rombongan" : "Tektok"}
              {b.jumlah_peserta ? ` · ${b.jumlah_peserta} pendaki` : ""}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{b.tanggal_mulai} s/d {b.tanggal_selesai}</span>
            <BadgeStatus status={b.status} />
          </div>
          {b.items.length > 0 && (
            <ul className="mt-2 text-sm text-gray-700">
              {b.items.map((item) => (
                <li key={item.id}>{item.nama} × {item.jumlah}</li>
              ))}
            </ul>
          )}
          {b.total_sewa > 0 && (
            <p className="mt-1 text-sm text-gray-600">
              Estimasi sewa: Rp{b.total_sewa.toLocaleString("id-ID")} (dilunasi di toko)
            </p>
          )}
          {b.status === "menunggu_bayar" && b.batas_bayar && (
            <p className="mt-1 text-sm text-amber-800">
              Bayar uang booking sebelum {formatWaktuWIB(b.batas_bayar)} WIB, atau booking dibatalkan otomatis.
            </p>
          )}
          {Number(b.refund_jumlah) > 0 && (
            <p className="text-sm text-gray-600">
              {b.status === "menunggu_refund" ? "Refund yang menunggu diproses" : "Refund tercatat"}: Rp{Number(b.refund_jumlah).toLocaleString("id-ID")}
            </p>
          )}
          {b.status === "menunggu_bayar" && (
            <button
              type="button"
              onClick={() => handleBayar(b.id)}
              disabled={loadingId === b.id}
              className="mr-2 mt-3 rounded border border-emerald-800 px-3 py-1 text-emerald-900 disabled:opacity-50"
            >
              {loadingId === b.id ? "Memproses..." : "Bayar uang booking"}
            </button>
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
