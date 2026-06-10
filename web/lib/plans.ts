// Single source of truth for the pricing tiers (rendered on /pricing and referenced by the dashboard).
// Hobby = free, up to HOBBY_DESIGN_CAP designs, public only. Pro = unlimited + private (paid; price is not
// set yet, so the card shows features + an early-adopter discount, no number). We do NOT give Pro away for
// free — the free tier is Hobby.

/** The free (Hobby) design cap. Pro lifts it entirely. */
export const HOBBY_DESIGN_CAP = 10;

export interface Plan {
  key: "hobby" | "pro" | "team";
  name: string;
  tagline: string;
  price?: string;      // "$0" / "Let's talk" — omitted when there's no number to show (Pro, for now)
  priceNote: string;   // small line under the price (or a standalone badge when there's no price)
  cta: { label: string; href: string };
  highlight?: boolean; // featured column (Pro)
  featuresLead?: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    key: "hobby",
    name: "Hobby",
    tagline: "Understand your circuits — free, forever.",
    price: "$0",
    priceNote: "free forever",
    cta: { label: "Start free", href: "/signup" },
    features: [
      "The full understand-loop — blocks, hover & drill-in, expand-to-discrete",
      "Live linting + power-budget checks",
      "ANSI / IEC symbols and Light · Mid · Dark themes",
      "Up to 10 designs — public or unlisted, like a public repo (private comes with Pro)",
      "Community block library",
      "Basic export — design JSON + KiCad netlist",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For keeping work private and shipping real hardware.",
    // KEEP IN SYNC with the live Stripe price (STRIPE_PRICE_PRO_MONTHLY). The page promises this number.
    price: "$9",
    priceNote: "/month · early-adopter price",
    cta: { label: "Start free", href: "/signup" },
    highlight: true,
    featuresLead: "Everything in Hobby, plus:",
    features: [
      "Sparky — the AI assistant that builds, wires, and explains your design",
      "Unlimited designs — no cap",
      "Private designs",
      "Manufacturing-grade export — Gerber, BOM, pick-and-place",
      "Version history on every design",
      "Advanced checks",
      "Your own private block library",
      "Priority support",
    ],
  },
  {
    key: "team",
    name: "Team",
    tagline: "Shared workspaces for hardware teams.",
    price: "Let's talk",
    priceNote: "planned",
    cta: { label: "Contact us", href: "mailto:hello@electrace.net" },
    featuresLead: "Everything in Pro, plus:",
    features: [
      "Shared team workspaces",
      "Roles & permissions",
      "Single sign-on (SSO)",
      "Centralized billing & admin",
    ],
  },
];
