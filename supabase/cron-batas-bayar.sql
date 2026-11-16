-- Aktifkan extension pg_cron di Supabase sebelum menjalankan file ini.

create or replace function public.batalkan_booking_kedaluwarsa()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_dibatalkan integer;
begin
  update public.booking
  set status = 'dibatalkan', updated_at = now()
  where status = 'menunggu_bayar'
    and batas_bayar is not null
    and batas_bayar <= now();

  get diagnostics v_dibatalkan = row_count;
  return v_dibatalkan;
end;
$$;

revoke all on function public.batalkan_booking_kedaluwarsa() from public, anon, authenticated;
grant execute on function public.batalkan_booking_kedaluwarsa() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'kala-batal-bayar') then
    perform cron.schedule(
      'kala-batal-bayar',
      '* * * * *',
      'select public.batalkan_booking_kedaluwarsa();'
    );
  end if;
end;
$$;
