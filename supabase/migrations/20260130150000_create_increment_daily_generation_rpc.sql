-- migration: create increment_daily_generation RPC
-- purpose: atomically enforce and increment daily generation limits
-- affected objects: function public.increment_daily_generation
-- special considerations:
-- - SECURITY DEFINER to allow atomic upsert even when RLS blocks direct updates
-- - designed for backend use; current dev mode has no auth, so we do not enforce auth.uid() here

create or replace function public.increment_daily_generation(
  p_user_id uuid,
  p_daily_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := current_date;
  v_used integer := 0;
begin
  if p_user_id is null then
    raise exception 'invalid_user_id';
  end if;

  if p_daily_limit is null or p_daily_limit <= 0 then
    raise exception 'invalid_daily_limit';
  end if;

  -- Read current usage (if any)
  select coalesce(generation_count, 0)
    into v_used
  from public.user_usage_stats
  where user_id = p_user_id and date = v_date;

  if v_used >= p_daily_limit then
    raise exception 'daily_limit_exceeded';
  end if;

  -- Atomic upsert: if row exists, increment; else insert with 1
  insert into public.user_usage_stats (user_id, date, generation_count)
  values (p_user_id, v_date, 1)
  on conflict (user_id, date)
  do update set generation_count = public.user_usage_stats.generation_count + 1;

  return p_daily_limit - (v_used + 1);
end;
$$;

-- allow calling from API clients (dev) and server-side
grant execute on function public.increment_daily_generation(uuid, integer) to anon, authenticated;

