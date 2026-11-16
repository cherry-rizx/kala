import { NextResponse } from "next/server";
import crypto from "crypto";
import { midtransConfig } from "@/lib/midtrans/config";
import { terapkanStatusMidtrans, type StatusMidtrans } from "@/lib/midtrans/status";

type NotifikasiMidtrans = StatusMidtrans & {
  order_id: string;
  status_code: string | number;
  gross_amount: string | number;
  signature_key: string;
};

export async function POST(req: Request) {
  if (!midtransConfig.serverKey) {
    return NextResponse.json({ error: "Konfigurasi Midtrans belum lengkap" }, { status: 503 });
  }

  let body: NotifikasiMidtrans;
  try {
    body = (await req.json()) as NotifikasiMidtrans;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.order_id !== "string" ||
    (typeof body.status_code !== "string" && typeof body.status_code !== "number") ||
    (typeof body.gross_amount !== "string" && typeof body.gross_amount !== "number") ||
    typeof body.signature_key !== "string" ||
    typeof body.transaction_status !== "string"
  ) {
    return NextResponse.json({ error: "Field notifikasi tidak lengkap" }, { status: 400 });
  }

  const expected = crypto
    .createHash("sha512")
    .update(body.order_id + body.status_code + body.gross_amount + midtransConfig.serverKey)
    .digest();
  const received = Buffer.from(body.signature_key, "hex");
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  await terapkanStatusMidtrans(body.order_id, body);
  return NextResponse.json({ ok: true });
}
