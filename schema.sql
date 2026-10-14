create table if not exists public.rsvps (
  name text not null check (char_length(btrim(name)) between 1 and 60),
  status text not null check (status in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now()
);

create unique index if not exists rsvps_name_case_insensitive
  on public.rsvps (lower(name));

alter table public.rsvps enable row level security;

revoke all on table public.rsvps from anon, authenticated;
grant select on table public.rsvps to anon, authenticated;

drop policy if exists "Anyone can read attendance" on public.rsvps;
create policy "Anyone can read attendance"
  on public.rsvps
  for select
  to anon, authenticated
  using (true);

create or replace function public.submit_rsvp(rsvp_name text, rsvp_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if rsvp_name is null or char_length(btrim(rsvp_name)) not between 1 and 60 then
    raise exception 'Name must be between 1 and 60 characters.';
  end if;

  if rsvp_status not in ('yes', 'maybe', 'no') then
    raise exception 'Answer must be yes, maybe, or no.';
  end if;

  insert into public.rsvps (name, status, updated_at)
  values (btrim(rsvp_name), rsvp_status, now())
  on conflict (lower(name)) do update
    set name = excluded.name,
        status = excluded.status,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.submit_rsvp(text, text) from public;
grant execute on function public.submit_rsvp(text, text) to anon, authenticated;
