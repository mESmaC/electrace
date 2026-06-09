// Server-side entitlements. Paid features (currently Sparky, the AI assistant — every call hits the
// Claude API and costs real money) are gated to the Pro plan.
//
// There's no billing/subscription system yet, so "who is Pro" is an explicit email allowlist via the
// SPARKY_PRO_EMAILS env var (comma-separated, case-insensitive). When billing lands, change planForEmail
// to read the user's plan from the database — the call sites (the assistant route + /api/me) stay the same.
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

/** Gate for Sparky (the assistant). Pro-only. */
export function canUseSparky(email: string | null | undefined): boolean {
  return planForEmail(email) === "pro";
}
