# ZHIVA

Know your life. Shape what's next.

A private, mobile-first personal-finance and life operating system —
Money, Tasks, Goals, Journal, and a deterministic financial assistant —
built with Next.js (App Router) + TypeScript + Tailwind + Supabase
(Postgres, Auth) + Zod + recharts.

This README reflects the repository's current, actual state after
several build passes. It is written to be read once, start to finish,
not skimmed — every claim below is qualified by how it was verified.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
```

1. Create a Supabase project.
2. Run every file in `supabase/migrations/` **in order** against it
   (Supabase SQL editor, or `supabase db push` with the CLI):
   `0001_init.sql` → `0002_accounts_and_provisioning.sql` →
   `0003_recurring_generation.sql` → `0004_households.sql`.
3. Fill in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` —
     Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. Server-only. Used by the
     reminder cron job and the household-invite route (see below) —
     never imported client-side.
   - `CRON_SECRET` — any random string; protects `/api/cron/reminders`.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — generate
     with `npx web-push generate-vapid-keys`, needed for push
     notifications.
4. `npm run dev` and open `http://localhost:3000`.

Deploy to Vercel; `vercel.json` wires the reminder scheduler via
Vercel Cron.

---

## Navigation

Primary (bottom nav, 5 items): **Home · Transactions · Budgets · Goals
· Assistant**.

Secondary — reachable via the profile icon (top-right on every screen)
→ `/you`, which has a "More" list linking to: **Journal · Day-to-day
Tasks · All Insights · Recurring Transactions · Reports · Net Worth ·
Calendar · Household**. Also on `/you`: Accounts, Accessibility,
Passcode lock, Bank connection status, Logout.

Nothing was deleted to make room for the 5-item primary nav — every
route below is real, protected by middleware, and reachable.

---

## 1. IMPLEMENTED

### Core money system
- **Accounts**: cash/bank/credit_card/savings/wallet/upi/custom, with
  real computed balances (`calculateAccountBalance` — opening balance
  + income − expense ± transfers, in `src/lib/money.ts`).
- **Transactions**: income/expense/transfer, search, filters (type,
  category, account, date range, amount range), sort (newest/oldest),
  clear-filters, live result count, inline edit, delete with a real
  **undo** (optimistic hide + delayed server delete + `aria-live`
  toast — not a fake confirmation), bulk-select and bulk-delete,
  duplicate-transaction badges, recurring badges.
- **Categories**: seeded automatically on signup (via a Postgres
  trigger, `0002`), used consistently everywhere.
- **Budgets**: create/edit/delete, monthly progress bars, an "Overall"
  budget correctly compares against *total* spend (a real bug from an
  earlier pass — it was comparing against only *uncategorized*
  transactions — found and fixed, then consolidated into one canonical
  function, `computeBudgetProgress`, used identically by Home, the
  Budgets page, the AI assistant, and the insight engine so the four
  of them can never disagree). Budget **pacing/projection**: each
  monthly budget extrapolates month-end spend from the current daily
  rate and flags "on pace to be X over" before the limit is actually
  crossed, always shown with a `Projection` badge.
- **Recurring transactions**: full CRUD, pause/resume, cadence
  (daily/weekly/monthly/yearly; `custom` is accepted but deliberately
  never auto-advanced — see Known Limitations). Generation is
  **idempotent by construction**: a Postgres partial unique index on
  `(recurring_transaction_id, occurrence_date)` (migration `0003`)
  makes a duplicate occurrence impossible even under a race, backed by
  an application-level check first so the common case never attempts a
  doomed insert. Bounded catch-up (max 24 occurrences per call) so a
  long-neglected rule can't flood the ledger. Runs automatically on
  Home/Transactions page load, plus a manual "Check for due
  transactions" button.
