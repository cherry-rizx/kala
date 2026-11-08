"use client";

import { useState, useEffect } from "react";
import { buatBooking } from "./actions";
import { bayarBooking } from "./pembayaran";

type AlatItem = {
  id: string;
  nama: string;
  harga_sewa: number;
  stok_total: number;
};

export default function BookingForm({ alat }: { alat: AlatItem[] }) {
  const [hariIni, setHariIni] = useState("");

  useEffect(() => {
    setHariIni(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }));
  }, []);

  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [setujuKetentuan, setSetujuKetentuan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "error" | "sukses"; teks: string } | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  function ubahJumlah(alatId: string, nilai: number) {
    setJumlah((prev) => ({ ...prev, [alatId]: Math.max(0, nilai) }));
  }

  const itemTerpilih = alat
    .filter((a) => (jumlah[a.id] ?? 0) > 0)
    .map((a) => ({ alatId: a.id, jumlah: jumlah[a.id] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);
    setLoading(true);

    const hasil = await buatBooking({
      namaPelanggan,
      tanggalMulai,
      tanggalSelesai,
      items: itemTerpilih,
      setujuKetentuan,
    });

    setLoading(false);

    if (!hasil.ok) {
      setPesan({ tipe: "error", teks: hasil.error });
      return;
    }

    setBookingId(hasil.bookingId);
    setPesan({
      tipe: "sukses",
      teks: `Booking berhasil dibuat. Kode booking: ${hasil.bookingId}. Silakan lakukan pembayaran Rp20.000.`,
    });
  }

  async function handleBayar() {
    if (!bookingId) return;
    setLoading(true);
    const hasil = await bayarBooking(bookingId);
    setLoading(false);

    if (!hasil.ok) {
      setPesan({ tipe: "error", teks: hasil.error });
      return;
    }
    window.location.href = hasil.redirectUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nama pemesan</span>
        <input
          type="text"
          value={namaPelanggan}
          onChange={(e) => setNamaPelanggan(e.target.value)}
          required
          className="rounded border p-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tanggal mulai</span>
          <input
            type="date"
            min={hariIni}
            value={tanggalMulai}
            onChange={(e) => {
              setTanggalMulai(e.target.value);
              if (tanggalSelesai < e.target.value) setTanggalSelesai(e.target.value);
            }}
            required
            className="rounded border p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tanggal selesai</span>
          <input
            type="date"
            min={tanggalMulai || hariIni}
            value={tanggalSelesai}
            onChange={(e) => setTanggalSelesai(e.target.value)}
            required
            className="rounded border p-2"
          />
        </label>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Pilih alat</h2>
        {alat.length === 0 && <p className="text-gray-600">Belum ada alat tersedia.</p>}
        {alat.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{a.nama}</p>
              <p className="text-sm text-gray-600">
                Rp{a.harga_sewa.toLocaleString("id-ID")} / hari · stok {a.stok_total}
              </p>
            </div>
            <input
              type="number"
              min={0}
              max={a.stok_total}
              value={jumlah[a.id] ?? 0}
              onChange={(e) => ubahJumlah(a.id, Number(e.target.value))}
              className="w-20 rounded border p-2"
            />
          </div>
        ))}
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={setujuKetentuan}
          onChange={(e) => setSetujuKetentuan(e.target.checked)}
          className="mt-1"
        />
        <span>
          Saya sudah membaca dan menyetujui ketentuan sewa, termasuk aturan refund, denda, dan
          konsekuensi pelanggaran.
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || itemTerpilih.length === 0 || !setujuKetentuan}
        className="rounded bg-black p-3 text-white disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Booking sekarang"}
      </button>

      {bookingId && (
        <button
          type="button"
          onClick={handleBayar}
          disabled={loading}
          className="rounded bg-green-700 p-3 text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Bayar Rp20.000 sekarang"}
        </button>
      )}

      {pesan && (
        <p className={pesan.tipe === "error" ? "text-red-600" : "text-green-700"}>
          {pesan.teks}
        </p>
      )}
    </form>
  );
}