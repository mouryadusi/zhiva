import { z } from 'zod';

// Every write path (API route or server action) parses input through
// these before touching the database — never trust client-shaped data,
// even from our own frontend.
export const transactionInput = z.object({
  kind: z.enum(['expense', 'income', 'transfer']),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default('USD'),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid({ message: 'Choose an account' }),
  transfer_account_id: z.string().uuid().nullable().optional(),
  merchant: z.string().max(200).nullable().optional(),
  payment_method: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  receipt_url: z.string().url().nullable().optional(),
  occurred_at: z.string().datetime().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().max(200).nullable().optional(),
}).refine((v) => v.kind !== 'transfer' || (v.transfer_account_id && v.transfer_account_id !== v.account_id), {
  message: 'Pick a different destination account for a transfer',
  path: ['transfer_account_id'],
});
export type TransactionInput = z.infer<typeof transactionInput>;

export const accountInput = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['cash', 'bank', 'credit_card', 'savings', 'wallet', 'upi', 'custom']),
  currency: z.string().length(3).default('USD'),
  opening_balance: z.number().default(0),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});
export type AccountInput = z.infer<typeof accountInput>;

export const budgetInput = z.object({
  category_id: z.string().uuid().nullable(),
  period: z.enum(['weekly', 'monthly']),
  amount_limit: z.number().nonnegative(),
});
export type BudgetInput = z.infer<typeof budgetInput>;

export const categoryInput = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(['expense', 'income']),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});
export type CategoryInput = z.infer<typeof categoryInput>;
