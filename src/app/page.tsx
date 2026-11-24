import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold">KALA</h1>
      <p className="mt-2 text-gray-600">Sewa alat pendakian</p>
      <p className="mt-4 max-w-md text-sm text-gray-600">
        Pilih perlengkapan dan tanggal sewa, bayar uang booking Rp20.000 secara online,
        lalu lunasi sewa saat mengambil alat di toko.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/booking" className="rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Mulai booking
        </Link>
        <Link href="/riwayat" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-stone-100">
          Lihat riwayat
        </Link>
      </div>
    </main>
  );
}
