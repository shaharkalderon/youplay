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

-- ---------------------------------------------------------------------------
-- Followed channels (the New feed)
-- ---------------------------------------------------------------------------
-- Added after library sync. Everything in this file is safe to re-run, so
-- running the whole file again simply adds what is missing.
--
-- Channels live in their own column with their own pair of functions, so a
-- device on an older version of the app keeps syncing its library untouched.

alter table public.shared_libraries
  add column if not exists channels jsonb not null default '[]'::jsonb;

create or replace function public.channels_pull(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select channels from public.shared_libraries where id = p_id),
    '[]'::jsonb
  );
$$;

create or replace function public.channels_push(p_id uuid, p_channels jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz;
begin
  if jsonb_typeof(p_channels) <> 'array' then
    raise exception 'channels must be a JSON array';
  end if;

  insert into public.shared_libraries (id, channels, updated_at)
       values (p_id, p_channels, now())
  on conflict (id) do update
          set channels = excluded.channels,
              updated_at = now()
    returning updated_at into ts;

  return ts;
end;
$$;

revoke all on function public.channels_pull(uuid)          from public;
revoke all on function public.channels_push(uuid, jsonb)   from public;
grant execute on function public.channels_pull(uuid)        to anon;
grant execute on function public.channels_push(uuid, jsonb) to anon;

-- ---------------------------------------------------------------------------
-- Link previews (titles for platforms that publish nothing readable)
-- ---------------------------------------------------------------------------
-- Instagram, Facebook, Reddit and ordinary websites expose no oEmbed endpoint a
-- browser may read, so the app can only name those links after their URL. This
-- fetches the page server-side and reads its title and image instead.
--
-- Security
-- --------
-- pgsql-http's own README warns: "just don't install a footgun like this
-- extension where users can access it". This function is callable by anyone
-- holding the public key, so it is deliberately narrow:
--
--   * https only, and no credentials embedded in the URL
--   * default port only — no port sweeping
--   * private, loopback, link-local and cloud-metadata addresses refused,
--     which is what stops it reaching anything inside the network
--   * a short timeout, so a slow site cannot hold a database connection open
--   * only the extracted title and image are returned, never the page itself
--
-- It is still a fetcher that strangers could point at public websites. If that
-- ever bothers you, revoke it:  revoke execute on function public.link_preview(text) from anon;

create extension if not exists http with schema extensions;

create or replace function public.link_preview(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  host     text;
  response extensions.http_response;
  body     text;
  title    text;
  image    text;
begin
  if p_url !~* '^https://[^/@\s]+(/|$)' then
    raise exception 'only https urls are allowed';
  end if;

  host := lower(split_part(regexp_replace(p_url, '^https://', ''), '/', 1));

  -- No port suffix: the default is the only one worth reaching.
  if host ~ ':' then
    raise exception 'ports are not allowed';
  end if;

  -- A public name has a dot and is not an internal address. 169.254.169.254 is
  -- the cloud metadata endpoint and the reason this list exists at all.
  if host !~ '\.' 
     or host ~ '^(localhost|metadata|.*\.internal|.*\.local)$'
     or host ~ '^(10|127|0|169\.254|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.'
     or host ~ '^\[' then
    raise exception 'that host is not reachable from here';
  end if;

  -- SET LOCAL, not SET: these last only for this transaction. A plain SET would
  -- apply for the lifetime of a pooled connection and leak into other queries.
  -- Long enough for a slow page, short enough not to tie up a connection.
  set local http.curlopt_timeout_ms = 6000;
  set local http.curlopt_useragent = 'Mozilla/5.0 (compatible; YouPlay link preview)';
  -- Redirects are deliberately not configured: the extension supports no
  -- followlocation setting, and http_get follows them already (only HEAD is
  -- documented not to), which is what short links like fb.watch rely on.

  begin
    response := extensions.http_get(p_url);
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'fetch failed');
  end;

  if response.status >= 400 then
    return jsonb_build_object('ok', false, 'reason', 'http ' || response.status);
  end if;

  -- Only markup is worth parsing; anything else has no title to find.
  if coalesce(response.content_type, '') !~* 'html|xml' then
    return jsonb_build_object('ok', false, 'reason', 'not a web page');
  end if;

  body := response.content;

  -- og:title is usually the cleanest, but attribute order varies, so try both.
  title := coalesce(
    (regexp_match(body, '<meta[^>]+property=["'']og:title["''][^>]+content=["'']([^"'']+)', 'i'))[1],
    (regexp_match(body, '<meta[^>]+content=["'']([^"'']+)["''][^>]+property=["'']og:title["'']', 'i'))[1],
    (regexp_match(body, '<meta[^>]+name=["'']twitter:title["''][^>]+content=["'']([^"'']+)', 'i'))[1],
    (regexp_match(body, '<title[^>]*>([^<]{1,300})</title>', 'i'))[1]
  );

  image := coalesce(
    (regexp_match(body, '<meta[^>]+property=["'']og:image["''][^>]+content=["'']([^"'']+)', 'i'))[1],
    (regexp_match(body, '<meta[^>]+content=["'']([^"'']+)["''][^>]+property=["'']og:image["'']', 'i'))[1],
    (regexp_match(body, '<meta[^>]+name=["'']twitter:image["''][^>]+content=["'']([^"'']+)', 'i'))[1]
  );

  -- Facebook's <title> is the clean video name while its og:title is prefixed
  -- with engagement counts ("2.8M views · 1.3K reactions | ..."), so prefer the
  -- page title there.
  if host like '%facebook.com' or host like '%fb.watch' then
    title := coalesce((regexp_match(body, '<title[^>]*>([^<]{1,300})</title>', 'i'))[1], title);
  end if;

  return jsonb_build_object(
    'ok', true,
    'title', nullif(btrim(coalesce(title, '')), ''),
    'image', case when image ~* '^https://' then image else null end
  );
end;
$$;

revoke all on function public.link_preview(text) from public;
grant execute on function public.link_preview(text) to anon;
