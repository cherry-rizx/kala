-- Master data alat
create table if not exists public.alat (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga_sewa integer not null check (harga_sewa >= 0),
  harga_barang integer not null check (harga_barang >= 0), -- dasar perhitungan denda
  stok_total integer not null check (stok_total >= 0),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Isi booking per alat (satu booking bisa berisi beberapa alat)
create table if not exists public.booking_item (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking(id) on delete cascade,
  alat_id uuid not null references public.alat(id) on delete restrict,
  jumlah integer not null check (jumlah > 0),
  harga_satuan integer not null check (harga_satuan >= 0), -- disalin saat booking dibuat
  unique (booking_id, alat_id)
);

alter table public.alat enable row level security;
alter table public.booking_item enable row level security;

-- Semua user login boleh melihat daftar alat yang aktif
drop policy if exists "baca alat aktif" on public.alat;
create policy "baca alat aktif"
  on public.alat for select
  using (auth.role() = 'authenticated' and aktif = true);

-- Pelanggan hanya bisa melihat item dari booking miliknya
drop policy if exists "lihat item booking sendiri" on public.booking_item;
create policy "lihat item booking sendiri"
  on public.booking_item for select
  using (
    exists (
      select 1 from public.booking b
      where b.id = booking_item.booking_id
        and b.pelanggan_id = auth.uid()
    )
  );