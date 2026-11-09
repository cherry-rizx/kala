import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { midtransConfig } from "@/lib/midtrans/config";

export async function POST(req: Request) {
  const body = await req.json();
  const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;

  const expected = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + midtransConfig.serverKey)
    .digest("hex");

  if (expected !== signature_key) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  if (transaction_status === "settlement" || transaction_status === "capture") {
    const bookingId = String(order_id).slice(0, 36);
    const admin = createAdminClient();

    await admin
      .from("booking")
      .update({ status: "terkonfirmasi", updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("status", "menunggu_bayar");
  }

  return NextResponse.json({ ok: true });
}