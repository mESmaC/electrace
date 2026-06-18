// Browser-safe stand-in for `next/link`, aliased in tsup for the design-system bundle.
// next/link pulls the Next router runtime (no router in the design IIFE); design components only need
// the anchor. Renders a plain <a>, dropping Next-only props so React doesn't warn on the DOM node.
import { createElement, type ReactNode } from "react";

const NEXT_ONLY = new Set(["prefetch", "replace", "scroll", "shallow", "passHref", "legacyBehavior", "locale", "as"]);

type Href = string | { pathname?: string };
export default function Link({ href, children, ...rest }: { href?: Href; children?: ReactNode } & Record<string, unknown>) {
  const props: Record<string, unknown> = {};
  for (const k in rest) if (!NEXT_ONLY.has(k)) props[k] = rest[k];
  const h = typeof href === "string" ? href : href && typeof href === "object" ? href.pathname ?? "#" : "#";
  return createElement("a", { href: h, ...props }, children as ReactNode);
}
