import { z } from 'zod';

export const taskInput = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(3000).nullable().optional(),
  scope: z.enum(['today', 'week', 'month', 'life']).default('today'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  due_at: z.string().datetime().nullable().optional(),
  goal_id: z.string().uuid().nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
  recurrence_rule: z.string().max(200).nullable().optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

export const goalInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  horizon: z.enum(['week', 'month', 'life']).default('month'),
  domain: z.enum(['life', 'financial']).default('life'),
  target_value: z.number().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
});
export type GoalInput = z.infer<typeof goalInput>;

export const reminderInput = z.object({
  task_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(200),
  trigger_type: z.enum([
    'due_time',
    'before_due',
    'morning',
    'evening',
    'recurring',
    'overdue',
    'daily_summary',
  ]),
  offset_minutes: z.number().int().nonnegative().nullable().optional(),
  recurrence_rule: z.string().max(200).nullable().optional(),
});
export type ReminderInput = z.infer<typeof reminderInput>;

export const journalEntryInput = z.object({
  entry_date: z.string().date(),
  content: z.string().min(1).max(20000),
  mood: z.string().max(40).nullable().optional(),
  linked_task_ids: z.array(z.string().uuid()).max(20).optional(),
});
export type JournalEntryInput = z.infer<typeof journalEntryInput>;
