-- ZHIVA migration 0004.
-- Multi-user/couples foundation. Scope is deliberately limited: this
-- creates the household + membership primitive and its own RLS, and
-- changes NOTHING about any existing table's policies. Sharing actual
-- financial data (transactions, accounts, budgets, goals) across a
-- household is a separate, larger decision — deciding which records
-- become visible to a partner is a product/privacy choice the account
-- owner should make explicitly per-resource, not something a single
-- migration should silently turn on. That is intentionally left for a
-- follow-up migration once that UX is designed, not built here.

create table if not exists households (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

-- A user can see a household only if they're a member of it —
-- membership itself, not household existence, is the access boundary.
create policy "households: members can view" on households for select
  using (
    exists (
      select 1 from household_members
      where household_members.household_id = households.id
      and household_members.user_id = auth.uid()
    )
  );

create policy "households: creator can update" on households for update
  using (created_by = auth.uid());

create policy "households: authenticated users can create" on households for insert
  with check (created_by = auth.uid());

-- Members can see the roster of a household they belong to (needed to
-- render "who's in this household"), but can only remove themselves —
-- removing someone else requires the owner role, enforced below.
create policy "household_members: members can view roster" on household_members for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "household_members: users can leave" on household_members for delete
  using (user_id = auth.uid());

create policy "household_members: owners can remove members" on household_members for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
    )
  );

-- Inserts (invitations) happen via a server route using the service
-- role (bypassing RLS deliberately, the same pattern as
-- handle_new_user in 0002) because adding a member requires looking up
-- another user's id from their email via the admin API — something an
-- RLS policy on the client's own session cannot safely do. See
-- src/app/api/household/invite/route.ts. No client-side insert policy
-- is defined here on purpose: membership additions only ever happen
-- through that reviewed server code path.

create index if not exists household_members_user_idx on household_members (user_id);
create index if not exists household_members_household_idx on household_members (household_id);

-- Auto-add the creator as owner when a household is created, so a
-- household is never left without an owner even for a moment.
create or replace function handle_new_household() returns trigger as $$
begin
  insert into household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_household_created on households;
create trigger on_household_created
  after insert on households
  for each row execute function handle_new_household();
