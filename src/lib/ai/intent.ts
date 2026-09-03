export type FinancialIntent =
  | 'top_category_month'
  | 'category_spend'
  | 'compare_months'
  | 'subscriptions'
  | 'budget_status'
  | 'can_afford'
  | 'upcoming_recurring'
  | 'biggest_expenses'
  | 'unusual_spending'
  | 'goal_progress'
  | 'money_flow_overview'
  | 'balance_trend'
  | 'six_month_changes'
  | 'month_end_projection'
  | 'savings_needed_for_goal'
  | 'what_to_cut'
  | 'duplicate_transactions'
  | 'scenario_reduce_category'
  | 'unrecognized';

export interface DetectedIntent {
  intent: FinancialIntent;
  // Extracted free-text category name, if any (e.g. "food" from "how
  // much did I spend on food last month"). Matched against the user's
  // real category names server-side — never assumed to exist.
  categoryHint?: string;
  // A numeric amount pulled from the question (e.g. "₹20,000
  // purchase" → 20000), for affordability/scenario questions.
  amountHint?: number;
  // A percentage pulled from the question (e.g. "reduce dining by
  // 20%" → 20), for reduction scenarios.
  percentHint?: number;
}

const RULES: { intent: FinancialIntent; patterns: RegExp[] }[] = [
  {
    intent: 'six_month_changes',
    patterns: [/last (six|6) months/i, /past (six|6) months/i, /over the last \d+ months/i],
  },
  {
    intent: 'balance_trend',
    patterns: [/balance (falling|dropping|decreasing)/i, /why is my balance/i, /losing money/i],
  },
  {
    intent: 'money_flow_overview',
    patterns: [/where is my money going/i, /how am i doing financially/i, /money going/i],
  },
  {
    intent: 'month_end_projection',
    patterns: [/projected? (balance|spending)/i, /end of (the )?month/i, /forecast/i],
  },
  {
    intent: 'savings_needed_for_goal',
    patterns: [/how much should i save/i, /save each month/i, /save per month/i, /on track for my goal/i],
  },
  {
    intent: 'what_to_cut',
    patterns: [/what (can|should) i (cut|change)/i, /where am i overspending/i, /without affecting essentials/i],
  },
  {
    intent: 'duplicate_transactions',
    patterns: [/duplicate/i, /charged twice/i, /double.?charged/i],
  },
  {
    intent: 'scenario_reduce_category',
    patterns: [/what if i (spend|reduce|cut)/i, /if i reduce/i, /if i cut/i],
  },
  {
    intent: 'compare_months',
    patterns: [
      /compare .*month/i,
      /spending increase/i,
      /spending decrease/i,
      /what changed/i,
      /vs\.? last month/i,
      /why did i spend more/i,
      /why (did|does) my spending/i,
    ],
  },
  {
    intent: 'subscriptions',
    patterns: [/subscription/i, /recurring (expense|bill|payment)/i],
  },
  {
    intent: 'upcoming_recurring',
    patterns: [/coming up/i, /upcoming/i, /due (soon|next)/i],
  },
  {
    intent: 'budget_status',
    patterns: [/budget/i, /exceed/i, /over.?spend/i],
  },
  {
    intent: 'can_afford',
    patterns: [/can i afford/i, /safely spend/i, /how much can i spend/i],
  },
  {
    intent: 'unusual_spending',
    patterns: [/unusual/i, /anomal/i, /out of the ordinary/i],
  },
  {
    intent: 'biggest_expenses',
    patterns: [/biggest (expense|purchase)/i, /unnecessary expense/i, /largest (expense|purchase|transaction)/i, /reduce (my )?spending/i],
  },
  {
    intent: 'goal_progress',
    patterns: [/saved toward/i, /goal progress/i, /how much have i saved/i],
  },
  {
    intent: 'top_category_month',
    patterns: [/where did i spend/i, /spend the most/i, /largest categor/i, /biggest categor/i],
  },
  {
    intent: 'category_spend',
    patterns: [/how much did i spend on/i, /spent on (\w+)/i, /what happened to my (\w+) spending/i],
  },
];

const CATEGORY_HINT_PATTERN = /(?:spend on|spent on|for|to my)\s+([a-z][a-z\s]{2,20})(?:\s+spending)?(?:\s+(?:last|this)\s+(?:month|week))?\s*\??$/i;

// Matches "₹20,000", "$50000", "20000", "20,000 rupees" — strips
// currency symbols/words and commas, keeps the first number found.
const AMOUNT_PATTERN = /(?:₹|rs\.?|inr|\$|usd)?\s?([\d,]{2,10}(?:\.\d{1,2})?)\s?(?:rupees|dollars)?/i;
const PERCENT_PATTERN = /(\d{1,3})\s?%/;

function extractAmount(q: string): number | undefined {
  const match = q.match(AMOUNT_PATTERN);
  if (!match) return undefined;
  const num = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function extractPercent(q: string): number | undefined {
  const match = q.match(PERCENT_PATTERN);
  if (!match) return undefined;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 && num <= 100 ? num : undefined;
}

export function detectIntent(question: string): DetectedIntent {
  const q = question.trim();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(q))) {
      const hintMatch = q.match(CATEGORY_HINT_PATTERN);
      return {
        intent: rule.intent,
        categoryHint: hintMatch?.[1]?.trim(),
        amountHint: extractAmount(q),
        percentHint: extractPercent(q),
      };
    }
  }
  return { intent: 'unrecognized' };
}
