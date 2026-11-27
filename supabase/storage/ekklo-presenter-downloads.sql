-- Applied to the existing private download bucket by migration 20261127192243.
create policy "Signed-in Ekklo accounts download Presenter installers"
on storage.objects for select to authenticated
using (
  bucket_id = 'ekklo-presenter-downloads'
  and (select storage.allow_only_operation('storage.object.get_authenticated'))
  and (select auth.uid()) is not null
  and (select auth.jwt() ->> 'email') <> ''
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);
