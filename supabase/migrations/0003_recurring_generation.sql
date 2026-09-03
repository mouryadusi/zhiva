-- ZHIVA migration 0003.
-- Adds the link between a generated transaction and the recurring rule
-- that produced it, plus a real database-level uniqueness constraint
-- so the same occurrence can never be generated twice — even under a
-- race (two tabs loading Home at once, a retry after a timeout, etc).
-- Additive only; nothing from 0001/0002 is touched.

alter table transactions
  add column if not exists recurring_transaction_id uuid references recurring_transactions(id) on delete set null,
  add column if not exists occurrence_date date;

-- Partial unique index: only applies to rows that actually came from a
-- recurring rule (occurrence_date is null for every ordinary manual
-- transaction, so those are never constrained by this). This is the
-- actual idempotency guarantee — application code double-checks before
-- inserting too, but this is what makes a duplicate insert impossible
-- even if that check is ever bypassed or raced.
create unique index if not exists transactions_recurring_occurrence_uidx
  on transactions (recurring_transaction_id, occurrence_date)
  where recurring_transaction_id is not null;

create index if not exists transactions_recurring_id_idx
  on transactions (recurring_transaction_id)
  where recurring_transaction_id is not null;

-- Index the column the generator actually queries on ("which recurring
-- rules are due"), scoped per user for RLS-filtered scans.
create index if not exists recurring_transactions_due_idx
  on recurring_transactions (user_id, active, next_run_at)
  where active = true;
