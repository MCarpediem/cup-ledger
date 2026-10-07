create table if not exists public.ledger_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ledger_snapshots enable row level security;

create policy "Users can read their own ledger"
  on public.ledger_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert their own ledger"
  on public.ledger_snapshots for insert with check (auth.uid() = user_id);
create policy "Users can update their own ledger"
  on public.ledger_snapshots for update using (auth.uid() = user_id);
