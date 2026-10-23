-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- One table of JSON documents per user; the app syncs it with the phone.

create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  kind       text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at bigint      not null,          -- client edit time (ms), last write wins
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists docs_user_synced on public.docs (user_id, synced_at);

-- Keep the newer edit when two devices upload the same doc,
-- and stamp server time so devices can pull what changed.
create or replace function public.docs_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists docs_before_write on public.docs;
create trigger docs_before_write before insert or update on public.docs
for each row execute function public.docs_before_write();

alter table public.docs enable row level security;

drop policy if exists "own docs select" on public.docs;
drop policy if exists "own docs insert" on public.docs;
drop policy if exists "own docs update" on public.docs;
create policy "own docs select" on public.docs for select using (auth.uid() = user_id);
create policy "own docs insert" on public.docs for insert with check (auth.uid() = user_id);
create policy "own docs update" on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
