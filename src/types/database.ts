// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Once the project is linked, replace with generated types:
//   supabase gen types typescript --project-id <id> > src/types/database.generated.ts

export type Currency = string;

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: 'expense' | 'income';
  color: string | null;
  icon: string | null;
  is_default: boolean;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit_card' | 'savings' | 'wallet' | 'upi' | 'custom';
  currency: Currency;
  opening_balance: number;
  color: string | null;
  icon: string | null;
  archived: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  kind: 'expense' | 'income' | 'transfer';
  amount: number;
  currency: Currency;
  category_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  merchant: string | null;
  payment_method: string | null;
  notes: string | null;
  receipt_url: string | null;
  occurred_at: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurring_transaction_id: string | null;
  occurrence_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  kind: 'expense' | 'income';
  amount: number;
  currency: Currency;
  merchant: string | null;
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  custom_rule: string | null;
  next_run_at: string;
  active: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  period: 'weekly' | 'monthly';
  amount_limit: number;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  horizon: 'week' | 'month' | 'life';
  domain: 'life' | 'financial';
  target_value: number | null;
  current_value: number;
  unit: string | null;
  status: 'active' | 'done' | 'archived';
}

export interface Task {
  id: string;
  user_id: string;
  parent_task_id: string | null;
  goal_id: string | null;
  title: string;
  notes: string | null;
  scope: 'today' | 'week' | 'month' | 'life';
  priority: 'low' | 'normal' | 'high';
  due_at: string | null;
  recurrence_rule: string | null;
  completed_at: string | null;
  postponed_count: number;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  task_id: string | null;
  label: string;
  trigger_type:
    | 'due_time'
    | 'before_due'
    | 'morning'
    | 'evening'
    | 'recurring'
    | 'overdue'
    | 'daily_summary';
  offset_minutes: number | null;
  scheduled_at: string | null;
  recurrence_rule: string | null;
  sent_at: string | null;
  dismissed_at: string | null;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  mood: string | null;
  linked_task_ids: string[];
}

export interface AiMemory {
  id: string;
  user_id: string;
  kind: 'preference' | 'routine' | 'goal_context' | 'fact';
  content: string;
  confidence: number | null;
  source: 'user_stated' | 'derived';
}

export interface AiInsight {
  id: string;
  user_id: string;
  category: 'spending' | 'tasks' | 'goals' | 'reminders' | 'reflection';
  headline: string;
  detail: string | null;
  data_ref: Record<string, unknown> | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface AccessibilityPreferences {
  user_id: string;
  active_presets: string[];
  custom_flags: Record<string, boolean>;
}
