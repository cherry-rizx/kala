"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

const BATAS_BAYAR_MENIT = 60; // asumsi sementara, nanti dikonfirmasi
const BIAYA_BOOKING = 20000;

type ItemBooking = { alatId: string; jumlah: number };
type ProdukBooking = {
  id: string;
  jenis_barang: string;
  tipe_paket: string | null;
  minimal_peserta: number;
};

type InputBooking = {
  namaPelanggan: string;
  tanggalMulai: string; // format YYYY-MM-DD
  tanggalSelesai: string; // format YYYY-MM-DD
  jenisPaket: "alat_satuan" | "tektok" | "rombongan";
  jumlahPeserta: number;
  items: ItemBooking[];
  setujuKetentuan: boolean;
};

type HasilBooking =
  | { ok: true; bookingId: string; totalSewa: number }
  | { ok: false; error: string };

function hariIniWIB(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function tanggalValid(nilai: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const tanggal = new Date(`${nilai}T00:00:00Z`);
  return Number.isFinite(tanggal.getTime()) && tanggal.toISOString().slice(0, 10) === nilai;
}

export async function buatBooking(input: InputBooking): Promise<HasilBooking> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Data booking tidak valid" };
  }
  // 1. Wajib login
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu" };

  // 2. Validasi input dasar
  if (input.setujuKetentuan !== true) {
    return { ok: false, error: "Anda harus menyetujui ketentuan" };
  }
  if (typeof input.namaPelanggan !== "string" || !input.namaPelanggan.trim()) {
    return { ok: false, error: "Nama pelanggan wajib diisi" };
  }
  if (input.namaPelanggan.trim().length > 120) {
    return { ok: false, error: "Nama pelanggan terlalu panjang" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Pilih minimal satu alat" };
  }
  if (input.items.some((i) => !i || typeof i.alatId !== "string" || !i.alatId)) {
    return { ok: false, error: "Pilihan alat tidak valid" };
  }
  if (new Set(input.items.map((i) => i.alatId)).size !== input.items.length) {
    return { ok: false, error: "Ada alat yang dipilih lebih dari sekali" };
  }
  if (typeof input.tanggalMulai !== "string" || typeof input.tanggalSelesai !== "string"
      || !tanggalValid(input.tanggalMulai) || !tanggalValid(input.tanggalSelesai)) {
    return { ok: false, error: "Tanggal sewa tidak valid" };
  }
  if (input.tanggalMulai < hariIniWIB()) {
    return { ok: false, error: "Tanggal sewa tidak boleh di masa lalu" };
  }
  if (input.tanggalSelesai < input.tanggalMulai) {
    return { ok: false, error: "Tanggal selesai harus sama atau setelah tanggal mulai" };
  }
  if (!["alat_satuan", "tektok", "rombongan"].includes(input.jenisPaket)
      || !Number.isInteger(input.jumlahPeserta) || input.jumlahPeserta < 1) {
    return { ok: false, error: "Pilihan paket atau jumlah pendaki tidak valid" };
  }
  if (input.jenisPaket === "rombongan" && input.jumlahPeserta < 11) {
    return { ok: false, error: "Paket Rombongan tersedia mulai dari 11 pendaki" };
  }
  if (input.items.some((i) => !Number.isInteger(i.jumlah) || i.jumlah <= 0)) {
    return { ok: false, error: "Jumlah alat tidak valid" };
  }

  const admin = createAdminClient();

  const katalogPaket = await admin
    .from("alat")
    .select("id, jenis_barang, tipe_paket, minimal_peserta")
    .in("id", input.items.map((item) => item.alatId))
    .eq("aktif", true);
  let produk: ProdukBooking[];
  if (katalogPaket.error) {
    // Sebelum migrasi katalog, izinkan alur lama untuk barang satuan.
    const katalogLama = await admin
      .from("alat")
      .select("id")
      .in("id", input.items.map((item) => item.alatId))
      .eq("aktif", true);
    if (katalogLama.error || !katalogLama.data || katalogLama.data.length !== input.items.length) {
      return { ok: false, error: "Ada barang yang sudah tidak tersedia. Muat ulang katalog." };
    }
    produk = katalogLama.data.map((item) => ({
      id: item.id,
      jenis_barang: "satuan",
      tipe_paket: null,
      minimal_peserta: 1,
    }));
  } else {
    produk = (katalogPaket.data ?? []) as ProdukBooking[];
  }
  if (produk.length !== input.items.length) {
    return { ok: false, error: "Ada barang yang sudah tidak tersedia. Muat ulang katalog." };
  }

  const produkPaket = produk.filter((item) => item.jenis_barang === "paket");
  if (produkPaket.length > 1) {
    return { ok: false, error: "Pilih maksimal satu barang paketan per booking" };
  }
  if (produkPaket.length === 1) {
    const paket = produkPaket[0];
    const itemPaket = input.items.find((item) => item.alatId === paket.id);
    if (!paket.tipe_paket || itemPaket?.jumlah !== 1) {
      return { ok: false, error: "Jumlah barang paketan tidak valid" };
    }
    if (paket.tipe_paket === "rombongan" && input.jumlahPeserta < Math.max(11, paket.minimal_peserta)) {
      return { ok: false, error: `Paket Rombongan tersedia mulai dari ${Math.max(11, paket.minimal_peserta)} pendaki` };
    }
  }
  const jenisPaket = (produkPaket[0]?.tipe_paket ?? "alat_satuan") as InputBooking["jenisPaket"];
  if (input.jenisPaket !== jenisPaket) {
    return { ok: false, error: "Pilihan paket berubah. Muat ulang katalog." };
  }

  // 3. Ambil versi ketentuan terbaru
  const { data: ketentuan, error: errKetentuan } = await admin
    .from("ketentuan")
    .select("id")
    .order("berlaku_sejak", { ascending: false })
    .limit(1)
    .single();
  if (errKetentuan || !ketentuan) {
    return { ok: false, error: "Ketentuan belum tersedia" };
  }

  // Harga, stok, booking, item, dan bukti persetujuan ditangani satu
  // transaksi database dengan row lock agar dua pemesan tidak lolos bersama.
  const batasBayar = new Date(Date.now() + BATAS_BAYAR_MENIT * 60 * 1000);
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = headerList.get("user-agent");
  let { data, error } = await admin.rpc("buat_booking_atomik", {
    p_pelanggan_id: user.id,
    p_nama_pelanggan: input.namaPelanggan.trim(),
    p_tanggal_mulai: input.tanggalMulai,
    p_tanggal_selesai: input.tanggalSelesai,
    p_jenis_paket: jenisPaket,
    p_jumlah_peserta: produkPaket.length === 0 ? 1 : input.jumlahPeserta,
    p_jumlah_booking: BIAYA_BOOKING,
    p_batas_bayar: batasBayar.toISOString(),
    p_ketentuan_id: ketentuan.id,
    p_ip_address: ip,
    p_user_agent: userAgent,
    p_items: input.items.map((item) => ({ alat_id: item.alatId, jumlah: item.jumlah })),
  });
  if (error?.code === "PGRST202" && produkPaket.length === 0) {
    // Signature RPC lama belum menerima metadata paket; booking satuan tetap berjalan.
    ({ data, error } = await admin.rpc("buat_booking_atomik", {
      p_pelanggan_id: user.id,
      p_nama_pelanggan: input.namaPelanggan.trim(),
      p_tanggal_mulai: input.tanggalMulai,
      p_tanggal_selesai: input.tanggalSelesai,
      p_jumlah_booking: BIAYA_BOOKING,
      p_batas_bayar: batasBayar.toISOString(),
      p_ketentuan_id: ketentuan.id,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_items: input.items.map((item) => ({ alat_id: item.alatId, jumlah: item.jumlah })),
    }));
  }
  if (error?.code === "PGRST202" && produkPaket.length > 0) {
    return { ok: false, error: "Jalankan migrasi-backlog.sql untuk mengaktifkan booking paket." };
  }
  if (error || !data) {
    const pesan = error?.message ?? "";
    if (pesan.includes("STOK_TIDAK_CUKUP")) {
      return { ok: false, error: "Stok alat tidak cukup pada tanggal tersebut" };
    }
    if (pesan.includes("ALAT_TIDAK_TERSEDIA")) {
      return { ok: false, error: "Ada alat yang sedang tidak tersedia" };
    }
    if (pesan.includes("ITEM_DUPLIKAT")) {
      return { ok: false, error: "Ada alat yang dipilih lebih dari sekali" };
    }
    return { ok: false, error: "Gagal menyimpan booking. Coba lagi." };
  }

  const hasil = data as { booking_id: string; total_sewa: number };
  return { ok: true, bookingId: hasil.booking_id, totalSewa: hasil.total_sewa };
}
