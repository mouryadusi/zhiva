import { z } from 'zod';

export const recurringTransactionInput = z.object({
  kind: z.enum(['expense', 'income']),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default('USD'),
  account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  merchant: z.string().max(200).nullable().optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
  custom_rule: z.string().max(200).nullable().optional(),
  next_run_at: z.string().date(),
});
export type RecurringTransactionInput = z.infer<typeof recurringTransactionInput>;

export const recurringTransactionPatch = z.object({
  amount: z.number().positive().max(1_000_000_000).optional(),
  merchant: z.string().max(200).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']).optional(),
  next_run_at: z.string().date().optional(),
  active: z.boolean().optional(),
});
