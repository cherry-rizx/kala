-- Jalankan sesudah schema.sql, alat.sql, dan migrasi-rentang-tanggal.sql.
-- Menyelaraskan kolom yang dipakai aplikasi dan menambahkan operasi atomik.

alter table public.booking
  add column if not exists total_sewa integer not null default 0,
  add column if not exists midtrans_order_id text,
  add column if not exists refund_jumlah integer not null default 0,
  add column if not exists refund_at timestamptz,
  add column if not exists denda_jumlah integer not null default 0,
  add column if not exists denda_persen integer;

alter table public.booking_item
  add column if not exists harga_barang_satuan integer,
  add column if not exists denda_persen integer,
  add column if not exists denda_jumlah integer not null default 0;

update public.booking_item bi
set harga_barang_satuan = a.harga_barang
from public.alat a
where a.id = bi.alat_id and bi.harga_barang_satuan is null;

alter table public.booking_item
  alter column harga_barang_satuan set not null;

alter table public.booking drop constraint if exists booking_status_check;
alter table public.booking
  add constraint booking_status_check check (status in (
    'menunggu_bayar',
    'terkonfirmasi',
    'menunggu_refund',
    'dibatalkan',
    'hangus',
    'sedang_disewa',
    'menunggu_denda',
    'selesai'
  ));

-- Menyimpan setiap percobaan pembayaran agar callback dari order lama pun
-- tetap bisa dicocokkan, termasuk pembayaran yang masuk setelah booking hangus.
create table if not exists public.booking_pembayaran (
  order_id text primary key,
  booking_id uuid not null references public.booking(id) on delete cascade,
  jumlah integer not null check (jumlah > 0),
  status text not null default 'dibuat',
  transaction_status text,
  redirect_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_pembayaran
  add column if not exists redirect_url text;

create index if not exists booking_pembayaran_booking_id_idx
  on public.booking_pembayaran (booking_id);

alter table public.booking_pembayaran enable row level security;

-- Perbarui nilai booking lama berdasarkan snapshot harga item yang tersimpan.
update public.booking b
set total_sewa = coalesce((
  select sum(bi.jumlah * bi.harga_satuan)
  from public.booking_item bi
  where bi.booking_id = b.id
), 0) * (b.tanggal_selesai - b.tanggal_mulai + 1);

create or replace function public.buat_booking_atomik(
  p_pelanggan_id uuid,
  p_nama_pelanggan text,
  p_tanggal_mulai date,
  p_tanggal_selesai date,
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
  v_terpesan integer;
begin
  if p_tanggal_mulai is null or p_tanggal_selesai is null
     or p_tanggal_selesai < p_tanggal_mulai then
    raise exception 'TANGGAL_TIDAK_VALID';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'ITEM_TIDAK_VALID';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'ITEM_TIDAK_VALID';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
    where x.alat_id is null or x.jumlah is null or x.jumlah <= 0
  ) then
    raise exception 'ITEM_TIDAK_VALID';
  end if;

  select count(*), count(distinct x.alat_id)
    into v_jumlah_item, v_jumlah_alat_unik
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer);
  if v_jumlah_item <> v_jumlah_alat_unik then
    raise exception 'ITEM_DUPLIKAT';
  end if;

  -- Mengunci alat berdasarkan urutan ID yang tetap agar booking serentak
  -- untuk alat yang sama tidak sama-sama lolos pemeriksaan stok.
  perform a.id
  from public.alat a
  join (
    select distinct x.alat_id
    from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
  ) requested on requested.alat_id = a.id
  order by a.id
  for update of a;

  for v_item in
    select x.alat_id, x.jumlah
    from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
    order by x.alat_id
  loop
    select a.stok_total into v_stok
    from public.alat a
    where a.id = v_item.alat_id and a.aktif = true;
    if not found then
      raise exception 'ALAT_TIDAK_TERSEDIA';
    end if;

    select coalesce(sum(bi.jumlah), 0)::integer into v_terpesan
    from public.booking_item bi
    join public.booking b on b.id = bi.booking_id
    where bi.alat_id = v_item.alat_id
      and b.status in ('menunggu_bayar', 'terkonfirmasi', 'sedang_disewa', 'menunggu_denda')
      and (b.status <> 'menunggu_bayar' or b.batas_bayar > now())
      and b.tanggal_mulai <= p_tanggal_selesai
      and b.tanggal_selesai >= p_tanggal_mulai;

    if v_terpesan + v_item.jumlah > v_stok then
      raise exception 'STOK_TIDAK_CUKUP';
    end if;
  end loop;

  v_total_hari := p_tanggal_selesai - p_tanggal_mulai + 1;
  select coalesce(sum(x.jumlah * a.harga_sewa), 0)::integer * v_total_hari
    into v_total_sewa
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
  join public.alat a on a.id = x.alat_id and a.aktif = true;

  insert into public.booking (
    pelanggan_id, nama_pelanggan, tanggal_mulai, tanggal_selesai,
    jumlah_booking, total_sewa, status, batas_bayar
  ) values (
    p_pelanggan_id, trim(p_nama_pelanggan), p_tanggal_mulai, p_tanggal_selesai,
    p_jumlah_booking, v_total_sewa, 'menunggu_bayar', p_batas_bayar
  ) returning id into v_booking_id;

  insert into public.booking_item (
    booking_id, alat_id, jumlah, harga_satuan, harga_barang_satuan
  )
  select v_booking_id, x.alat_id, x.jumlah, a.harga_sewa, a.harga_barang
  from jsonb_to_recordset(p_items) as x(alat_id uuid, jumlah integer)
  join public.alat a on a.id = x.alat_id;

  insert into public.persetujuan (
    pelanggan_id, booking_id, ketentuan_id, ip_address, user_agent
  ) values (
    p_pelanggan_id, v_booking_id, p_ketentuan_id, p_ip_address, p_user_agent
  );

  return jsonb_build_object('booking_id', v_booking_id, 'total_sewa', v_total_sewa);
