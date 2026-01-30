-- migration: create cards table
-- purpose: store flashcards with questions, answers, metadata and relationships to decks/sources
-- affected tables: cards
-- special considerations: cards can exist without a deck (deck_id nullable), source_id set to null on source deletion

-- create cards table
-- this is the main table for storing flashcards with their content, metadata, and relationships
-- cards belong to a user and optionally to a deck and source
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid references public.decks(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  question text not null,
  answer text not null,
  context text,
  tags text[] default '{}',
  difficulty smallint default 3 check (difficulty between 1 and 5),
  quality_status text default 'draft' check (quality_status in ('draft', 'ok', 'good')),
  is_manual_override boolean default false,
  external_metadata jsonb default '{}',
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- enable row level security on cards table
-- this ensures users can only access their own cards
alter table public.cards enable row level security;

-- rls policy: allow authenticated users to select their own cards
-- rationale: users need to view all their flashcards
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_select_own_authenticated"
  on public.cards
  for select
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to select their own cards
-- rationale: demo users need to view all their flashcards
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_select_own_anon"
  on public.cards
  for select
  to anon
  using (auth.uid() = user_id);

-- rls policy: allow authenticated users to insert their own cards
-- rationale: users need to create new flashcards
-- intended behavior: returns true only if the new card user_id matches the requesting user
create policy "cards_insert_own_authenticated"
  on public.cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own cards
-- rationale: demo users need to create new flashcards
-- intended behavior: returns true only if the new card user_id matches the requesting user
create policy "cards_insert_own_anon"
  on public.cards
  for insert
  to anon
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to update their own cards
-- rationale: users need to edit their flashcards content and metadata
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_update_own_authenticated"
  on public.cards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to update their own cards
-- rationale: demo users need to edit their flashcards content and metadata
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_update_own_anon"
  on public.cards
  for update
  to anon
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to delete their own cards
-- rationale: users need to remove unwanted flashcards
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_delete_own_authenticated"
  on public.cards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- rls policy: allow anonymous users to delete their own cards
-- rationale: demo users need to remove unwanted flashcards
-- intended behavior: returns true only if the card belongs to the requesting user
create policy "cards_delete_own_anon"
  on public.cards
  for delete
  to anon
  using (auth.uid() = user_id);

-- create indexes for efficient querying
-- index on user_id for fast user-specific card queries
create index if not exists idx_cards_user_id on public.cards(user_id);

-- index on deck_id for fast deck-specific card queries
create index if not exists idx_cards_deck_id on public.cards(deck_id);

-- gin index on tags array for efficient tag-based searches
create index if not exists idx_cards_tags on public.cards using gin(tags);

-- index on quality_status for filtering by card quality
create index if not exists idx_cards_quality_status on public.cards(quality_status);

-- create trigger function to automatically update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- create trigger to call the update function before each update
create trigger update_cards_updated_at
  before update on public.cards
  for each row
  execute function public.update_updated_at_column();

-- add comments to table and columns for documentation
comment on table public.cards is 'Main flashcard table storing questions, answers, and metadata';
comment on column public.cards.deck_id is 'Optional reference to containing deck, null if card is unorganized';
comment on column public.cards.source_id is 'Optional reference to source text, null if manually created or source deleted';
comment on column public.cards.question is 'The question/prompt side of the flashcard';
comment on column public.cards.answer is 'The answer/response side of the flashcard';
comment on column public.cards.context is 'Optional contextual information to help understand the card';
comment on column public.cards.tags is 'Array of user-defined tags for categorization';
comment on column public.cards.difficulty is 'Subjective difficulty rating from 1 (easiest) to 5 (hardest)';
comment on column public.cards.quality_status is 'Quality assessment: draft (needs review), ok (acceptable), good (high quality)';
comment on column public.cards.is_manual_override is 'True if user manually edited AI-generated content';
comment on column public.cards.external_metadata is 'JSON metadata for SRS integration and future extensions';
comment on column public.cards.last_synced_at is 'Timestamp of last sync with external SRS system';
