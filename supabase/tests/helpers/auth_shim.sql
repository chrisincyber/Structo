-- Minimal Supabase auth shim for running migrations + tests on plain Postgres
-- (CI and local dev without the full Supabase stack). Mirrors just enough of
-- the managed platform: auth.users, auth.uid(), and the authenticated role.
-- NEVER apply this to a real Supabase project.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public, auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on functions to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
