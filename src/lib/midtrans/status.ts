import { midtransConfig } from "./config";
import { createAdminClient } from "@/lib/supabase/server";

const BASE = midtransConfig.isProduction
  ? "https://api.midtrans.com"
  : "https://api.sandbox.midtrans.com";

export async function cekStatusMidtrans(orderId: string) {
  // Authorization: Basic base64(serverKey + ":")
  const auth = Buffer.from(`${midtransConfig.serverKey}:`).toString("base64");

  const res = await fetch(`${BASE}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  // Order yang belum ada atau belum dibayar dibalas non-200
  if (!res.ok) return null;
  return (await res.json()) as { transaction_status: string };
}

export async function sinkronkanBookingMenunggu() {
  const admin = createAdminClient();
  const { data: daftar } = await admin
    .from("booking")
    .select("id, midtrans_order_id")
    .eq("status", "menunggu_bayar")
    .not("midtrans_order_id", "is", null);

  for (const b of daftar ?? []) {
    const st = await cekStatusMidtrans(b.midtrans_order_id!);
    if (st?.transaction_status === "settlement" || st?.transaction_status === "capture") {
      await admin
        .from("booking")
        .update({ status: "terkonfirmasi", updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("status", "menunggu_bayar");
    }
  }
}