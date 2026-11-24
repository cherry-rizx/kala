type ItemDenda = {
  nama: string;
  jumlah: number;
  hargaBarang: number;
};

export type BarisDenda = {
  id: string;
  namaPelanggan: string;
  tanggalMulai: string;
  status: string;
  persen: number;
  totalDenda: number;
  items: ItemDenda[];
};

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export default function TabelDenda({ baris }: { baris: BarisDenda[] }) {
  if (baris.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-8 text-center">
        <p className="font-semibold text-amber-950">Belum ada denda tercatat</p>
        <p className="mt-1 text-sm text-amber-800">Denda dari pengembalian barang akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-amber-950 text-amber-50">
          <tr>
            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider">Pelanggan</th>
            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider">Tgl ambil</th>
            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider">Alat terdampak</th>
            <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider">Kerusakan</th>
            <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider">Total denda</th>
            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => {
            const lunas = b.status === "selesai";
            return (
              <tr key={b.id} className="border-t border-amber-100 align-top transition-colors odd:bg-white even:bg-amber-50/40 hover:bg-amber-50">
                <td className="px-5 py-4 font-semibold text-stone-900">{b.namaPelanggan}</td>
                <td className="whitespace-nowrap px-5 py-4 text-stone-600">{b.tanggalMulai}</td>
                <td className="px-5 py-4">
                  <ul className="flex flex-col gap-1">
                    {b.items.map((it, index) => (
                      <li key={`${b.id}-${index}`} className="flex flex-wrap items-baseline gap-x-1 text-stone-800">
                        <span className="font-medium">{it.nama}</span>
                        <span className="text-stone-500">× {it.jumlah}</span>
                        <span className="text-xs text-stone-500">({rupiah(it.hargaBarang)} / unit)</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                    {b.persen}%
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-amber-950">
                  {rupiah(b.totalDenda)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                      lunas ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {lunas ? "Lunas" : "Belum lunas"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
