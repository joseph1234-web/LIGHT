-- Windows retains account-based access. Android download links are signed by
-- the presenter function after the license registry accepts the key.
alter policy "Signed-in Ekklo accounts download Presenter installers"
on storage.objects
using (
  bucket_id = 'ekklo-presenter-downloads'
  and name in (
    'Ekklo_Setup_1.16.0.exe.part-00.bin',
    'Ekklo_Setup_1.16.0.exe.part-01.bin'
  )
  and (select storage.allow_only_operation('storage.object.get_authenticated'))
  and (select auth.uid()) is not null
  and (select auth.jwt() ->> 'email') <> ''
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

create function public.ekklo_check_presenter_android_license(
  p_key_digest text,
  p_account_digest text
) returns text
language plpgsql
security invoker
set search_path = ''
as $check$
declare
  window_start timestamptz := date_trunc('minute', now());
  window_attempts integer;
begin
  if p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$'
     or p_account_digest is null or p_account_digest !~ '^[a-f0-9]{64}$' then
    return 'invalid';
  end if;
  delete from ekklo_presenter_private.request_limits
  where minute_started_at < window_start - interval '15 minutes';
  insert into ekklo_presenter_private.request_limits as limits
    (source_digest, minute_started_at, attempts)
  values (p_account_digest, window_start, 1)
  on conflict (minute_started_at, source_digest) do update
    set attempts = least(limits.attempts + 1, 11)
  returning attempts into window_attempts;
  if window_attempts > 10 then
    return 'limited';
  end if;
  if exists (
    select 1 from ekklo_presenter_private.licenses where key_digest = p_key_digest
  ) then
    return 'accepted';
  end if;
  return 'invalid';
end;
$check$;

revoke all on function public.ekklo_check_presenter_android_license(text, text)
  from public, anon, authenticated;
grant execute on function public.ekklo_check_presenter_android_license(text, text)
  to service_role;
notify pgrst, 'reload schema';
