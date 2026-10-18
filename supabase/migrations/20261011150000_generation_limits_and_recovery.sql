begin;
alter table public.fal_submissions add column if not exists metadata jsonb;
alter table public.fal_submissions add column if not exists result jsonb;
alter table public.fal_submissions add column if not exists budget_units integer not null default 1;
alter table public.fal_submissions drop constraint if exists fal_submissions_status_check;
alter table public.fal_submissions add constraint fal_submissions_status_check check (status in ('submitting','queued','completed','failed','cancelled'));
create index if not exists fal_submissions_created_at_idx on public.fal_submissions(created_at);

-- One transaction checks limits and reserves the UUID, including concurrent calls.
create or replace function public.reserve_fal_submission(p_user uuid, p_request uuid, p_fingerprint text, p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.fal_submissions; units integer; video boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('vibecanvas:fal-budget',0));
  select * into existing from public.fal_submissions where user_id=p_user and client_request_id=p_request;
  if found then return jsonb_build_object('existing',to_jsonb(existing)); end if;
  video := p_metadata->>'mediaType' = 'video';
  units := case when video then 10 else 1 end;
  if (select count(*) from public.fal_submissions where user_id=p_user and status in ('submitting','queued') and created_at>now()-interval '24 hours') >= 3 then
    return jsonb_build_object('limit','You have 3 requests running. Wait for one to finish before starting another.');
  end if;
  if (select count(*) from public.fal_submissions where user_id=p_user and created_at>now()-interval '10 minutes') >= 10 then
    return jsonb_build_object('limit','You have reached the request limit. Please try again in 10 minutes.');
  end if;
  if (select count(*) from public.fal_submissions where user_id=p_user and status <> 'failed' and created_at>now()-interval '24 hours' and (metadata->>'mediaType'='video')=video) >= (case when video then 4 else 24 end) then
    return jsonb_build_object('limit','Daily generation limit reached: 24 images and 4 videos per account. Try again tomorrow.');
  end if;
  -- Budget units are conservative workload weights, not quoted provider prices.
  if (select coalesce(sum(budget_units),0) from public.fal_submissions where user_id=p_user and status <> 'failed' and created_at>now()-interval '24 hours')+units>40 then
    return jsonb_build_object('limit','Your daily generation budget is used. Try again tomorrow.');
  end if;
  if (select coalesce(sum(budget_units),0) from public.fal_submissions where status <> 'failed' and created_at>now()-interval '24 hours')+units>100 then
    return jsonb_build_object('limit','The studio daily generation budget is used. Please try again tomorrow.');
  end if;
  insert into public.fal_submissions(user_id,client_request_id,fingerprint,status,metadata,budget_units) values(p_user,p_request,p_fingerprint,'submitting',p_metadata,units);
  return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_fal_submission(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_fal_submission(uuid,uuid,text,jsonb) to service_role;

-- Tenant ownership must also hold for the destination folder, including crafted clients.
do $$ begin
  if exists(select 1 from public.image_records r join public.folders f on f.id=r.folder_id where f.user_id<>r.user_id) then
    raise exception 'Reconcile cross-account folder assignments before enabling the ownership constraint';
  end if;
end $$;
create or replace function public.validate_media_folder_owner() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.folder_id is not null and not exists(select 1 from public.folders where id=new.folder_id and user_id=new.user_id) then
    raise exception 'Choose a folder belonging to this account' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.validate_media_folder_owner() from public, anon, authenticated;
drop trigger if exists media_folder_owner on public.image_records;
create trigger media_folder_owner before insert or update of user_id,folder_id on public.image_records for each row execute function public.validate_media_folder_owner();
commit;
