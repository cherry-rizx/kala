-- Jalankan setelah migrasi-backlog.sql. Kolom katalog paket dibuat di sini
-- agar migrasi ini tetap bisa dijalankan bila migrasi-katalog-paket.sql terlewat.
-- Mengimpor daftar harga dari Daftar_Harga_Sewa_Alat_Pendakian.xlsx.
-- Stok paket tidak tersedia di Excel: paket dibuat dengan stok 0 sampai toko
-- mengisi stok paket mandiri. Gas kaleng tidak dikelola stoknya di website.

alter table public.alat
  add column if not exists jenis_barang text not null default 'satuan',
  add column if not exists tipe_paket text,
  add column if not exists minimal_peserta integer not null default 1,
  add column if not exists deskripsi text,
  add column if not exists kode_produk text,
  add column if not exists kategori text,
  add column if not exists skema_harga text not null default 'harian',
  add column if not exists stok_dikelola boolean not null default true,
  add column if not exists durasi_hari integer,
  add column if not exists maksimal_peserta integer,
  add column if not exists opsi_varian jsonb not null default '{}'::jsonb;

create unique index if not exists alat_kode_produk_uidx
  on public.alat (kode_produk) where kode_produk is not null;

alter table public.alat drop constraint if exists alat_jenis_barang_check;
alter table public.alat add constraint alat_jenis_barang_check
  check (jenis_barang in ('satuan', 'paket', 'add_on'));

alter table public.alat drop constraint if exists alat_tipe_paket_check;
alter table public.alat add constraint alat_tipe_paket_check
  check (tipe_paket is null or tipe_paket in ('tektok', 'rombongan', 'camp'));

alter table public.alat drop constraint if exists alat_jenis_paket_cocok_check;
alter table public.alat add constraint alat_jenis_paket_cocok_check
  check (
    (jenis_barang = 'satuan' and tipe_paket is null)
    or (jenis_barang = 'paket' and tipe_paket is not null)
    or (jenis_barang = 'add_on' and tipe_paket is null)
  );

alter table public.alat drop constraint if exists alat_paket_minimal_peserta_check;
alter table public.alat add constraint alat_paket_minimal_peserta_check
  check (minimal_peserta >= 1);

alter table public.alat drop constraint if exists alat_skema_harga_check;
alter table public.alat add constraint alat_skema_harga_check
  check (skema_harga in ('harian', 'sekali_sewa', 'jual_putus', 'paket'));
alter table public.alat drop constraint if exists alat_durasi_hari_check;
alter table public.alat add constraint alat_durasi_hari_check
  check (durasi_hari is null or durasi_hari > 0);
alter table public.alat drop constraint if exists alat_maksimal_peserta_check;
alter table public.alat add constraint alat_maksimal_peserta_check
  check (maksimal_peserta is null or maksimal_peserta >= minimal_peserta);

alter table public.booking drop constraint if exists booking_jenis_paket_check;
alter table public.booking add constraint booking_jenis_paket_check
  check (jenis_paket in ('alat_satuan', 'tektok', 'rombongan', 'camp'));

alter table public.booking_item
  add column if not exists skema_harga text not null default 'harian',
  add column if not exists opsi_pilihan jsonb not null default '{}'::jsonb;
alter table public.booking_item drop constraint if exists booking_item_skema_harga_check;
alter table public.booking_item add constraint booking_item_skema_harga_check
  check (skema_harga in ('harian', 'sekali_sewa', 'jual_putus', 'paket'));

-- Produk placeholder lama digantikan oleh 5 paket yang namanya ada di Excel.
update public.alat
set aktif = false
where kode_produk is null
  and (
    nama in (
      'Tenda Dome 2 Orang', 'Tenda Dome 4 Orang', 'Carrier 60L',
      'Sleeping Bag', 'Kompor Portable',
      'Paket Pendakian Tektok', 'Paket Pendakian Rombongan'
    )
  );

