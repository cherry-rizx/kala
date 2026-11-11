import { midtransConfig } from "./config";

const BASE = midtransConfig.isProduction
  ? "https://api.midtrans.com"
  : "https://api.sandbox.midtrans.com";

export async function refundMidtrans(params: {
  orderId: string;
  refundKey: string;
  amount: number;
  reason: string;
}) {
  const auth = Buffer.from(`${midtransConfig.serverKey}:`).toString("base64");

  const res = await fetch(
    `${BASE}/v2/${encodeURIComponent(params.orderId)}/refund/online/direct`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        refund_key: params.refundKey,
        amount: params.amount,
        reason: params.reason,
      }),
      cache: "no-store",
    }
  );

  const json = await res.json();
  return { ok: res.ok, json };
}