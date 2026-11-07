-- Ubah kolom tanggal_sewa menjadi rentang tanggal
alter table public.booking rename column tanggal_sewa to tanggal_mulai;

alter table public.booking add column tanggal_selesai date;

-- Isi data lama (kalau ada) dengan tanggal yang sama, karena sebelumnya sewa sehari
update public.booking set tanggal_selesai = tanggal_mulai where tanggal_selesai is null;

alter table public.booking alter column tanggal_selesai set not null;

alter table public.booking
  add constraint booking_rentang_valid check (tanggal_selesai >= tanggal_mulai);