end;
$$;

create or replace function public.buat_percobaan_pembayaran(
  p_booking_id uuid,
  p_order_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_jumlah integer;
  v_order_aktif text;
begin
  select b.jumlah_booking into v_jumlah
  from public.booking b
  where b.id = p_booking_id
    and b.status = 'menunggu_bayar'
    and (b.batas_bayar is null or b.batas_bayar > now())
  for update;

  if not found then
    raise exception 'BOOKING_TIDAK_MENUNGGU_PEMBAYARAN';
  end if;

  update public.booking_pembayaran
  set status = 'gagal', updated_at = now()
  where booking_id = p_booking_id
    and status = 'dibuat'
    and created_at < now() - interval '10 minutes';

  select bp.order_id into v_order_aktif
  from public.booking_pembayaran bp
  where bp.booking_id = p_booking_id
    and bp.status in ('dibuat', 'pending')
  order by bp.created_at desc
  limit 1
  for update;
  if found then
    raise exception 'PAYMENT_SUDAH_ADA';
  end if;

  insert into public.booking_pembayaran (order_id, booking_id, jumlah, status)
  values (p_order_id, p_booking_id, v_jumlah, 'dibuat');

  update public.booking
  set midtrans_order_id = p_order_id, updated_at = now()
  where id = p_booking_id;
end;
$$;

create or replace function public.catat_pengembalian_atomik(
  p_booking_id uuid,
  p_kerusakan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_item_count integer;
  v_damage_count integer;
  v_unique_damage_count integer;
  v_denda_total integer;
  v_persen_maks integer;
  v_status_baru text;
  v_booking_status text;
begin
  select b.status into v_booking_status
  from public.booking b
  where b.id = p_booking_id
  for update;
  if not found then
    raise exception 'BOOKING_TIDAK_DITEMUKAN';
  end if;
  if v_booking_status <> 'sedang_disewa' then
    raise exception 'BOOKING_BUKAN_SEDANG_DISEWA';
  end if;
  if p_kerusakan is null or jsonb_typeof(p_kerusakan) <> 'array' then
    raise exception 'KERUSAKAN_TIDAK_VALID';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_kerusakan) as x(booking_item_id uuid, persen integer)
    where x.booking_item_id is null or x.persen is null or x.persen < 0 or x.persen > 100
  ) then
    raise exception 'KERUSAKAN_TIDAK_VALID';
  end if;

  perform bi.id
  from public.booking_item bi
  where bi.booking_id = p_booking_id
  order by bi.id
  for update;

  select count(*) into v_item_count
  from public.booking_item bi where bi.booking_id = p_booking_id;
  select count(*), count(distinct x.booking_item_id)
    into v_damage_count, v_unique_damage_count
  from jsonb_to_recordset(p_kerusakan) as x(booking_item_id uuid, persen integer);
  if v_item_count = 0 or v_item_count <> v_damage_count or v_damage_count <> v_unique_damage_count
     or exists (
       select 1
       from jsonb_to_recordset(p_kerusakan) as x(booking_item_id uuid, persen integer)
       left join public.booking_item bi
         on bi.id = x.booking_item_id and bi.booking_id = p_booking_id
       where bi.id is null
     ) then
    raise exception 'ITEM_KERUSAKAN_TIDAK_COCOK';
  end if;

  update public.booking_item bi
  set denda_persen = x.persen,
      denda_jumlah = bi.jumlah * round(bi.harga_barang_satuan * x.persen / 100.0)::integer
  from jsonb_to_recordset(p_kerusakan) as x(booking_item_id uuid, persen integer)
  where bi.id = x.booking_item_id
    and bi.booking_id = p_booking_id;

  select coalesce(sum(bi.denda_jumlah), 0)::integer,
         coalesce(max(bi.denda_persen), 0)::integer
    into v_denda_total, v_persen_maks
  from public.booking_item bi
  where bi.booking_id = p_booking_id;

  v_status_baru := case when v_denda_total > 0 then 'menunggu_denda' else 'selesai' end;
  update public.booking
  set status = v_status_baru,
      denda_jumlah = v_denda_total,
      denda_persen = v_persen_maks,
      updated_at = now()
  where id = p_booking_id;

  return jsonb_build_object('denda_total', v_denda_total, 'status_baru', v_status_baru);
end;
$$;

revoke all on function public.buat_booking_atomik(uuid, text, date, date, integer, timestamptz, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.buat_booking_atomik(uuid, text, date, date, integer, timestamptz, uuid, text, text, jsonb) to service_role;
revoke all on function public.buat_percobaan_pembayaran(uuid, text) from public, anon, authenticated;
grant execute on function public.buat_percobaan_pembayaran(uuid, text) to service_role;
revoke all on function public.catat_pengembalian_atomik(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.catat_pengembalian_atomik(uuid, jsonb) to service_role;
