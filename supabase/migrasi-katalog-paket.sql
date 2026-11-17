-- Jalankan setelah migrasi-backlog.sql.
-- Produk paket dibuat sebagai item katalog tersendiri. Isi, tarif, dan stok
-- awalnya dapat dilengkapi setelah daftar paket ditetapkan.

alter table public.alat
  add column if not exists jenis_barang text not null default 'satuan',
  add column if not exists tipe_paket text,
  add column if not exists minimal_peserta integer not null default 1,
  add column if not exists deskripsi text;

alter table public.alat drop constraint if exists alat_jenis_barang_check;
alter table public.alat
  add constraint alat_jenis_barang_check
  check (jenis_barang in ('satuan', 'paket'));

alter table public.alat drop constraint if exists alat_tipe_paket_check;
alter table public.alat
  add constraint alat_tipe_paket_check
  check (tipe_paket is null or tipe_paket in ('tektok', 'rombongan'));

alter table public.alat drop constraint if exists alat_paket_minimal_peserta_check;
alter table public.alat
  add constraint alat_paket_minimal_peserta_check
  check (minimal_peserta >= 1);

alter table public.alat drop constraint if exists alat_jenis_paket_cocok_check;
alter table public.alat
  add constraint alat_jenis_paket_cocok_check
  check (
    (jenis_barang = 'satuan' and tipe_paket is null)
    or (jenis_barang = 'paket' and tipe_paket is not null)
  );

-- Dua produk awal agar bagian Paket langsung tersedia di katalog.
-- Harga dan isi paket belum ditetapkan; pembayaran sewa tetap dilakukan di toko.
insert into public.alat (
  nama, harga_sewa, harga_barang, stok_total, jenis_barang, tipe_paket, minimal_peserta
)
select 'Paket Pendakian Tektok', 0, 0, 1, 'paket', 'tektok', 1
where not exists (
  select 1 from public.alat where jenis_barang = 'paket' and tipe_paket = 'tektok'
);

insert into public.alat (
  nama, harga_sewa, harga_barang, stok_total, jenis_barang, tipe_paket, minimal_peserta
)
select 'Paket Pendakian Rombongan', 0, 0, 1, 'paket', 'rombongan', 11
where not exists (
  select 1 from public.alat where jenis_barang = 'paket' and tipe_paket = 'rombongan'
);