- **Goals**: life and financial domains. Financial goals show a real
  "months to goal" projection from the user's actual recent average
  net cash flow (`projectGoalCompletion`, shared by the Goals page and
  the Assistant — one implementation, not two), and a "what if I saved
  X/month" calculator, explicitly badged `Hypothetical` — kept visually
  distinct from the `Projection` badge (actual pace vs. a chosen
  scenario are never conflated).
- **Reports**: date-range presets (this month / last month / last 3 /
  last 6 months / this year / custom) via one canonical
  `resolveReportRange`. Charts: income vs. expenses, net cash flow,
  category trend (top 4 categories over time), income trend, category
  breakdown bar chart — all through `recharts` (already a dependency;
  none added). Summary lists: top merchants, per-account summary.
  Every number comes from `money.ts` aggregation functions — nothing
  is computed inline in the Reports page.
- **Export**: real client-side CSV/JSON download (Blob + anchor
  click — an actual browser download, not a simulated one), filename
  pattern `zhiva-transactions-<range>-<date>.ext`, respects the active
  Reports date range or the active Transactions filters.
- **Calendar**: month grid, daily income/expense totals, spending-heavy
  days visually intensified, click a day to see its transactions,
  month navigation, all from real transaction data.
- **Net worth**: `assets − liabilities`, computed entirely from the
  existing `calculateAccountBalance`/`sumAccountBalances` — no new
  schema. Assets vs. liabilities is determined by the *actual computed
  balance sign*, not by account-type label (an overdrawn "bank"
  account is honestly a liability). No historical net-worth chart —
  ZHIVA doesn't store point-in-time snapshots, and the UI says so
  rather than fabricating a trend.
- **Receipt capture**: photo picker with camera capture on mobile
  (`capture="environment"`), live preview. OCR extraction is isolated
  behind `src/lib/receipt-ocr.ts`, which always returns
  `available: false` with an honest reason — no provider is
  configured, and the function never guesses at a merchant/amount. The
  photo is for on-screen reference during manual entry only; it is
  **not uploaded or persisted** (no Supabase Storage bucket is
  configured) — the UI says this explicitly rather than pretending it
  was saved.

### AI (zero LLM calls — read this section if nothing else)
There is no call to any language model anywhere in this codebase. The
architecture is strictly `database → verified calculation → structured
facts → template-based sentence`:
- `src/lib/ai/facts.ts` — small, reusable, independently-checkable
  fact-getters, each tagged `actual` / `estimate` / `projection`.
- `src/lib/ai/financial-assistant.ts` — ~19 intents, from single-fact
  ("where did I spend the most") to multi-step composed reasoning
  ("why did I spend more" → fetches both months' category breakdowns,
  diffs them, names the real top contributors). Scenario questions
  ("can I afford ₹20,000", "what if I cut dining by 20%") extract a
  number from the question via regex and run a real calculation against
  it — never inventing the answer.
- `src/lib/ai/intent.ts` — plain regex pattern matching, not a model.
  A question that doesn't match anything gets an honest "I can help
  with..." message, never a guess.
- `src/lib/ai/insights.ts` — six proactive detectors (budget risk,
  unusual category, declining balance, large upcoming obligation,
  possible duplicates, undetected subscriptions), ranked by severity.
  **Home shows exactly one** — the highest-severity — via a
  `NextActionCard` that also considers overdue/high-priority tasks and
  postponed-task nudges in one deterministic priority function
  (`determineNextAction`), replacing what used to be three separate,
  competing cards.
- The Assistant page shows every answer's evidence and an expandable
  "How was this calculated?" panel, plus a provenance badge
  (Actual/Estimate/Projection/Hypothetical) on every non-actual number.

