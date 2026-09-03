-- ZHIVA core schema.
-- Every user-owned table has row level security enabled and a policy
-- restricting access to auth.uid() = user_id. Authorization must never
-- be enforced only in the frontend — this is the source of truth.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text default 'UTC',
  currency text default 'USD',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles: owner read" on profiles for select using (auth.uid() = id);
create policy "profiles: owner update" on profiles for update using (auth.uid() = id);
create policy "profiles: owner insert" on profiles for insert with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- Accessibility preferences — presets are stored as a set of flags so
-- combinations are additive and each maps to a CSS class client-side.
-- ---------------------------------------------------------------------
create table if not exists accessibility_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_presets text[] not null default '{}',
  custom_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table accessibility_preferences enable row level security;
create policy "a11y: owner all" on accessibility_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Money: categories, expenses, income, budgets, subscriptions
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;
create policy "categories: owner all" on categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  category_id uuid references categories(id) on delete set null,
  merchant text,
  payment_method text,
  notes text,
  receipt_url text,
  occurred_at timestamptz not null default now(),
  is_recurring boolean not null default false,
  recurrence_rule text, -- e.g. RFC5545-style RRULE, interpreted by scheduler
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_user_occurred_idx on transactions (user_id, occurred_at desc);
alter table transactions enable row level security;
create policy "transactions: owner all" on transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  period text not null check (period in ('weekly', 'monthly')),
  amount_limit numeric(12,2) not null check (amount_limit >= 0),
  created_at timestamptz not null default now()
);
alter table budgets enable row level security;
create policy "budgets: owner all" on budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  billing_cycle text not null check (billing_cycle in ('weekly','monthly','yearly')),
  next_charge_at date,
  category_id uuid references categories(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create policy "subscriptions: owner all" on subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Tasks + Goals + Habits
-- ---------------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  horizon text not null default 'life' check (horizon in ('week','month','life')),
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  status text not null default 'active' check (status in ('active','done','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "goals: owner all" on goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_task_id uuid references tasks(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  notes text,
  scope text not null default 'today' check (scope in ('today','week','month','life')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  recurrence_rule text,
  completed_at timestamptz,
  postponed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on tasks (user_id, due_at);
alter table tasks enable row level security;
create policy "tasks: owner all" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  cadence text not null default 'daily' check (cadence in ('daily','weekly')),
  created_at timestamptz not null default now()
);
alter table habits enable row level security;
create policy "habits: owner all" on habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_at)
);
alter table habit_logs enable row level security;
create policy "habit_logs: owner all" on habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Reminders — a rule attached to a task or standalone; the scheduler
-- (a cron/queue worker, not this table) turns rules into notifications.
-- ---------------------------------------------------------------------
create table if not exists reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  label text not null,
  trigger_type text not null check (
    trigger_type in ('due_time','before_due','morning','evening','recurring','overdue','daily_summary')
  ),
  offset_minutes int, -- used by 'before_due'
  scheduled_at timestamptz, -- resolved fire time, written by the scheduler
  recurrence_rule text,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_scheduled_idx on reminders (user_id, scheduled_at);
alter table reminders enable row level security;
create policy "reminders: owner all" on reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists notification_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table notification_subscriptions enable row level security;
create policy "push subs: owner all" on notification_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------
create table if not exists journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  content text not null,
  mood text,
  linked_task_ids uuid[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
alter table journal_entries enable row level security;
create policy "journal: owner all" on journal_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- AI Memory / Insights — structured, sourced facts only. The "kind"
-- and "source" columns make clear this is interpretation, never the
-- system of record for money/tasks (those tables above are).
-- ---------------------------------------------------------------------
create table if not exists ai_memories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('preference','routine','goal_context','fact')),
  content text not null,
  confidence numeric check (confidence between 0 and 1),
  source text not null default 'user_stated' check (source in ('user_stated','derived')),
  created_at timestamptz not null default now()
);
alter table ai_memories enable row level security;
create policy "ai_memories: owner all" on ai_memories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists ai_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('spending','tasks','goals','reminders','reflection')),
  headline text not null,
  detail text,
  data_ref jsonb, -- pointer to the underlying rows/aggregates that produced this insight
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table ai_insights enable row level security;
create policy "ai_insights: owner all" on ai_insights for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['profiles','transactions','goals','tasks','journal_entries']
  loop
    execute format('drop trigger if exists set_updated_at on %I;', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;
