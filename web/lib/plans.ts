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
      "The core checking engine — voltage & current follow every wire, so over-voltage, blown budgets, shorts, and reverse polarity get caught where they'll actually happen",
      "Connectors that know their pinout — USB & battery pins arrive pre-declared, and per-contact current ratings are checked",
      "What-if stress tests + a growing set of free engineering calculators",
      "Version history — your latest 5 checkpoints, with loss-proof restore",
      "PCB editor with DRC; export design JSON + KiCad netlist",
      "Up to 10 designs — public or unlisted, like a public repo (private comes with Pro)",
      "Community block library",
      "ANSI / IEC symbols and Light · Mid · Dark themes",
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
      "Sparky — the AI engineer: builds and wires blocks, authors real chips from a part number, declares the board edge, runs the stress test — and every claim it makes passes through the checking engine, so it can't bluff you",
      "Signal-integrity analysis — declare a net RS-485 / CAN / I2C / USB and the physics is enforced: termination present, rise time achievable from your pull-ups, trace lengths & pair matching checked on the PCB",
      "Galvanic-isolation guarantees — declare that two blocks share no conductive path; re-verified on every edit, and a violation names the exact net that bridged the barrier",
      "Manufacturing export — the routed board as .kicad_pcb + BOM CSV, ready for any fab workflow",
      "Private designs — enforced down at the database layer, not just hidden in the UI",
      "Unlimited designs — no cap",
      "Deep version history on every design",
      "Priority support",
    ],
  },
  {
    key: "team",
    name: "Team",
    tagline: "Shared workspaces for hardware teams.",
    price: "Let's talk",
    priceNote: "planned",
    cta: { label: "Contact us", href: "mailto:contact@usnylon.com" },
    featuresLead: "Everything in Pro, plus:",
    features: [
      "Shared team workspaces",
      "Roles & permissions",
      "Single sign-on (SSO)",
      "Centralized billing & admin",
    ],
  },
];