### Everything else
Home (balance, net-trend chart with a solid actual line and a dashed
projected segment, money flow, compact budget status, month-end
projection, goals, today's tasks, "do this next", recent activity,
journal prompt), Journal (browse/search/delete by date), day-to-day
Tasks (today/week/month), Accessibility (Night/Focus/Low
Vision/Reduced Motion/High Contrast/Comfortable presets plus ~25
individual options across vision/movement/cognitive categories, each
mapped to a real CSS effect), PWA (manifest, service worker, installable
icons), a merchant→category **suggestion** (built from the user's own
transaction history, always visibly labeled and instantly overridable,
zero ML/fuzzy-matching — exact merchant-string match only).

### Security features added this pass (see honest scope below)
- **Passcode/app lock** (`src/lib/app-lock.ts`,
  `src/components/security/`): a **local, device-level** lock using
  Web Crypto SHA-256 with a random per-device salt — never plaintext,
  never sent to a server. Gates the entire app shell (nav included)
  until unlocked for the session. "Forgot passcode" clears the local
  lock and signs the user out, falling back to real Supabase Auth
  rather than a broken local-only recovery flow.
- **Household / multi-user primitive** (migration `0004`): `households`
  + `household_members` tables, fully RLS'd, additive only — **no
  existing table's RLS was touched**, and no financial data
  (transactions, accounts, budgets, goals) is shared by this migration.
  Create a household, invite by email (via a server route using the
  admin client — the one legitimate use here, to resolve an email to a
  user id, since no RLS-safe client query can do that), view roster,
  leave. The UI states plainly that shared financial visibility isn't
  built yet.
- **Bank-sync architecture** (`src/lib/bank-sync/provider.ts`): a
  `BankSyncProvider` interface (status, connect, list accounts,
  disconnect) with only an `unconfiguredProvider` implementation. The
  Connect button is disabled with an honest tooltip. No fake
  connection, no fake accounts, ever.

---

## 2. Architecture integrity (confirmed by direct inspection, not assumed)

- **Financial calculations remain fully deterministic.** Every number
  in every screen and every AI answer traces back to `money.ts`,
  `facts.ts`, or a Supabase query — confirmed by grepping for
  `.reduce(` outside those files after every major batch this pass and
  fixing every hit (found and centralized `overallExpenseTotal`,
  `sumAccountBalances`; found and wired in three functions —
  `categoryBreakdownFromTransactions`, `topMerchants`,
  `accountSummary`, `isWithinRange` — that existed in `money.ts` from
  an earlier session but were never actually called anywhere, and
  would have sat as dead code next to my own duplicate logic if not
  caught).
- **Zero LLM calls.** Confirmed: no `fetch` to any AI provider, no
  API key for one in `.env.example`, no SDK for one in `package.json`.
- **No AI provider was introduced** at any point across any pass.
- **UI does not duplicate financial calculations** — this was
  violated twice during this project's history and caught both times:
  the Overall-budget bug (compared against uncategorized transactions
  instead of total spend, in 4 independent implementations) and this
  pass's near-miss (writing new `totalsByMerchant`/`totalsByAccount`
  before discovering `topMerchants`/`accountSummary` already existed).
  Both were consolidated to one canonical implementation per concept.

---

## 3. Verification