insert into public.alat as current_alat (
  kode_produk, nama, kategori, harga_sewa, harga_barang, stok_total,
  jenis_barang, tipe_paket, minimal_peserta, maksimal_peserta, deskripsi,
  skema_harga, stok_dikelola, durasi_hari, opsi_varian, aktif
) values
  ('SAT-001', 'Tenda Kapasitas 4–5 Orang', 'Shelter & Tidur', 50000, 0, 1, 'satuan', null, 1, null,
   'Double layer / dome, sudah termasuk pasak & frame lengkap.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-002', 'Carrier Eiger Rhinos 60L', 'Tas Gunung', 35000, 0, 1, 'satuan', null, 1, null,
   'Sudah termasuk rain cover bawaan Eiger.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-003', 'Daypack Consina', 'Tas Gunung', 20000, 0, 1, 'satuan', null, 1, null,
   'Kapasitas ringkas, ideal untuk tektok atau summit attack.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-004', 'Sepatu Gunung (Size 39)', 'Alas Kaki', 30000, 0, 1, 'satuan', null, 1, null,
   'Wajib kembali dalam kondisi bersih & kering.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-005', 'Sepatu Gunung (Size 40)', 'Alas Kaki', 30000, 0, 1, 'satuan', null, 1, null,
   'Wajib kembali dalam kondisi bersih & kering.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-006', 'Jaket The North Face (Seri MP3)', 'Pakaian Gunung', 45000, 0, 1, 'satuan', null, 1, null,
   'Windproof & water-repellent, tarif sekali sewa berlaku sampai 3 hari.', 'sekali_sewa', true, 3, '{}'::jsonb, true),
  ('SAT-007', 'Jaket Puffer (Pupper)', 'Pakaian Gunung', 40000, 0, 1, 'satuan', null, 1, null,
   'Insulasi hangat untuk suhu ekstrem puncak, tarif sekali sewa berlaku sampai 3 hari.', 'sekali_sewa', true, 3, '{}'::jsonb, true),
  ('SAT-008', 'Celana Gunung Quickdry', 'Pakaian Gunung', 20000, 0, 2, 'satuan', null, 1, null,
   'Tarif per potong; bahan cepat kering & ringan, berlaku sampai 3 hari.', 'sekali_sewa', true, 3, '{}'::jsonb, true),
  ('SAT-009', 'Topi Rimba / Gunung Eiger', 'Aksesori', 10000, 0, 1, 'satuan', null, 1, null,
   'Perlindungan UV & gerimis ringan, tarif sekali sewa berlaku sampai 3 hari.', 'sekali_sewa', true, 3, '{}'::jsonb, true),
  ('SAT-010', 'Sleeping Bag (Polar / Dacron)', 'Shelter & Tidur', 15000, 0, 1, 'satuan', null, 1, null,
   'Sudah dicuci bersih & wangi sebelum disewakan.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-011', 'Matras Gulung', 'Shelter & Tidur', 5000, 0, 1, 'satuan', null, 1, null,
   'Alas tidur standar tenda.', 'harian', true, null, '{}'::jsonb, true),
  ('SAT-012', 'Cooking Set (Nesting + Kompor Portable)', 'Alat Masak', 25000, 0, 1, 'satuan', null, 1, null,
   '1 set nesting & kompor mini; gas kaleng dijual terpisah.', 'harian', true, null, '{}'::jsonb, true),
  ('ADD-001', 'Gas Kaleng Hi-Cook (Baru)', 'Logistik Masak', 22000, 0, 0, 'add_on', null, 1, null,
   'Beli putus. Sangat disarankan bersama Cooking Set.', 'jual_putus', false, null, '{}'::jsonb, true),
  ('ADD-002', 'Gas Kaleng Refill (Isi Ulang)', 'Logistik Masak', 12000, 0, 0, 'add_on', null, 1, null,
   'Beli putus; alternatif ekonomis untuk pendakian singkat.', 'jual_putus', false, null, '{}'::jsonb, true),
  ('PKT-01', 'Paket Tektok Ringan', 'Paket Tektok', 75000, 0, 0, 'paket', 'tektok', 1, 1,
   '1 Daypack Consina · 1 Sepatu Gunung (size 39/40) · 1 Jaket (TNF MP3/Puffer) · 1 Topi Eiger.', 'paket', true, 1,
   '{"Sepatu Gunung":["Size 39","Size 40"],"Jaket Gunung":["TNF MP3","Puffer"]}'::jsonb, true),
  ('PKT-02', 'Paket Tektok Ngopi di Puncak', 'Paket Tektok', 90000, 0, 0, 'paket', 'tektok', 1, 1,
   '1 Daypack Consina · 1 Sepatu Gunung (size 39/40) · 1 Jaket (TNF MP3/Puffer) · 1 Cooking Set.', 'paket', true, 1,
   '{"Sepatu Gunung":["Size 39","Size 40"],"Jaket Gunung":["TNF MP3","Puffer"]}'::jsonb, true),
  ('PKT-03', 'Paket Camp Rombongan (4–5 Orang)', 'Paket Camp', 145000, 0, 0, 'paket', 'camp', 4, 5,
   '1 Tenda kapasitas 4–5 orang · 1 Cooking Set · 1 Sleeping Bag · 1 Matras. Durasi 3 hari 2 malam.', 'paket', true, 3, '{}'::jsonb, true),
  ('PKT-04', 'Paket Camp Solo Siap Nanjak', 'Paket Camp', 215000, 0, 0, 'paket', 'camp', 1, 1,
   '1 Carrier 60L · 1 Sepatu Gunung (size 39/40) · 1 Jaket (TNF MP3/Puffer) · 1 Celana · 1 Sleeping Bag + 1 Matras. Durasi 3 hari 2 malam.', 'paket', true, 3,
   '{"Sepatu Gunung":["Size 39","Size 40"],"Jaket Gunung":["TNF MP3","Puffer"]}'::jsonb, true),
  ('PKT-05', 'Paket Sultan All-In (Couple / Full Stok)', 'Paket Camp', 335000, 0, 0, 'paket', 'camp', 2, 2,
   '1 Tenda 4–5 orang + 1 Carrier 60L + 1 Daypack · 2 Sepatu (size 39 & 40) + 2 Jaket (TNF & Puffer) · 2 Celana + 1 Topi · 1 Cooking Set + 1 Sleeping Bag + 1 Matras. Durasi 3 hari 2 malam.', 'paket', true, 3, '{}'::jsonb, true)
