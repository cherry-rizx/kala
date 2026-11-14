"use server";

import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { cekStatusMidtrans } from "@/lib/midtrans/status";
import { hitungDenda } from "@/lib/booking/rules";

type Hasil = { ok: true; denda?: number } | { ok: false; error: string };

async function pastikanAdmin() {
  const user = await getCurrentUser();
  return !!user && user.app_metadata?.role === "admin";
}

export async function konfirmasiRefundManual(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, midtrans_order_id")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "menunggu_refund") return { ok: false, error: "Booking ini tidak dalam antrian refund" };
  if (!b.midtrans_order_id) return { ok: false, error: "Booking tidak punya order Midtrans" };

  const st = await cekStatusMidtrans(b.midtrans_order_id);
  if (!st) return { ok: false, error: "Tidak bisa mengecek status ke Midtrans, coba lagi" };
  if (st.transaction_status !== "refund") {
    return { ok: false, error: `Midtrans belum mencatat refund (status: ${st.transaction_status ?? "tidak diketahui"})` };
  }

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: "dibatalkan", refund_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", b.id)
    .eq("status", "menunggu_refund")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan konfirmasi" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true };
}

export async function tandaiSedangDisewa(bookingId: string): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status, tanggal_mulai")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "terkonfirmasi") return { ok: false, error: "Booking ini belum terkonfirmasi atau sudah diambil" };

  const hariIni = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  if (b.tanggal_mulai > hariIni) return { ok: false, error: `Alat baru bisa diambil mulai ${b.tanggal_mulai}` };

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({ status: "sedang_disewa", updated_at: new Date().toISOString() })
    .eq("id", b.id)
    .eq("status", "terkonfirmasi")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan perubahan" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true };
}

export async function kembalikanAlat(bookingId: string, persenRusak: number): Promise<Hasil> {
  if (!(await pastikanAdmin())) return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  if (!Number.isInteger(persenRusak) || persenRusak < 0 || persenRusak > 100) {
    return { ok: false, error: "Persentase kerusakan harus bilangan bulat 0 sampai 100" };
  }

  const admin = createAdminClient();
  const { data: b, error } = await admin
    .from("booking")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (error || !b) return { ok: false, error: "Booking tidak ditemukan" };
  if (b.status !== "sedang_disewa") return { ok: false, error: "Booking ini tidak sedang disewa" };

  const { data: items, error: errItems } = await admin
    .from("booking_item")
    .select("jumlah, alat:alat_id(harga_barang)")
    .eq("booking_id", bookingId);

  if (errItems) return { ok: false, error: "Gagal membaca item booking" };

  const daftar = (items ?? []) as unknown as { jumlah: number; alat: { harga_barang: number } }[];
  const denda = daftar.reduce(
    (total, it) => total + it.jumlah * hitungDenda(it.alat.harga_barang, persenRusak),
    0
  );

  const statusBaru = denda > 0 ? "menunggu_denda" : "selesai";

  const { data: updated, error: errUpdate } = await admin
    .from("booking")
    .update({
      status: statusBaru,
      denda_jumlah: denda,
      denda_persen: persenRusak,
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id)
    .eq("status", "sedang_disewa")
    .select("id");

  if (errUpdate) return { ok: false, error: "Gagal menyimpan pengembalian" };
  if (!updated || updated.length === 0) return { ok: false, error: "Status sudah berubah, muat ulang halaman" };
  return { ok: true, denda };
}