**VERIFIED** (I directly observed the result):
- A custom Python bracket/brace balance checker (comment-aware, so it
  doesn't false-positive on prose like "[start, end)") run against
  every `.ts`/`.tsx` file in `src/` after every batch of edits across
  every pass this project has had — clean at the time of this writing.
- Every `import { X } from 'Y'` introduced across every pass
  cross-checked against a grep of `Y`'s actual `export` statements —
  confirmed no broken imports remain.
- Zero unlabeled form controls anywhere in the app — confirmed by a
  repo-wide scan for `<input>`/`<select>`/`<textarea>` without an
  associated `htmlFor`/`Labeled*` component/`aria-label`/`sr-only`.
- A real `React.FormEvent` bug (used without importing `React`) was
  found by this pass's verification sweep and fixed before packaging —
  concrete evidence the sweep catches real defects, not just a
  formality.
- `package.json`: `date-fns` was declared but never imported anywhere
  in `src/` (confirmed by grep) — removed. `react-dom` has no direct
  import either but is a legitimate Next.js/React peer dependency used
  internally by the framework — retained and documented as such rather
  than removed on a naive "unused" heuristic.

**STATICALLY VERIFIED** (read by hand against constructed inputs, not
compiled or run):
- `computeBudgetProgress`, `overallExpenseTotal`, `sumAccountBalances`,
  `determineNextAction`, the recurring-transaction cadence math, and
  the merchant-suggestion logic — each traced against multiple
  constructed cases (zero-spend, over-budget, multi-currency, no
  insight/no task, known-then-overridden merchant) and produce the
  expected result on paper.
- Every canonical `money.ts`/`facts.ts` function's signature
  cross-checked against every call site introduced this pass (e.g.
  `accountSummary(accounts, allTimeTransactions, periodTransactions)`,
  `topMerchants(transactions, limit)`) to confirm argument order and
  shape actually match — several were verified this way explicitly
  rather than assumed correct from memory of having written them.

**REQUIRES LIVE VERIFICATION** (genuinely cannot be confirmed from this
sandbox — no network access means no `npm install`, no
`build`/`typecheck`/`lint`, no live Supabase connection, nothing ever
rendered in a browser or on a device):
- `npm run build` / `npm run typecheck` actually succeeding. Manual
  review is not a substitute for the compiler.
- Every financial number against a live database with real
  multi-account, multi-currency, multi-month data.
- RLS isolation between two real signed-up users — for **every**
  table, including the new `households`/`household_members` (test SQL
  below).
- Rendering: every `recharts` chart (Reports has five now), the
  Calendar grid's visual intensity shading, the passcode lock screen's
  actual gating behavior, the receipt photo preview, Toast/Undo timing,
  and all mobile layouts and touch-target sizing.
- The household invite flow specifically: it depends on
  `supabase.auth.admin.listUsers()` actually working with a real
  service-role key and returning emails — never called against a real
  Supabase project from this sandbox.
- The AI assistant's regex-based intent detection against real
  free-form phrasing beyond the exact example questions it was
  designed against.

---

## 4. Known limitations (genuine, not hedging)

- **Custom-cadence recurring transactions** are accepted at creation
  but never auto-advanced — there's no general-purpose recurrence-rule
  parser in this codebase, and guessing at what a free-text custom
  rule means was judged worse than being honest that it needs manual
  updating.
- **Receipt photos are not persisted** — no Supabase Storage bucket is
  configured. The photo is on-screen reference only during entry.
- **Passcode lock is local-only** — it is a convenience layer to deter
  casual access to an already-signed-in device, explicitly not a
  second account-security factor. Anyone with access to the browser's
  storage or dev tools can bypass it. This is stated in the settings
  UI, not just this README.
- **Household sharing is membership-only** — creating a household and
  inviting someone does not yet share any transactions, accounts,
  budgets, or goals. That's a deliberate boundary: deciding which
  financial records become visible to a partner is a privacy decision
  that needs its own UX, not something to silently enable via a
  migration.
- **Bank sync is architecture only** — an interface and a disabled
  button. No provider is connected; connecting one needs real
  credentials this environment doesn't have.
- **AI intent detection is regex-based**, not embeddings or an LLM
  router — deliberately, since either would introduce this app's first
  AI-provider dependency, which felt like a decision for you to make
  explicitly rather than something to slip in while "improving" intent
  matching.
- **Colour-blindness accessibility presets** adjust semantic colour
  *lightness* for separation; pairing colour with an icon/label in
  each component (the fuller fix) isn't done.
- **No dependency/build verification was actually run** — see section
  3. This is stated as plainly as I can state it: static review is not
  a build.

---

## 5. Files/routes changed (major areas, cumulative across all passes)

- `supabase/migrations/`: `0001` (full schema + RLS), `0002` (accounts,
  transfers, auto-provisioning trigger), `0003` (recurring-transaction
  idempotency), `0004` (households — additive, no existing RLS touched).
- `src/lib/money.ts`: the canonical financial-calculation layer —
  every aggregate (balances, budgets, category/merchant/account
  breakdowns, monthly series, report-range resolution) lives here.
- `src/lib/ai/`: `facts.ts`, `financial-assistant.ts`, `intent.ts`,
  `insights.ts` — the deterministic AI layer.
- `src/lib/recurring.ts`, `src/lib/next-action.ts`,
  `src/lib/app-lock.ts`, `src/lib/receipt-ocr.ts`,
  `src/lib/bank-sync/provider.ts` — new domain logic this pass.
- `src/components/design-system/`: `Button`, `Primitives`,
  `ProvenanceBadge`, `EmptyState`, `Skeleton`, `Field` (labeled
  inputs), `Toast`.
- `src/components/{money,reports,tasks,security,home,nav}/` — all
  feature UI.
- `src/app/(app)/{home,transactions,budgets,goals,assistant,insights,
  journal,tasks,you,recurring,reports,net-worth,calendar,household}/`
  — every route, each middleware-protected.
- `src/app/api/{expenses,budgets,goals,tasks,journal,reminders,
  preferences,accounts,ai/ask,recurring,household}/` — every API route,
  each re-checking auth and scoping to `auth.uid()` server-side.

---

## 6. Test checklist

**Core flow (one user):**
1. Sign up → confirm email → land on `/home`. Default Cash account and
   categories exist automatically (check `/you`).
2. `/transactions` → add an expense with a merchant → refresh → still
   there. Add the same merchant again → category is suggested,
   labeled, and overridable.
3. Edit that transaction inline → save → refresh → change persists.
   Delete it → Undo toast appears → click Undo → it's back. Delete
   again and let the toast expire → refresh → actually gone.
4. `/budgets` → set an Overall monthly budget → confirm it tracks
   *total* spend, not just uncategorized transactions.
5. `/recurring` → add a monthly rule dated today → click "Check for
   due transactions" → a transaction appears in `/transactions`. Click
   the button again immediately → confirm nothing is duplicated.
6. `/reports` → switch date ranges → confirm charts and totals update
   and match `/transactions` for the same range. Export CSV → confirm
   a real file downloads with the right columns.
7. `/calendar` → confirm daily totals match `/transactions` for that
   month; click a day → see that day's transactions.
8. `/net-worth` → confirm it equals the sum of account balances shown
   on `/you`.
9. `/assistant` → ask "Where did I spend the most this month?" and
   "Can I afford a 20000 purchase?" → confirm real numbers and a
   Projection badge on the second answer.
10. `/you` → set a passcode → refresh the app (or navigate away and
    back in a new tab) → confirm the lock screen appears and the
    correct passcode unlocks it. Remove the passcode → confirm it no
    longer locks.
11. `/you` → Household → create one → confirm you appear as owner.

**Multi-user isolation (run in the Supabase SQL editor, or via two
real signups):**
```sql
-- As User A:
select id, amount, merchant from transactions where user_id = auth.uid();

-- As User B (second browser/incognito), same query — must return
-- ONLY User B's rows, never User A's, even with no user_id filter
-- typed by hand (RLS injects it).

-- Household isolation specifically:
select * from households; -- must only show households User B belongs to
select * from household_members; -- must only show rosters User B can see
```
If User B can see User A's rows anywhere, an RLS policy is missing —
re-run the migrations in order and confirm RLS is enabled on every
table via Supabase → Database → Tables → (table) → RLS toggle.

**PWA:** Safari on iOS → Share → Add to Home Screen → opens standalone.

**Accessibility:** `/you` → toggle presets individually and in
combination → confirm visible changes; enable OS-level reduced motion
→ confirm animations disable; tab through the Transactions edit-row
swap and confirm focus lands sensibly.
