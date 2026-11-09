import midtransClient from "midtrans-client";
import { midtransConfig } from "./config";

const snap = new midtransClient.Snap({
  isProduction: midtransConfig.isProduction,
  serverKey: midtransConfig.serverKey,
  clientKey: midtransConfig.clientKey,
});

type ParamTransaksi = {
  orderId: string;
  jumlah: number;
  namaPelanggan: string;
  email: string;
};

export async function buatTransaksiSnap(p: ParamTransaksi) {
  const params = {
    transaction_details: {
      order_id: p.orderId,
      gross_amount: p.jumlah,
    },
    customer_details: {
      first_name: p.namaPelanggan,
      email: p.email,
    },
    item_details: [
      { id: "BOOKING", price: p.jumlah, quantity: 1, name: "Uang booking KALA" },
    ],
  };

  const transaksi = await snap.createTransaction(
    params as Parameters<typeof snap.createTransaction>[0]
  );

  return {
    token: transaksi.token as string,
    redirectUrl: transaksi.redirect_url as string,
  };
}