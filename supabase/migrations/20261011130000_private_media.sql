-- Media paths use user UUIDs as their first folder. Keep signed sharing available.
begin;

-- Refuse to hide any library record that still needs an ownership migration.
do $$
declare legacy record; expression text;
begin
  if exists (select 1 from public.image_records where user_id is null or storage_path is null or storage_path not like user_id::text || '/%') then
    raise exception 'Migrate library storage paths to their owner UUID before making media private';
  end if;
  -- These names belong to the entire objects table, so verify their scope first.
  -- Custom/shared policies must be migrated explicitly, never dropped by name.
  for legacy in select * from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('Allow authenticated select', 'Allow authenticated uploads', 'Allow users to delete their own objects', 'User can manage their own images') loop
    expression := coalesce(legacy.qual, '') || ' ' || coalesce(legacy.with_check, '');
    if expression !~ 'bucket_id\s*=\s*''(images|video)''' or expression ~* '\mOR\M' or exists (select 1 from regexp_matches(expression, 'bucket_id\s*=\s*''([^'']+)''', 'g') m where m[1] not in ('images', 'video')) then
      raise exception 'Policy % may serve other buckets; migrate it explicitly before continuing', legacy.policyname;
    end if;
    execute format('drop policy %I on storage.objects', legacy.policyname);
  end loop;
end $$;

-- October 11 production audit: all 864 linked records have valid owner paths.
-- 70 unowned, unreferenced legacy video objects are retained privately for
-- administrator ownership reconciliation; no object is deleted or reassigned.
update storage.buckets set public = false,
  file_size_limit = case when id = 'images' then 20971520 else 52428800 end
  where id in ('images', 'video');

drop policy if exists "VibeCanvas owner media select" on storage.objects;
drop policy if exists "VibeCanvas owner media insert" on storage.objects;
drop policy if exists "VibeCanvas owner media update" on storage.objects;
drop policy if exists "VibeCanvas owner media delete" on storage.objects;

-- Any other permissive media policy would be ORed with ownership checks.
-- Keep only policies provably scoped to a different bucket; refuse broad/custom ones.
do $$
declare other record; expression text;
begin
  for other in select * from pg_policies where schemaname='storage' and tablename='objects' loop
    expression := coalesce(other.qual,'') || ' ' || coalesce(other.with_check,'');
    if expression !~ 'bucket_id\s*=\s*''[^'']+''' or expression ~* '\mOR\M' or exists(select 1 from regexp_matches(expression,'bucket_id\s*=\s*''([^'']+)''','g') m where m[1] in ('images','video')) then
      raise exception 'Audit policy % for media access before applying ownership rules', other.policyname;
    end if;
  end loop;
end $$;

create policy "VibeCanvas owner media select" on storage.objects for select to authenticated
  using (bucket_id in ('images', 'video') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "VibeCanvas owner media insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('images', 'video') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "VibeCanvas owner media update" on storage.objects for update to authenticated
  using (bucket_id in ('images', 'video') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('images', 'video') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "VibeCanvas owner media delete" on storage.objects for delete to authenticated
  using (bucket_id in ('images', 'video') and (storage.foldername(name))[1] = auth.uid()::text);

commit;
