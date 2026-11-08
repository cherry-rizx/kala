import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { midtransConfig } from "@/lib/midtrans/config";

export async function POST(req: Request) {
  const body = await req.json();
  const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;
  console.log("WEBHOOK MASUK:", order_id, transaction_status);

  const expected = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + midtransConfig.serverKey)
    .digest("hex");

  if (expected !== signature_key) {
    console.log("SIGNATURE TIDAK COCOK");
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  if (transaction_status === "settlement" || transaction_status === "capture") {
    const bookingId = String(order_id).slice(0, 36);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("booking")
      .update({ status: "terkonfirmasi", updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("status", "menunggu_bayar")
      .select("id, status");

    console.log("UPDATE BOOKING:", bookingId, data, error);
  }

  return NextResponse.json({ ok: true });
}