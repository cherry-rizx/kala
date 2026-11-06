const BIAYA_BOOKING = 20000;
const MIN_HARI_REFUND = 7;

export function hitungHariSelisih(tanggalSewa: Date, tanggalBatal: Date): number {
  const msPerHari = 24 * 60 * 60 * 1000;
  const sewa = new Date(tanggalSewa.toDateString()).getTime();
  const batal = new Date(tanggalBatal.toDateString()).getTime();
  return Math.round((sewa - batal) / msPerHari);
}

export function hitungRefund(tanggalSewa: Date, tanggalBatal: Date, nominal = BIAYA_BOOKING): number {
  const selisih = hitungHariSelisih(tanggalSewa, tanggalBatal);
  return selisih >= MIN_HARI_REFUND ? nominal : 0;
}

export function hitungDenda(hargaBarang: number, persenKerusakan: number): number {
  const persen = Math.min(Math.max(persenKerusakan, 0), 100);
  return Math.round((hargaBarang * persen) / 100);
}

export function hitungHariSelisih(tanggalSewa: Date, tanggalBatal: Date): number {
  const msPerHari = 24 * 60 * 60 * 1000;
  const sewa = Date.UTC(tanggalSewa.getFullYear(), tanggalSewa.getMonth(), tanggalSewa.getDate());
  const batal = Date.UTC(tanggalBatal.getFullYear(), tanggalBatal.getMonth(), tanggalBatal.getDate());
  return Math.round((sewa - batal) / msPerHari);
}