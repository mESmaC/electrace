// Single source of truth for the pricing tiers (rendered on /pricing and referenced by the dashboard).
// Hobby = free, up to HOBBY_DESIGN_CAP designs, public only. Pro = unlimited + private. Price is TBD
// (validation probe), so Pro shows "coming soon" and the whole thing is free during early access.

/** The free (Hobby) design cap. Pro lifts it entirely. */
export const HOBBY_DESIGN_CAP = 10;

export interface Plan {
  key: "hobby" | "pro" | "team";
  name: string;
  tagline: string;
  price: string;       // "$0" / "Coming soon" / "Let's talk"
  priceNote: string;   // small line under the price
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
      "Up to 10 designs",
      "Community block library",
      "Basic export — design JSON + KiCad netlist",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For keeping work private and shipping real hardware.",
    price: "Coming soon",
    priceNote: "free for everyone during early access",
    cta: { label: "Get early access", href: "/signup" },
    highlight: true,
    featuresLead: "Everything in Hobby, plus:",
    features: [
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
