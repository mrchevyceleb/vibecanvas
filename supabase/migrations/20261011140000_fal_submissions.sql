-- Server-only ledger: reserve a user's request before submitting billable work.
create table if not exists public.fal_submissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  fingerprint text not null,
  status text not null check (status in ('submitting', 'queued', 'failed')),
  response jsonb,
  failure jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);
alter table public.fal_submissions enable row level security;
revoke all on public.fal_submissions from anon, authenticated;
grant all on public.fal_submissions to service_role;
