// Google Ads conversion firing. The global tag (gtag.js) is loaded in app/layout.tsx; this fires
// the SIGNUP conversion at the real account-creation moment so Google Ads can optimize bidding
// toward signups (the campaign's actual goal). Safe to call anywhere on the client — it no-ops on
// the server and if gtag hasn't loaded (ad-blocked, etc.).
//
// Conversion label: a Google Ads "Sign-up" conversion ACTION produces a send_to of the form
// "AW-18168363239/XXXXXXXX". Until that action is created in the Ads UI, we fire a plain `sign_up`
// event (still recorded; can be imported as a conversion). Set NEXT_PUBLIC_GADS_SIGNUP_LABEL to the
// label once it exists and the call upgrades to a true conversion with no code change.
const SIGNUP_SEND_TO = process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL
  ? `AW-18168363239/${process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL}`
  : undefined;

type Gtag = (command: string, action: string, params?: Record<string, unknown>) => void;

function gtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof g === "function" ? g : null;
}

/** Fire the signup conversion exactly once per new account. `method` = "email" | "google" | "github". */
export function trackSignup(method: string): void {
  const g = gtag();
  if (!g) return;
  // a Google Ads conversion (when the label is configured) + a generic sign_up event (always)
  if (SIGNUP_SEND_TO) g("event", "conversion", { send_to: SIGNUP_SEND_TO });
  g("event", "sign_up", { method });
}
