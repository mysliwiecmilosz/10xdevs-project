-- migration: create profiles table
-- purpose: store extended user data linked to supabase auth system
-- affected tables: profiles
-- special considerations: this table extends auth.users and is the foundation for user-related data

-- create profiles table
-- this table stores extended user information beyond what's in auth.users
-- each profile is linked 1:1 with a user in the auth.users table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  account_role text not null default 'demo' check (account_role in ('demo', 'full')),
  last_active_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- enable row level security on profiles table
-- this ensures users can only access their own profile data
alter table public.profiles enable row level security;

-- rls policy: allow authenticated users to select their own profile
-- rationale: users need to read their own profile information
-- intended behavior: returns true only if the requesting user's id matches the profile id
create policy "profiles_select_own_authenticated"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- rls policy: allow anonymous users to select their own profile
-- rationale: demo users (anonymous) also need to read their profile
-- intended behavior: returns true only if the requesting user's id matches the profile id
create policy "profiles_select_own_anon"
  on public.profiles
  for select
  to anon
  using (auth.uid() = id);

-- rls policy: allow authenticated users to update their own profile
-- rationale: users need to update their profile information (e.g., last_active_at)
-- intended behavior: returns true only if the requesting user's id matches the profile id
create policy "profiles_update_own_authenticated"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- rls policy: allow anonymous users to update their own profile
-- rationale: demo users (anonymous) also need to update their profile
-- intended behavior: returns true only if the requesting user's id matches the profile id
create policy "profiles_update_own_anon"
  on public.profiles
  for update
  to anon
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- rls policy: allow authenticated users to insert their own profile
-- rationale: new users need to create their profile during signup
-- intended behavior: returns true only if the new profile id matches the requesting user's id
create policy "profiles_insert_own_authenticated"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- rls policy: allow anonymous users to insert their own profile
-- rationale: demo users (anonymous) need to create their profile
-- intended behavior: returns true only if the new profile id matches the requesting user's id
create policy "profiles_insert_own_anon"
  on public.profiles
  for insert
  to anon
  with check (auth.uid() = id);

-- create index on email for faster lookups
create index if not exists idx_profiles_email on public.profiles(email);

-- add comment to table for documentation
comment on table public.profiles is 'Extended user profiles linked to supabase auth system';
comment on column public.profiles.account_role is 'User account type: demo (limited) or full (paid)';
comment on column public.profiles.last_active_at is 'Timestamp of last user activity';