on conflict (kode_produk) where kode_produk is not null do update set
  nama = excluded.nama,
  kategori = excluded.kategori,
  harga_sewa = excluded.harga_sewa,
  stok_total = case when excluded.jenis_barang = 'paket' then current_alat.stok_total else excluded.stok_total end,
  jenis_barang = excluded.jenis_barang,
  tipe_paket = excluded.tipe_paket,
  minimal_peserta = excluded.minimal_peserta,
  maksimal_peserta = excluded.maksimal_peserta,
  deskripsi = excluded.deskripsi,
  skema_harga = excluded.skema_harga,
  stok_dikelola = excluded.stok_dikelola,
  durasi_hari = excluded.durasi_hari,
  opsi_varian = excluded.opsi_varian,
  aktif = excluded.aktif;

create or replace function public.buat_booking_atomik(
  p_pelanggan_id uuid,
  p_nama_pelanggan text,
  p_tanggal_mulai date,
  p_tanggal_selesai date,
  p_jenis_paket text,
  p_jumlah_peserta integer,
  p_jumlah_booking integer,
  p_batas_bayar timestamptz,
  p_ketentuan_id uuid,
  p_ip_address text,
  p_user_agent text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_jumlah_item integer;
  v_jumlah_alat_unik integer;
  v_total_hari integer;
  v_total_sewa integer;
  v_item record;
  v_stok integer;
  v_stok_dikelola boolean;
  v_terpesan integer;
begin
  if p_tanggal_mulai is null or p_tanggal_selesai is null or p_tanggal_selesai < p_tanggal_mulai then
    raise exception 'TANGGAL_TIDAK_VALID';
  end if;
  if p_jenis_paket is null or p_jenis_paket not in ('alat_satuan', 'tektok', 'rombongan', 'camp')
     or p_jumlah_peserta is null or p_jumlah_peserta < 1 then
    raise exception 'PAKET_TIDAK_VALID';
  end if;
  if p_jenis_paket = 'rombongan' and p_jumlah_peserta < 11 then
    raise exception 'MINIMAL_11_PESERTA';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ITEM_TIDAK_VALID';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
    where x.alat_id is null or x.jumlah is null or x.jumlah <= 0
  ) then
    raise exception 'ITEM_TIDAK_VALID';
  end if;
  select count(*), count(distinct x.alat_id) into v_jumlah_item, v_jumlah_alat_unik
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer);
  if v_jumlah_item <> v_jumlah_alat_unik then raise exception 'ITEM_DUPLIKAT'; end if;

  perform a.id
  from public.alat a
  join (select distinct x.alat_id from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)) requested
    on requested.alat_id = a.id
  order by a.id
  for update of a;

  for v_item in
    select x.alat_id, x.jumlah
    from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
    order by x.alat_id
  loop
    select a.stok_total, a.stok_dikelola into v_stok, v_stok_dikelola
    from public.alat a where a.id = v_item.alat_id and a.aktif = true;
    if not found then raise exception 'ALAT_TIDAK_TERSEDIA'; end if;

    if v_stok_dikelola then
      select coalesce(sum(bi.jumlah), 0)::integer into v_terpesan
      from public.booking_item bi
      join public.booking b on b.id = bi.booking_id
      where bi.alat_id = v_item.alat_id
        and b.status in ('menunggu_bayar', 'terkonfirmasi', 'sedang_disewa', 'menunggu_denda')
        and (b.status <> 'menunggu_bayar' or b.batas_bayar > now())
        and b.tanggal_mulai <= p_tanggal_selesai and b.tanggal_selesai >= p_tanggal_mulai;
      if v_terpesan + v_item.jumlah > v_stok then raise exception 'STOK_TIDAK_CUKUP'; end if;
    end if;
  end loop;

  v_total_hari := p_tanggal_selesai - p_tanggal_mulai + 1;
  select coalesce(sum(
    x.jumlah * case a.skema_harga
      when 'harian' then a.harga_sewa * v_total_hari
      else a.harga_sewa
    end
  ), 0)::integer into v_total_sewa
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
  join public.alat a on a.id = x.alat_id and a.aktif = true;

  insert into public.booking (
    pelanggan_id, nama_pelanggan, tanggal_mulai, tanggal_selesai,
    jenis_paket, jumlah_peserta, jumlah_booking, total_sewa, status, batas_bayar
  ) values (
    p_pelanggan_id, trim(p_nama_pelanggan), p_tanggal_mulai, p_tanggal_selesai,
    p_jenis_paket, p_jumlah_peserta, p_jumlah_booking, v_total_sewa, 'menunggu_bayar', p_batas_bayar
  ) returning id into v_booking_id;

  insert into public.booking_item (
    booking_id, alat_id, jumlah, harga_satuan, harga_barang_satuan, skema_harga, opsi_pilihan
  )
  select v_booking_id, x.alat_id, x.jumlah, a.harga_sewa, a.harga_barang,
    a.skema_harga, coalesce(x.opsi_pilihan, '{}'::jsonb)
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer, opsi_pilihan jsonb)
  join public.alat a on a.id = x.alat_id;

  insert into public.persetujuan (pelanggan_id, booking_id, ketentuan_id, ip_address, user_agent)
  values (p_pelanggan_id, v_booking_id, p_ketentuan_id, p_ip_address, p_user_agent);

  return jsonb_build_object('booking_id', v_booking_id, 'total_sewa', v_total_sewa);
end;
$$;

notify pgrst, 'reload schema';
