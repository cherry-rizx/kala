"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

const BATAS_BAYAR_MENIT = 60; // asumsi sementara, nanti dikonfirmasi
const BIAYA_BOOKING = 20000;

type ItemBooking = { alatId: string; jumlah: number };

type InputBooking = {
  namaPelanggan: string;
  tanggalMulai: string; // format YYYY-MM-DD
  tanggalSelesai: string; // format YYYY-MM-DD
  items: ItemBooking[];
  setujuKetentuan: boolean;
};

type HasilBooking =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

function hariIniWIB(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

export async function buatBooking(input: InputBooking): Promise<HasilBooking> {
  // 1. Wajib login
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu" };

  // 2. Validasi input dasar
  if (!input.setujuKetentuan) {
    return { ok: false, error: "Anda harus menyetujui ketentuan" };
  }
  if (!input.namaPelanggan.trim()) {
    return { ok: false, error: "Nama pelanggan wajib diisi" };
  }
  if (input.items.length === 0) {
    return { ok: false, error: "Pilih minimal satu alat" };
  }
  if (input.tanggalMulai < hariIniWIB()) {
    return { ok: false, error: "Tanggal sewa tidak boleh di masa lalu" };
  }
  if (input.tanggalSelesai < input.tanggalMulai) {
    return { ok: false, error: "Tanggal selesai harus sama atau setelah tanggal mulai" };
  }
  if (input.items.some((i) => !Number.isInteger(i.jumlah) || i.jumlah <= 0)) {
    return { ok: false, error: "Jumlah alat tidak valid" };
  }

  const admin = createAdminClient();

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

  // 4. Ambil data alat dari database, jangan percaya harga dari browser
  const alatIds = input.items.map((i) => i.alatId);
  const { data: alatList, error: errAlat } = await admin
    .from("alat")
    .select("id, harga_sewa, aktif")
    .in("id", alatIds);
  if (errAlat || !alatList || alatList.length !== alatIds.length) {
    return { ok: false, error: "Ada alat yang tidak ditemukan" };
  }
  if (alatList.some((a) => !a.aktif)) {
    return { ok: false, error: "Ada alat yang sedang tidak tersedia" };
  }

  // 5. Cek ketersediaan setiap alat
  for (const item of input.items) {
    const { data: tersedia, error } = await admin.rpc("cek_ketersediaan", {
      p_alat_id: item.alatId,
      p_mulai: input.tanggalMulai,
      p_selesai: input.tanggalSelesai,
      p_jumlah: item.jumlah,
    });
    if (error || !tersedia) {
      return { ok: false, error: "Stok alat tidak cukup pada tanggal tersebut" };
    }
  }

  // 6. Simpan booking
  const batasBayar = new Date(Date.now() + BATAS_BAYAR_MENIT * 60 * 1000);

  const { data: booking, error: errBooking } = await admin
    .from("booking")
    .insert({
      pelanggan_id: user.id,
      nama_pelanggan: input.namaPelanggan.trim(),
      tanggal_mulai: input.tanggalMulai,
      tanggal_selesai: input.tanggalSelesai,
      jumlah_booking: BIAYA_BOOKING,
      status: "menunggu_bayar",
      batas_bayar: batasBayar.toISOString(),
    })
    .select("id")
    .single();
  if (errBooking || !booking) {
    return { ok: false, error: "Gagal menyimpan booking" };
  }

  // 7. Simpan item booking dengan harga saat ini
  const hargaPerAlat = new Map(alatList.map((a) => [a.id, a.harga_sewa]));
  const { error: errItem } = await admin.from("booking_item").insert(
    input.items.map((item) => ({
      booking_id: booking.id,
      alat_id: item.alatId,
      jumlah: item.jumlah,
      harga_satuan: hargaPerAlat.get(item.alatId)!,
    }))
  );
  if (errItem) {
    // Rollback: hapus booking yang sudah terlanjur dibuat
    await admin.from("booking").delete().eq("id", booking.id);
    return { ok: false, error: "Gagal menyimpan detail alat" };
  }

  // 8. Simpan bukti persetujuan
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = headerList.get("user-agent");

  const { error: errPersetujuan } = await admin.from("persetujuan").insert({
    pelanggan_id: user.id,
    booking_id: booking.id,
    ketentuan_id: ketentuan.id,
    ip_address: ip,
    user_agent: userAgent,
  });
  if (errPersetujuan) {
    await admin.from("booking").delete().eq("id", booking.id);
    return { ok: false, error: "Gagal menyimpan persetujuan" };
  }

  return { ok: true, bookingId: booking.id };
}