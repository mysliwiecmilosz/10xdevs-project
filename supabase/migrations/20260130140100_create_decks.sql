-- migration: create decks table
-- purpose: create containers (decks) for organizing flashcards
-- affected tables: decks
-- special considerations: deck names must be unique per user

-- create decks table
-- this table stores flashcard decks (collections) that users create to organize their cards
-- each deck belongs to a specific user and must have a unique name within that user's decks
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamp with time zone default now(),
  -- ensure deck names are unique per user
  constraint unique_deck_name_per_user unique (user_id, name)
);

-- enable row level security on decks table
-- this ensures users can only access their own decks
alter table public.decks enable row level security;

-- rls policy: allow authenticated users to select their own decks
-- rationale: users need to view their own decks
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_select_own_authenticated"
  on public.decks
  for select
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to select their own decks
-- rationale: demo users need to view their own decks
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_select_own_anon"
  on public.decks
  for select
  to anon
  using (auth.uid() = user_id);

-- rls policy: allow authenticated users to insert their own decks
-- rationale: users need to create new decks
-- intended behavior: returns true only if the new deck user_id matches the requesting user
create policy "decks_insert_own_authenticated"
  on public.decks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own decks
-- rationale: demo users need to create new decks
-- intended behavior: returns true only if the new deck user_id matches the requesting user
create policy "decks_insert_own_anon"
  on public.decks
  for insert
  to anon
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to update their own decks
-- rationale: users need to edit their deck names and descriptions
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_update_own_authenticated"
  on public.decks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to update their own decks
-- rationale: demo users need to edit their deck names and descriptions
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_update_own_anon"
  on public.decks
  for update
  to anon
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to delete their own decks
-- rationale: users need to remove unwanted decks
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_delete_own_authenticated"
  on public.decks
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to delete their own decks
-- rationale: demo users need to remove unwanted decks
-- intended behavior: returns true only if the deck belongs to the requesting user
create policy "decks_delete_own_anon"
  on public.decks
  for delete
  to anon
  using (auth.uid() = user_id);

-- create composite index on user_id and name for unique constraint and faster lookups
-- this index is automatically created by the unique constraint above
create index if not exists idx_decks_user_id on public.decks(user_id);

-- add comments to table and constraints for documentation
comment on table public.decks is 'Flashcard decks (collections) for organizing cards';
comment on column public.decks.name is 'Deck name, must be unique per user';
comment on column public.decks.description is 'Optional description of the deck content';
comment on constraint unique_deck_name_per_user on public.decks is 'Ensures deck names are unique within a user''s collection';
