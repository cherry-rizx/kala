"use server";

import { getCurrentUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HARGA_MAKS = 100_000_000;
const STOK_MAKS = 10_000;

export type InputAlat = {
  hargaSewa: number;
  hargaBarang: number;
  stokTotal: number;
  aktif: boolean;
};

type Hasil = { ok: true; snapshotDiperbarui: number } | { ok: false; error: string };

function angkaValid(nilai: unknown, maks: number): nilai is number {
  return typeof nilai === "number" && Number.isInteger(nilai) && nilai >= 0 && nilai <= maks;
}

export async function perbaruiAlat(alatId: string, input: InputAlat): Promise<Hasil> {
  const user = await getCurrentUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang bisa melakukan aksi ini" };
  }
  if (typeof alatId !== "string" || !UUID_RE.test(alatId)) return { ok: false, error: "Alat tidak valid" };
  if (!input || typeof input !== "object") return { ok: false, error: "Data alat tidak valid" };
  if (!angkaValid(input.hargaSewa, HARGA_MAKS)) return { ok: false, error: "Harga sewa harus bilangan bulat 0 sampai 100 juta" };
  if (!angkaValid(input.hargaBarang, HARGA_MAKS)) return { ok: false, error: "Harga barang harus bilangan bulat 0 sampai 100 juta" };
  if (!angkaValid(input.stokTotal, STOK_MAKS)) return { ok: false, error: "Stok harus bilangan bulat 0 sampai 10.000" };
  if (typeof input.aktif !== "boolean") return { ok: false, error: "Status aktif tidak valid" };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("alat")
    .update({
      harga_sewa: input.hargaSewa,
      harga_barang: input.hargaBarang,
      stok_total: input.stokTotal,
      aktif: input.aktif,
    })
    .eq("id", alatId)
    .select("id");
  if (error) return { ok: false, error: "Gagal menyimpan perubahan alat" };
  if (!updated || updated.length === 0) return { ok: false, error: "Alat tidak ditemukan" };

  // Booking yang dibuat saat nilai barang belum diatur menyimpan snapshot 0,
  // sehingga denda kerusakannya selalu Rp0. Lengkapi snapshot itu untuk
  // booking yang alatnya belum dikembalikan. Snapshot yang sudah berisi
  // nilai tidak diubah agar harga yang disepakati pelanggan tetap berlaku.
  let snapshotDiperbarui = 0;
  if (input.hargaBarang > 0) {
    const { data: bookingAktif } = await admin
      .from("booking")
      .select("id")
      .in("status", ["menunggu_bayar", "terkonfirmasi", "sedang_disewa"]);
    const idBooking = (bookingAktif ?? []).map((b) => b.id);
    if (idBooking.length > 0) {
      const { data: snapshot } = await admin
        .from("booking_item")
        .update({ harga_barang_satuan: input.hargaBarang })
        .eq("alat_id", alatId)
        .eq("harga_barang_satuan", 0)
        .in("booking_id", idBooking)
        .select("id");
      snapshotDiperbarui = snapshot?.length ?? 0;
    }
  }

  return { ok: true, snapshotDiperbarui };
}
