-- YouPlay sync schema.
-- Run once in your Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.libraries (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  items      jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.libraries enable row level security;

-- Every policy is scoped to the signed-in user's own row. Without these, row
-- level security would simply deny everything; with them, one user can never
-- read or write another user's library even though the anon key is public.
drop policy if exists "read own library"   on public.libraries;
drop policy if exists "insert own library" on public.libraries;
drop policy if exists "update own library" on public.libraries;

create policy "read own library"
  on public.libraries for select
  using (auth.uid() = user_id);

create policy "insert own library"
  on public.libraries for insert
  with check (auth.uid() = user_id);

create policy "update own library"
  on public.libraries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at honest even if a client forgets to send it.
create or replace function public.touch_library()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists libraries_touch on public.libraries;
create trigger libraries_touch
  before update on public.libraries
  for each row execute function public.touch_library();
