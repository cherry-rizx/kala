create or replace function public.cek_ketersediaan(
  p_alat_id uuid,
  p_mulai date,
  p_selesai date,
  p_jumlah integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select a.stok_total from public.alat a where a.id = p_alat_id)
    - coalesce(
        (
          select sum(bi.jumlah)
          from public.booking_item bi
          join public.booking b on b.id = bi.booking_id
          where bi.alat_id = p_alat_id
            and b.status in ('menunggu_bayar', 'terkonfirmasi', 'sedang_disewa', 'menunggu_denda')
            and b.tanggal_mulai <= p_selesai
            and b.tanggal_selesai >= p_mulai
        ),
        0
      ) >= p_jumlah,
    false
  );
$$;