// Server-side entitlements for Sparky (the AI assistant — every call hits the model API and costs
// real money). TWO tiers can use it:
//   · hobby (free): a small monthly allowance on a cheap model (Haiku) — the "taste" that lets a
//     visitor watch the assistant reason about THEIR circuit before paying. Metered + capped.
//   · pro: the flagship model with the full monthly budget.
// Allowlisted emails (founder/dev) are pro and exempt from the budget gate.
//
// There's no billing/subscription system yet, so "who is pro" is an explicit email allowlist via the
// SPARKY_PRO_EMAILS env var (comma-separated, case-insensitive). When billing lands, planForEmail
// reads the user's plan from the database — the call sites (assistant route + /api/me) stay the same.
//
// NOTE: server-only. Do not import from client components — it reads env that isn't exposed to the browser.

export type Plan = "hobby" | "pro";

function proEmails(): Set<string> {
  return new Set(
    (process.env.SPARKY_PRO_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function planForEmail(email: string | null | undefined): Plan {
  if (!email) return "hobby";
  return proEmails().has(email.toLowerCase()) ? "pro" : "hobby";
}

/** Is this email a Pro account by the allowlist? (The DB plan is checked separately at the call site;
 *  this is the allowlist half + the eventual planForEmail truth.) */
export function canUseSparky(email: string | null | undefined): boolean {
  return planForEmail(email) === "pro";
}

// ── per-plan Sparky budgets ─────────────────────────────────────────────────────────────────────
// Both USD/month, env-tunable. 0 = unlimited (the Pro early-adopter default). The free allowance is
// deliberately small and runs on a cheap model — enough to feel the assistant reason about one real
// circuit, not enough to be a free Pro account.
const PRO_BUDGET = Number(process.env.SPARKY_MONTHLY_BUDGET_USD || 0);
const FREE_BUDGET = Number(process.env.SPARKY_FREE_BUDGET_USD || 0.5);

/** Monthly Sparky budget in USD for a plan. 0 means unlimited (no cap enforced). */
export function sparkyBudgetUsd(plan: Plan): number {
  return plan === "pro" ? PRO_BUDGET : FREE_BUDGET;
}

/** The model a plan's Sparky runs on. Free rides a cheap model (cost control + still a real agent);
 *  pro uses the route's default flagship (return undefined → caller falls back to MODEL). */
export function sparkyModel(plan: Plan): string | undefined {
  return plan === "pro" ? undefined : (process.env.SPARKY_FREE_MODEL || "claude-haiku-4-5");
}
