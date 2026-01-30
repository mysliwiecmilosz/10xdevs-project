-- migration: create sources table
-- purpose: store original source texts pasted by users for flashcard generation
-- affected tables: sources
-- special considerations: content field has technical limit of ~100k characters

-- create sources table
-- this table stores the original text content that users provide to generate flashcards
-- each source belongs to a specific user and can generate multiple cards
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  character_count integer not null,
  created_at timestamp with time zone default now()
);

-- enable row level security on sources table
-- this ensures users can only access their own sources
alter table public.sources enable row level security;

-- rls policy: allow authenticated users to select their own sources
-- rationale: users need to view their own source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_select_own_authenticated"
  on public.sources
  for select
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to select their own sources
-- rationale: demo users need to view their own source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_select_own_anon"
  on public.sources
  for select
  to anon
  using (auth.uid() = user_id);

-- rls policy: allow authenticated users to insert their own sources
-- rationale: users need to create new source texts
-- intended behavior: returns true only if the new source user_id matches the requesting user
create policy "sources_insert_own_authenticated"
  on public.sources
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own sources
-- rationale: demo users need to create new source texts
-- intended behavior: returns true only if the new source user_id matches the requesting user
create policy "sources_insert_own_anon"
  on public.sources
  for insert
  to anon
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to update their own sources
-- rationale: users need to edit their source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_update_own_authenticated"
  on public.sources
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to update their own sources
-- rationale: demo users need to edit their source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_update_own_anon"
  on public.sources
  for update
  to anon
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to delete their own sources
-- rationale: users need to remove unwanted source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_delete_own_authenticated"
  on public.sources
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to delete their own sources
-- rationale: demo users need to remove unwanted source texts
-- intended behavior: returns true only if the source belongs to the requesting user
create policy "sources_delete_own_anon"
  on public.sources
  for delete
  to anon
  using (auth.uid() = user_id);

-- create index on user_id for faster user-specific queries
create index if not exists idx_sources_user_id on public.sources(user_id);

-- add comments to table and columns for documentation
comment on table public.sources is 'Original source texts provided by users for flashcard generation';
comment on column public.sources.content is 'Source text content with recommended technical limit of 100k characters';
comment on column public.sources.character_count is 'Number of characters in the content field';
