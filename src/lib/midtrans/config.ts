export const midtransConfig = {
  serverKey: process.env.MIDTRANS_SERVER_KEY ?? "",
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "",
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
};