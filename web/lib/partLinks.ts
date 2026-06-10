// Outbound part-purchase links for BOM rows. Vendor-neutral rule: links are built ONLY from what
// the row already says (part number, else value + footprint) — never the other way around; nothing
// about a link ever influences which part a block declares. When the affiliate program is approved,
// NEXT_PUBLIC_AFFILIATE_LINK_TEMPLATE wraps the outbound URL in the tracking template
// (e.g. "https://…/c/123/456?u={url}"); until then links go straight to the distributor.
import type { BomRow } from "@electrace/core";

const TEMPLATE = process.env.NEXT_PUBLIC_AFFILIATE_LINK_TEMPLATE ?? "";

/** Wrap an outbound distributor URL in the affiliate tracking template, when configured. */
export function outbound(url: string): string {
  return TEMPLATE.includes("{url}") ? TEMPLATE.replace("{url}", encodeURIComponent(url)) : url;
}

/** The search text for a row: the declared part number when there is one, else value + package. */
export function partQuery(r: BomRow): string {
  if (r.part) return r.part;
  return [r.value, r.footprint, !r.value && !r.footprint ? r.type : ""].filter(Boolean).join(" ");
}

/** Digi-Key search link for one BOM row (affiliate-wrapped when configured). */
export function digikeyUrl(r: BomRow): string {
  return outbound(`https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(partQuery(r))}`);
}

/** Rows that can go into a real cart: they declare an orderable part number. */
export const orderable = (r: BomRow): boolean => !!r.part;
