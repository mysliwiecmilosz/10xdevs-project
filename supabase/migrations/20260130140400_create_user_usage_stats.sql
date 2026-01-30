-- migration: create user_usage_stats table
-- purpose: track daily ai generation limits per user
-- affected tables: user_usage_stats
-- special considerations: composite primary key (user_id, date) allows atomic increment operations

-- create user_usage_stats table
-- this table tracks daily usage statistics for each user to enforce ai generation limits
-- the composite key allows for efficient daily limit checks and atomic counter updates
create table if not exists public.user_usage_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  generation_count integer default 0,
  primary key (user_id, date)
);

-- enable row level security on user_usage_stats table
-- users can only view their own statistics
alter table public.user_usage_stats enable row level security;

-- rls policy: allow authenticated users to select their own usage stats
-- rationale: users need to see their own daily usage to understand remaining limits
-- intended behavior: returns true only if the stats belong to the requesting user
create policy "user_usage_stats_select_own_authenticated"
  on public.user_usage_stats
  for select
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to select their own usage stats
-- rationale: demo users need to see their own daily usage
-- intended behavior: returns true only if the stats belong to the requesting user
create policy "user_usage_stats_select_own_anon"
  on public.user_usage_stats
  for select
  to anon
  using (auth.uid() = user_id);

-- note: insert/update operations should be handled by server-side functions (rpc) or triggers
-- to ensure proper validation and atomic operations
-- users should not directly modify usage stats through standard queries

-- create index on date for efficient date-based queries and cleanup operations
create index if not exists idx_user_usage_stats_date on public.user_usage_stats(date);

-- add comments to table and columns for documentation
comment on table public.user_usage_stats is 'Daily AI generation usage statistics per user for enforcing limits';
comment on column public.user_usage_stats.user_id is 'Reference to the user profile';
comment on column public.user_usage_stats.date is 'Date of usage (UTC timezone)';
comment on column public.user_usage_stats.generation_count is 'Number of AI generations performed on this date';
comment on constraint user_usage_stats_pkey on public.user_usage_stats is 'Composite key ensures one record per user per day';
