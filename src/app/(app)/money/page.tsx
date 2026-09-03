import { redirect } from 'next/navigation';

// /money was split into /transactions (activity, search, edit) and
// /budgets (progress against limits) as part of the nav restructure to
// Home/Transactions/Budgets/Goals/Assistant. Redirect rather than 404
// for anyone with an old link or bookmark.
export default function MoneyRedirect() {
  redirect('/transactions');
}
