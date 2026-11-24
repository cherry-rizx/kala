"use client";

import { useMemo, useState } from "react";
import { buatBooking } from "./actions";
import { bayarBooking } from "./pembayaran";

type AlatItem = {
  id: string;
  nama: string;
  harga_sewa: number;
  stok_total: number;
  jenis_barang: "satuan" | "paket" | "add_on";
  tipe_paket: "tektok" | "rombongan" | "camp" | null;
  minimal_peserta: number;
  maksimal_peserta: number | null;
  deskripsi: string | null;
  kategori: string | null;
  skema_harga: "harian" | "sekali_sewa" | "jual_putus" | "paket";
  stok_dikelola: boolean;
  durasi_hari: number | null;
  opsi_varian: Record<string, string[]>;
};

type JenisPaket = "alat_satuan" | "tektok" | "rombongan" | "camp";
type Ketentuan = { id: string; versi: string; isi: string };

function rupiah(nilai: number) {
  return `Rp${nilai.toLocaleString("id-ID")}`;
}

function ikonAlat(nama: string) {
  const value = nama.toLowerCase();
  if (value.includes("tenda")) return "⛺";
  if (value.includes("carrier") || value.includes("tas")) return "🎒";
  if (value.includes("sleeping") || value.includes("matras")) return "🛏️";
  if (value.includes("kompor") || value.includes("masak")) return "🍳";
  return "🧭";
}

