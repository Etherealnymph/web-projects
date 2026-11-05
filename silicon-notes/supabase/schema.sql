create table public.silicon_notes_public (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  note jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.silicon_notes_public enable row level security;
grant usage on schema public to anon, authenticated;
grant select on public.silicon_notes_public to anon, authenticated;
grant insert, update, delete on public.silicon_notes_public to authenticated;
create index silicon_notes_public_updated_idx on public.silicon_notes_public (updated_at desc);
create policy "Anyone can read published notes" on public.silicon_notes_public for select to anon, authenticated using (true);
create policy "Users can publish own notes" on public.silicon_notes_public for insert to authenticated with check (auth.uid() = owner_id);
create policy "Users can update own notes" on public.silicon_notes_public for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users can delete own notes" on public.silicon_notes_public for delete to authenticated using (auth.uid() = owner_id);

create or replace function public.silicon_notes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger silicon_notes_public_updated_at
before update on public.silicon_notes_public
for each row execute function public.silicon_notes_set_updated_at();
