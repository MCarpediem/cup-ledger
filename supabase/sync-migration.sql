-- Run once after schema.sql. Atomic compare-and-swap prevents concurrent overwrites.
create or replace function public.save_ledger_snapshot(p_payload jsonb, p_expected timestamptz)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare saved timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_expected is null then
    insert into public.ledger_snapshots(user_id, payload, updated_at)
    values (auth.uid(), p_payload, clock_timestamp())
    on conflict (user_id) do nothing returning updated_at into saved;
  else
    update public.ledger_snapshots set payload = p_payload, updated_at = clock_timestamp()
    where user_id = auth.uid() and updated_at = p_expected returning updated_at into saved;
  end if;
  return saved;
end;
$$;
revoke all on function public.save_ledger_snapshot(jsonb, timestamptz) from public, anon;
grant execute on function public.save_ledger_snapshot(jsonb, timestamptz) to authenticated;
