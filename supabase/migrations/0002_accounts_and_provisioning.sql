-- ZHIVA migration 0002.
-- Additive only — nothing from 0001 is dropped. Extends the schema to
-- cover accounts, transfers, goal domains, task categories, and the
-- preference/audit tables the spec calls for, and fixes a real gap:
-- 0001 never created a profile row on signup, so every "current user's
-- data" query had nowhere to attach defaults to.

-- ---------------------------------------------------------------------
-- Accounts (Cash, Bank, Credit Card, Savings, Wallet, UPI, Custom)
-- Folds in what the spec calls "payment_methods" — in practice an
-- account IS the payment method for a transaction, so one table avoids
-- a redundant second FK on every transaction row.
-- ---------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'cash' check (
    type in ('cash','bank','credit_card','savings','wallet','upi','custom')
  ),
  currency text not null default 'USD',
  opening_balance numeric(12,2) not null default 0,
  color text,
  icon text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table accounts enable row level security;
create policy "accounts: owner all" on accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Transactions: add account + transfer support.
-- A transfer moves money between two of the user's own accounts and
-- must never count toward income/expense totals — reports filter on
-- kind <> 'transfer' rather than trying to net it out after the fact.
-- ---------------------------------------------------------------------
alter table transactions
  add column if not exists account_id uuid references accounts(id) on delete set null,
  add column if not exists transfer_account_id uuid references accounts(id) on delete set null;

alter table transactions drop constraint if exists transactions_kind_check;
alter table transactions add constraint transactions_kind_check
  check (kind in ('expense','income','transfer'));

create index if not exists transactions_user_account_idx on transactions (user_id, account_id);

-- ---------------------------------------------------------------------
-- Goals: distinguish financial goals (spec item 4/14) from life goals
-- (spec item 21) without a second near-duplicate table.
-- ---------------------------------------------------------------------
alter table goals
  add column if not exists domain text not null default 'life' check (domain in ('life','financial'));

-- ---------------------------------------------------------------------
-- Task categories — spec item 12/22 equivalent for tasks.
-- ---------------------------------------------------------------------
create table if not exists task_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
alter table task_categories enable row level security;
create policy "task_categories: owner all" on task_categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table tasks
  add column if not exists category_id uuid references task_categories(id) on delete set null;

-- ---------------------------------------------------------------------
-- Recurring transactions — a rule, distinct from a single row's
-- is_recurring flag. Generating future `transactions` rows from these
-- safely (idempotently, without duplicating a month) is scheduler work
-- — this table is the source of truth the scheduler will read from.
-- ---------------------------------------------------------------------
create table if not exists recurring_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  kind text not null check (kind in ('expense','income')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  merchant text,
  cadence text not null check (cadence in ('daily','weekly','monthly','yearly','custom')),
  custom_rule text, -- used when cadence = 'custom'
  next_run_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table recurring_transactions enable row level security;
create policy "recurring_transactions: owner all" on recurring_transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- User + notification preferences — separate from `profiles` (identity)
-- so preference churn doesn't touch the identity row.
-- ---------------------------------------------------------------------
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  home_layout jsonb not null default '{}'::jsonb,
  ai_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table user_preferences enable row level security;
create policy "user_preferences: owner all" on user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  morning_summary boolean not null default true,
  evening_summary boolean not null default false,
  overdue_alerts boolean not null default true,
  budget_warnings boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table notification_preferences enable row level security;
create policy "notification_preferences: owner all" on notification_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Audit log — append-only record of security-sensitive actions
-- (account deletion, data export, etc.). Written only from trusted
-- server code paths, never from the client.
-- ---------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
create policy "audit_logs: owner read" on audit_logs for select using (auth.uid() = user_id);
-- No insert/update/delete policy for regular users — only the service
-- role (which bypasses RLS) writes here, from trusted server code.

-- ---------------------------------------------------------------------
-- Auto-provisioning on signup: creates the profile row, sensible
-- default categories, a default Cash account, and default preference
-- rows. Runs as SECURITY DEFINER so it can insert despite RLS — this
-- is the one place bypassing RLS is correct, because it's triggered
-- server-side by Supabase Auth itself, never by user input.
-- ---------------------------------------------------------------------
-- accounts didn't have an is_default_seed column in 0001 — add it
-- before the trigger function below can reference it.
alter table accounts add column if not exists is_default_seed boolean not null default false;

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;

  insert into public.accounts (user_id, name, type, is_default_seed)
    select new.id, 'Cash', 'cash', true
    where not exists (select 1 from public.accounts where user_id = new.id);

  insert into public.categories (user_id, name, kind, is_default)
  select new.id, c.name, c.kind, true
  from (values
    ('Food', 'expense'), ('Groceries', 'expense'), ('Transport', 'expense'),
    ('Shopping', 'expense'), ('Bills', 'expense'), ('Rent', 'expense'),
    ('Utilities', 'expense'), ('Entertainment', 'expense'), ('Health', 'expense'),
    ('Education', 'expense'), ('Travel', 'expense'), ('Subscriptions', 'expense'),
    ('Personal', 'expense'), ('Investments', 'expense'), ('Other', 'expense'),
    ('Salary', 'income'), ('Other Income', 'income')
  ) as c(name, kind)
  where not exists (select 1 from public.categories where user_id = new.id);

  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.accessibility_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
