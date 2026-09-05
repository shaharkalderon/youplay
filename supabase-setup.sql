-- YouPlay sync schema (no-login "sync code" model).
-- Run in your Supabase project: SQL Editor -> New query -> paste -> Run.
--
-- Security model
-- --------------
-- There is no login. A library is identified by an unguessable UUID that acts
-- as a capability: whoever holds the code can read and write that library, and
-- nobody else can reach it. This is the same idea as a private share link.
--
-- The table is NOT exposed to the public key. All access goes through two
-- security-definer functions that require the exact id, so the anon role can
-- never list, enumerate or scan libraries — it can only address one it already
-- knows. Guessing is a 2^122 search, which is not a practical attack.

create table if not exists public.shared_libraries (
  id         uuid primary key,
  items      jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shared_libraries enable row level security;

-- No policies are created on purpose. With RLS enabled and no policy, direct
-- table access is denied to everyone, including the anon key. The functions
-- below are the only way in.
revoke all on public.shared_libraries from anon, authenticated;

create or replace function public.library_pull(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select items from public.shared_libraries where id = p_id),
    '[]'::jsonb
  );
$$;

create or replace function public.library_push(p_id uuid, p_items jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz;
begin
  -- Guard against a client sending something that is not an array of items.
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;

  insert into public.shared_libraries (id, items, updated_at)
       values (p_id, p_items, now())
  on conflict (id) do update
          set items = excluded.items,
              updated_at = now()
    returning updated_at into ts;

  return ts;
end;
$$;

revoke all on function public.library_pull(uuid)          from public;
revoke all on function public.library_push(uuid, jsonb)   from public;
grant execute on function public.library_pull(uuid)        to anon;
grant execute on function public.library_push(uuid, jsonb) to anon;

-- The earlier per-user table is no longer used. Uncomment to remove it:
-- drop table if exists public.libraries;
