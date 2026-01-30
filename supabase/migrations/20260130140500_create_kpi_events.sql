-- migration: create kpi_events table
-- purpose: log analytics events for tracking user behavior and kpis
-- affected tables: kpi_events
-- special considerations: users can only insert events, not read them (analytics/admin access only)

-- create kpi_events table
-- this table stores analytics events for tracking user actions and calculating kpis
-- events include session starts, ai generations, card edits, accepts, and deletions
create table if not exists public.kpi_events (
  id bigint primary key generated always as identity,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- enable row level security on kpi_events table
-- users can only insert their own events, reading is restricted to admin/analytics
alter table public.kpi_events enable row level security;

-- rls policy: allow authenticated users to insert their own events
-- rationale: users need to log their actions for analytics
-- intended behavior: returns true only if the new event user_id matches the requesting user
create policy "kpi_events_insert_own_authenticated"
  on public.kpi_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own events
-- rationale: demo users also need to log their actions for analytics
-- intended behavior: returns true only if the new event user_id matches the requesting user
create policy "kpi_events_insert_own_anon"
  on public.kpi_events
  for insert
  to anon
  with check (auth.uid() = user_id);

-- note: no select/update/delete policies for regular users
-- kpi_events are write-only for users; reading is restricted to admins/analytics systems
-- this prevents users from accessing or modifying analytics data

-- create index on user_id for efficient per-user analytics queries
create index if not exists idx_kpi_events_user_id on public.kpi_events(user_id);

-- create index on event_type for efficient event type filtering in analytics
create index if not exists idx_kpi_events_event_type on public.kpi_events(event_type);

-- create index on created_at for time-based analytics queries
create index if not exists idx_kpi_events_created_at on public.kpi_events(created_at);

-- create composite index for common analytics queries (user + time range)
create index if not exists idx_kpi_events_user_created on public.kpi_events(user_id, created_at);

-- add comments to table and columns for documentation
comment on table public.kpi_events is 'Analytics event log for tracking user behavior and calculating KPIs';
comment on column public.kpi_events.event_type is 'Type of event: session_start, ai_generation, card_edit, card_accept, card_delete, etc.';
comment on column public.kpi_events.metadata is 'Additional JSON data about the event (flexible schema for different event types)';
comment on column public.kpi_events.created_at is 'Timestamp when the event occurred (UTC timezone)';
