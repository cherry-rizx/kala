-- Jalankan setelah migrasi-daftar-harga-excel.sql.
--
-- Memulihkan booking yang SUDAH DIBAYAR TEPAT WAKTU, tetapi notifikasinya
-- terlambat sampai (mis. webhook gagal) sehingga booking keburu dibatalkan
-- cron batas bayar. Stok booking sudah dilepas saat dibatalkan, jadi stok
-- dicek ulang dengan lock yang sama seperti buat_booking_atomik. Jika stok
-- sudah dipakai booking lain atau tanggal sewa sudah lewat, fungsi
-- mengembalikan false dan aplikasi memasukkan booking ke antrian refund.

create or replace function public.pulihkan_booking_terbayar(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_booking record;
  v_item record;
  v_stok integer;
  v_stok_dikelola boolean;
  v_terpesan integer;
begin
  select b.id, b.status, b.tanggal_mulai, b.tanggal_selesai
    into v_booking
  from public.booking b
  where b.id = p_booking_id
  for update;

  if not found or v_booking.status not in ('menunggu_bayar', 'dibatalkan') then
    return false;
  end if;
  if v_booking.tanggal_selesai < (now() at time zone 'Asia/Jakarta')::date then
    return false;
  end if;

  perform a.id
  from public.alat a
  join public.booking_item bi on bi.alat_id = a.id
  where bi.booking_id = p_booking_id
  order by a.id
  for update of a;

  for v_item in
    select bi.alat_id, bi.jumlah
    from public.booking_item bi
    where bi.booking_id = p_booking_id
    order by bi.alat_id
  loop
    select a.stok_total, a.stok_dikelola into v_stok, v_stok_dikelola
    from public.alat a where a.id = v_item.alat_id;

    if coalesce(v_stok_dikelola, true) then
      select coalesce(sum(bi.jumlah), 0)::integer into v_terpesan
      from public.booking_item bi
      join public.booking b on b.id = bi.booking_id
      where bi.alat_id = v_item.alat_id
        and b.id <> p_booking_id
        and b.status in ('menunggu_bayar', 'terkonfirmasi', 'sedang_disewa', 'menunggu_denda')
        and (b.status <> 'menunggu_bayar' or b.batas_bayar > now())
        and b.tanggal_mulai <= v_booking.tanggal_selesai
        and b.tanggal_selesai >= v_booking.tanggal_mulai;

      if v_terpesan + v_item.jumlah > coalesce(v_stok, 0) then
        return false;
      end if;
    end if;
  end loop;

  update public.booking
  set status = 'terkonfirmasi', refund_jumlah = 0, updated_at = now()
  where id = p_booking_id;
  return true;
end;
$$;

revoke all on function public.pulihkan_booking_terbayar(uuid) from public, anon, authenticated;
grant execute on function public.pulihkan_booking_terbayar(uuid) to service_role;

notify pgrst, 'reload schema';