function KartuProduk({
  item,
  jumlah,
  onUbah,
}: {
  item: AlatItem;
  jumlah: number;
  onUbah: (jumlah: number) => void;
}) {
  const paket = item.jenis_barang === "paket";
  const ikon = paket ? (item.tipe_paket === "camp" || item.tipe_paket === "rombongan" ? "🏕️" : "🥾") : ikonAlat(item.nama);
  return (
    <article className={`group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg ${jumlah > 0 ? "border-emerald-800 ring-1 ring-emerald-800" : "border-stone-200"}`}>
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-stone-100 to-amber-50">
        <span className="absolute -right-5 -top-8 size-32 rounded-full bg-white/60 blur-2xl" aria-hidden="true" />
        <span className="relative flex size-20 items-center justify-center rounded-3xl border border-white/80 bg-white/80 text-5xl shadow-sm transition group-hover:scale-105" aria-hidden="true">{ikon}</span>
        {jumlah > 0 && <span className="absolute right-3 top-3 rounded-full bg-emerald-900 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">DIPILIH</span>}
      </div>
      <div className="p-4">
        <div className="flex min-h-12 items-start justify-between gap-3">
          <h3 className="font-bold leading-5 text-stone-900">{item.nama}</h3>
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-500">
            {item.stok_dikelola ? (item.stok_total > 0 ? `${item.stok_total} tersedia` : "Stok belum diatur") : "Stok toko"}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          {paket
            ? item.deskripsi || (item.tipe_paket === "rombongan" ? `Isi paket menyusul · minimal ${item.minimal_peserta} pendaki` : "Isi paket tektok menyusul")
            : item.deskripsi || "Perlengkapan satuan"}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-emerald-950">{rupiah(item.harga_sewa)}</p>
            <p className="text-[11px] text-stone-500">
              {item.skema_harga === "harian" ? "per unit / hari" : item.skema_harga === "sekali_sewa" ? `sekali sewa${item.durasi_hari ? ` · maks ${item.durasi_hari} hari` : ""}` : item.skema_harga === "paket" ? `${item.durasi_hari} hari · harga paket` : "beli putus · dibayar di toko"}
            </p>
          </div>
          {paket ? (
            <button type="button" onClick={() => onUbah(jumlah > 0 ? 0 : 1)} disabled={item.stok_total < 1} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-40 ${jumlah > 0 ? "border border-stone-300 text-stone-700" : "bg-emerald-950 text-white hover:bg-emerald-800"}`}>
              {jumlah > 0 ? "Hapus paket" : "Pilih paket"}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 p-1">
              <button type="button" aria-label={`Kurangi ${item.nama}`} onClick={() => onUbah(jumlah - 1)} disabled={jumlah <= 0} className="flex size-8 items-center justify-center rounded-lg text-lg font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-30">−</button>
              <span className="min-w-5 text-center text-sm font-bold tabular-nums">{jumlah}</span>
              <button type="button" aria-label={`Tambah ${item.nama}`} onClick={() => onUbah(jumlah + 1)} disabled={item.stok_dikelola ? jumlah >= item.stok_total : jumlah >= 50} className="flex size-8 items-center justify-center rounded-lg bg-emerald-950 text-lg font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-30">+</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function BookingForm({
  alat,
  paketKatalogAktif,
  hariIni,
  ketentuan,
}: {
  alat: AlatItem[];
  paketKatalogAktif: boolean;
  hariIni: string;
  ketentuan: Ketentuan | null;
}) {
  const [jumlahPeserta, setJumlahPeserta] = useState("1");
  const [cari, setCari] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [varianPilihan, setVarianPilihan] = useState<Record<string, Record<string, string>>>({});
  const [setujuKetentuan, setSetujuKetentuan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "error" | "sukses"; teks: string } | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const lamaSewa = tanggalMulai && tanggalSelesai
    ? Math.floor((Date.parse(`${tanggalSelesai}T00:00:00Z`) - Date.parse(`${tanggalMulai}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const peserta = Number(jumlahPeserta);
  const paketTerpilih = alat.find((item) => item.jenis_barang === "paket" && (jumlah[item.id] ?? 0) > 0);
  const jenisPaket: JenisPaket = paketTerpilih?.tipe_paket ?? "alat_satuan";
  const pesertaMin = paketTerpilih?.minimal_peserta ?? 1;
  const pesertaMax = paketTerpilih?.maksimal_peserta ?? null;
  const paketRombonganBelumCukup = Boolean(paketTerpilih && (peserta < pesertaMin || (pesertaMax !== null && peserta > pesertaMax)));

  const alatTerfilter = useMemo(() => {
    const query = cari.trim().toLowerCase();
    return alat.filter((item) => item.nama.toLowerCase().includes(query));
  }, [alat, cari]);

  const itemTerpilih = alat
    .filter((item) => (jumlah[item.id] ?? 0) > 0)
    .map((item) => {
      const pilihan = { ...(varianPilihan[item.id] ?? {}) };
      for (const [nama, opsi] of Object.entries(item.opsi_varian ?? {})) {
        if (!pilihan[nama] && opsi.length > 0) pilihan[nama] = opsi[0];
      }
      return { alatId: item.id, jumlah: jumlah[item.id], opsiPilihan: pilihan };
    });

  const estimasiTotal = itemTerpilih.reduce((total, pilihan) => {
    const barang = alat.find((item) => item.id === pilihan.alatId);
    if (!barang) return total;
    const jumlahHari = Math.max(lamaSewa, 1);
    const harga = barang.skema_harga === "harian" ? barang.harga_sewa * jumlahHari : barang.harga_sewa;
    return total + harga * pilihan.jumlah;
  }, 0);

  function ubahJumlah(alatId: string, nilai: number) {
    const produk = alat.find((item) => item.id === alatId);
    if (!produk) return;
    // Paket punya batas jumlah pendaki sendiri; mulai dari nilai minimalnya
    // agar tombol booking tidak langsung terkunci (mis. paket 4–5 orang).
    if (produk.jenis_barang === "paket" && nilai > 0) {
      setJumlahPeserta(String(produk.minimal_peserta));
    }
    setJumlah((sebelumnya) => ({
      ...(produk.jenis_barang === "paket"
        ? Object.fromEntries(alat.filter((item) => item.jenis_barang === "paket").map((item) => [item.id, 0]))
        : sebelumnya),
      [alatId]: produk.jenis_barang === "paket" ? Math.min(1, Math.max(0, nilai)) : Math.min(produk.stok_dikelola ? produk.stok_total : 50, Math.max(0, nilai)),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPesan(null);
    setLoading(true);

    try {
      const hasil = await buatBooking({
        namaPelanggan,
        tanggalMulai,
        tanggalSelesai,
        jenisPaket,
        jumlahPeserta: paketTerpilih ? peserta : 1,
        items: itemTerpilih,
        setujuKetentuan,
        ketentuanId: ketentuan?.id,
      });

      if (!hasil.ok) {
        setPesan({ tipe: "error", teks: hasil.error });
        return;
      }

      setBookingId(hasil.bookingId);
      setPesan({
        tipe: "sukses",
        teks: `Booking berhasil dibuat. Uang booking Rp20.000 dibayar online; seluruh pelunasan sewa dilakukan di toko.`,
      });
    } catch {
      setPesan({ tipe: "error", teks: "Booking belum berhasil dibuat. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  async function handleBayar() {
    if (!bookingId) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await bayarBooking(bookingId);
      if (!hasil.ok) {
        setPesan({ tipe: "error", teks: hasil.error });
        return;
      }
      window.location.href = hasil.redirectUrl;
    } catch {
      setPesan({ tipe: "error", teks: "Pembayaran belum dapat dibuka. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start">
      <div className="min-w-0 space-y-10">
        <section aria-labelledby="paket-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">KATALOG PAKET</p>
              <h2 id="paket-heading" className="mt-1 text-2xl font-bold tracking-tight">Pilih barang paketan</h2>
              <p className="mt-1 text-sm text-stone-500">Harga paket mengikuti daftar harga; stok paket dihitung terpisah dari barang satuan.</p>
            </div>
          </div>
          {!paketKatalogAktif ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              Katalog barang satuan tetap bisa digunakan. Untuk mengaktifkan produk paket, jalankan
              <code className="mx-1 rounded bg-white px-1.5 py-0.5">migrasi-backlog.sql</code> lalu
              <code className="mx-1 rounded bg-white px-1.5 py-0.5">migrasi-daftar-harga-excel.sql</code>
              di Supabase.
            </div>
          ) : alatTerfilter.some((item) => item.jenis_barang === "paket") ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {alatTerfilter.filter((item) => item.jenis_barang === "paket").map((item) => (
                <KartuProduk key={item.id} item={item} jumlah={jumlah[item.id] ?? 0} onUbah={(nilai) => { ubahJumlah(item.id, nilai); setPesan(null); }} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              Produk paket belum ditambahkan ke katalog.
            </div>
          )}

          {paketTerpilih && (
            <div className="mt-4 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <label htmlFor="jumlah-peserta" className="block text-sm font-bold text-stone-900">
                  Jumlah pendaki untuk {paketTerpilih.nama}
                </label>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {pesertaMax === pesertaMin
                    ? `Paket ini untuk ${pesertaMin} pendaki.`
                    : pesertaMax
                      ? `Paket ini untuk ${pesertaMin}–${pesertaMax} pendaki.`
                      : `Minimal ${pesertaMin} pendaki.`}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3 sm:mt-0">
                <input
                  id="jumlah-peserta"
                  type="number"
                  min={pesertaMin}
                  max={pesertaMax ?? undefined}
                  step={1}
                  value={jumlahPeserta}
                  onChange={(event) => setJumlahPeserta(event.target.value)}
                  className="w-28 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-center font-semibold outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
                  required
                />
                <span className="text-sm text-stone-500">orang</span>
              </div>
              {paketRombonganBelumCukup && (
                <p className="mt-2 text-sm font-medium text-red-700 sm:basis-full">
                  Jumlah pendaki harus {pesertaMax === pesertaMin ? `tepat ${pesertaMin}` : `antara ${pesertaMin} dan ${pesertaMax ?? "seterusnya"}`} untuk paket ini.
                </p>
              )}
            </div>
          )}
          {paketTerpilih && Object.keys(paketTerpilih.opsi_varian ?? {}).length > 0 && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
              {Object.entries(paketTerpilih.opsi_varian).map(([nama, opsi]) => (
                <label key={nama} className="block text-sm font-semibold text-stone-800">
                  {nama}
                  <select
                    value={varianPilihan[paketTerpilih.id]?.[nama] ?? opsi[0] ?? ""}
                    onChange={(event) => setVarianPilihan((state) => ({
                      ...state,
                      [paketTerpilih.id]: { ...state[paketTerpilih.id], [nama]: event.target.value },
                    }))}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal"
                    required
                  >
                    {opsi.map((nilai) => <option key={nilai} value={nilai}>{nilai}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {paketTerpilih?.durasi_hari && lamaSewa > 0 && paketTerpilih.durasi_hari !== lamaSewa && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Paket ini harus dibooking selama {paketTerpilih.durasi_hari} hari.
            </p>
          )}
        </section>

        <section aria-labelledby="alat-heading">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">KATALOG BARANG SATUAN</p>
              <h2 id="alat-heading" className="mt-1 text-2xl font-bold tracking-tight">Pilih perlengkapan satuan</h2>
              <p className="mt-1 text-sm text-stone-500">Tambahkan barang satuan jika diperlukan bersama paket atau booking satuan.</p>
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">Cari alat</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">⌕</span>
              <input
                type="search"
                value={cari}
                onChange={(event) => setCari(event.target.value)}
                placeholder="Cari perlengkapan..."
                className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-stone-400 focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
              />
            </label>
          </div>

          {alatTerfilter.filter((item) => item.jenis_barang === "satuan").length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
              Barang satuan dengan nama “{cari}” tidak ditemukan.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {alatTerfilter.filter((item) => item.jenis_barang === "satuan").map((item) => (
                <KartuProduk key={item.id} item={item} jumlah={jumlah[item.id] ?? 0} onUbah={(nilai) => ubahJumlah(item.id, nilai)} />
              ))}
            </div>
          )}
        </section>

        {alatTerfilter.some((item) => item.jenis_barang === "add_on") && (
          <section aria-labelledby="addon-heading">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">TAMBAHAN BELI PUTUS</p>
              <h2 id="addon-heading" className="mt-1 text-2xl font-bold tracking-tight">Add-on logistik</h2>
              <p className="mt-1 text-sm text-stone-500">Tambahan masuk ke booking dan dibayar di toko.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {alatTerfilter.filter((item) => item.jenis_barang === "add_on").map((item) => (
                <KartuProduk key={item.id} item={item} jumlah={jumlah[item.id] ?? 0} onUbah={(nilai) => ubahJumlah(item.id, nilai)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="bg-emerald-950 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">RINGKASAN</p>
            <h2 className="mt-1 text-lg font-bold">Booking pendakian</h2>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Jenis pemesanan</p>
              <p className="mt-1 font-bold text-stone-900">
                {paketTerpilih?.nama ?? "Barang satuan"}
              </p>
              {paketTerpilih && (
                <p className="mt-0.5 text-xs text-stone-500">{Number.isFinite(peserta) ? peserta : 0} pendaki</p>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-stone-700">Nama pemesan</span>
              <input
                type="text"
                value={namaPelanggan}
                onChange={(event) => setNamaPelanggan(event.target.value)}
                placeholder="Nama lengkap"
                required
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-stone-700">Mulai sewa</span>
                <input
                  type="date"
                  min={hariIni}
                  value={tanggalMulai}
                  onChange={(event) => {
                    setTanggalMulai(event.target.value);
                    if (tanggalSelesai < event.target.value) setTanggalSelesai(event.target.value);
                  }}
                  required
                  className="w-full min-w-0 rounded-xl border border-stone-200 px-2 py-2.5 text-xs outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-stone-700">Selesai sewa</span>
                <input
                  type="date"
                  min={tanggalMulai || hariIni}
                  value={tanggalSelesai}
                  onChange={(event) => setTanggalSelesai(event.target.value)}
                  required
                  className="w-full min-w-0 rounded-xl border border-stone-200 px-2 py-2.5 text-xs outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
                />
              </label>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Alat dipilih</p>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">{itemTerpilih.length} jenis</span>
              </div>
              {itemTerpilih.length === 0 ? (
                <p className="rounded-xl bg-stone-50 px-3 py-3 text-xs leading-5 text-stone-500">Belum ada alat. Tambahkan perlengkapan dari katalog.</p>
              ) : (
                <ul className="max-h-36 space-y-2 overflow-y-auto pr-1">
                  {itemTerpilih.map((pilihan) => {
                    const item = alat.find((barang) => barang.id === pilihan.alatId);
                    return (
                      <li key={pilihan.alatId} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 text-stone-700">
                          {item?.nama} <span className="text-stone-400">× {pilihan.jumlah}</span>
                          {Object.keys(pilihan.opsiPilihan).length > 0 && <span className="block text-[10px] text-stone-500">{Object.entries(pilihan.opsiPilihan).map(([nama, nilai]) => `${nama}: ${nilai}`).join(" · ")}</span>}
                        </span>
                        <span className="shrink-0 font-semibold text-stone-800">
                          {rupiah((item?.harga_sewa ?? 0) * pilihan.jumlah * (item?.skema_harga === "harian" ? Math.max(lamaSewa, 1) : 1))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t border-stone-100 pt-4">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Estimasi sewa & add-on{lamaSewa > 0 ? ` · ${lamaSewa} hari` : ""}</span>
                <span className="font-semibold text-stone-900">{rupiah(estimasiTotal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-bold text-amber-950">Booking online</p>
                  <p className="text-[10px] text-amber-900/70">Sisa sewa dilunasi di toko</p>
                </div>
                <span className="font-extrabold text-amber-950">Rp20.000</span>
              </div>
            </div>

            {ketentuan ? (
              <details className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                <summary className="cursor-pointer font-semibold text-stone-800">
                  Baca ketentuan sewa (versi {ketentuan.versi})
                </summary>
                <div className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line leading-5">
                  {ketentuan.isi.trim()}
                </div>
              </details>
            ) : (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Ketentuan sewa belum tersedia; booking belum dapat dibuat.
              </p>
            )}

            <label className="flex items-start gap-2 text-xs leading-5 text-stone-600">
              <input
                type="checkbox"
                checked={setujuKetentuan}
                onChange={(event) => setSetujuKetentuan(event.target.checked)}
                className="mt-0.5 size-4 accent-emerald-900"
              />
              <span>Saya menyetujui ketentuan sewa, refund, dan denda.</span>
            </label>

            <button
              type="submit"
              disabled={loading || !ketentuan || itemTerpilih.length === 0 || !setujuKetentuan || paketRombonganBelumCukup || Boolean(paketTerpilih?.durasi_hari && lamaSewa > 0 && paketTerpilih.durasi_hari !== lamaSewa)}
              className="w-full rounded-xl bg-emerald-950 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? "Memproses..." : bookingId ? "Buat booking baru" : "Lanjut booking · Rp20.000"}
            </button>

            {bookingId && (
              <button
                type="button"
                onClick={handleBayar}
                disabled={loading}
                className="w-full rounded-xl border border-emerald-900 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {loading ? "Membuka pembayaran..." : "Bayar uang booking sekarang"}
              </button>
            )}

            {pesan && (
              <p role="status" className={`rounded-xl px-3 py-2.5 text-xs leading-5 ${pesan.tipe === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
                {pesan.teks}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] leading-5 text-stone-500">Total sewa adalah estimasi berdasarkan harga alat saat ini. Pembayaran sewa diselesaikan di toko.</p>
      </aside>
    </form>
  );
}
