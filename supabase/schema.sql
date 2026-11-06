-- Tabel teks ketentuan (satu baris per versi)
create table if not exists public.ketentuan (
  id uuid primary key default gen_random_uuid(),
  versi text not null unique,
  isi text not null,
  berlaku_sejak timestamptz not null default now()
);

-- Tabel booking
create table if not exists public.booking (
  id uuid primary key default gen_random_uuid(),
  pelanggan_id uuid not null references auth.users(id) on delete restrict,
  nama_pelanggan text not null,
  tanggal_sewa date not null,
  jumlah_booking integer not null default 20000,
  status text not null default 'menunggu_bayar'
    check (status in (
      'menunggu_bayar',
      'terkonfirmasi',
      'dibatalkan',
      'hangus',
      'sedang_disewa',
      'menunggu_denda',
      'selesai'
    )),
  batas_bayar timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabel bukti persetujuan ketentuan
create table if not exists public.persetujuan (
  id uuid primary key default gen_random_uuid(),
  pelanggan_id uuid not null references auth.users(id) on delete restrict,
  booking_id uuid not null references public.booking(id) on delete restrict,
  ketentuan_id uuid not null references public.ketentuan(id) on delete restrict,
  disetujui_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

-- Aktifkan Row Level Security
alter table public.ketentuan enable row level security;
alter table public.booking enable row level security;
alter table public.persetujuan enable row level security;

-- Pelanggan hanya bisa melihat booking miliknya sendiri
create policy "pelanggan lihat booking sendiri"
  on public.booking for select
  using (auth.uid() = pelanggan_id);

-- Pelanggan hanya bisa membuat booking atas namanya sendiri
create policy "pelanggan buat booking sendiri"
  on public.booking for insert
  with check (auth.uid() = pelanggan_id);

-- Semua orang yang login boleh membaca teks ketentuan
create policy "baca ketentuan"
  on public.ketentuan for select
  using (auth.role() = 'authenticated');

-- Pelanggan hanya bisa melihat persetujuan miliknya sendiri
create policy "pelanggan lihat persetujuan sendiri"
  on public.persetujuan for select
  using (auth.uid() = pelanggan_id);