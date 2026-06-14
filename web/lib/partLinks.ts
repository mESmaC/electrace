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

// Role/family PLACEHOLDERS that live in the same `part` field as real MPNs but name a generic part,
// not an orderable SKU (a block's drawing says "p-fet" the way it says "comparator"). Sent to
// Digi-Key's myLists they're unresolvable and reject the whole list → 502. Connectors are excluded
// separately, by row type, because their catalog ids (rj45, hdr-2…) contain digits and slip past
// the digit/word heuristic below.
const PART_PLACEHOLDERS = new Set(["p-fet", "n-fet", "fet", "comparator", "opamp", "mosfet", "npn", "pnp", "bjt", "diode"]);

/** Does this look like an actual orderable part number (BC547, TP4056, SMBJ18A…)? Two ways it
 *  isn't: a descriptive sentence ("logic-level N-MOSFET, ≥30V…") with punctuation/spaces, or a
 *  generic family/role placeholder ("p-fet", "comparator"). Both return 0 results and get the whole
 *  cart rejected — a real MPN essentially always carries a digit, a family word never does. */
export function looksLikeMpn(s: string | undefined): s is string {
  if (!s || s.length < 3 || s.length > 32 || /[\s,;≥≤()]/.test(s)) return false;
  const lc = s.toLowerCase();
  if (PART_PLACEHOLDERS.has(lc)) return false;
  return /\d/.test(s); // a real orderable PN carries at least one digit; bare family words don't
}

/** Searchable fallbacks per part type — generic, but they return RESULTS instead of zero. */
const TYPE_SEARCH: Record<string, string> = {
  res: "Resistor", cap: "Ceramic Capacitor", "cap-pol": "Electrolytic Capacitor", inductor: "Inductor",
  mosfet: "MOSFET", nmos: "N-Channel MOSFET", pmos: "P-Channel MOSFET", bjt: "Bipolar Transistor",
  npn: "NPN Transistor", pnp: "PNP Transistor", diode: "Rectifier Diode", schottky: "Schottky Diode",
  zener: "Zener Diode", tvs: "TVS Diode", led: "LED", crystal: "Crystal", regulator: "Voltage Regulator",
  fuse: "Fuse", ferrite: "Ferrite Bead", thermistor: "Thermistor", relay: "Relay", switch: "Tactile Switch",
  connector: "Connector",
};

/** The search text for a row: a REAL part number when there is one; else value + package; else a
 *  searchable type term. Never a spec sentence — those return zero results. A connector's `part`
 *  is its catalog id (rj45, hdr-2), which Digi-Key can't resolve as a PN — search by name instead. */
export function partQuery(r: BomRow): string {
  if (r.type !== "connector" && looksLikeMpn(r.part)) return r.part;
  const fp = r.footprint?.replace(/^[RC](?=\d{4}$)/, ""); // "R0603" → "0603" — the bare size is what distributors index
  const vf = [r.value, fp].filter(Boolean).join(" ");
  const typed = TYPE_SEARCH[r.type] ?? r.type;
  if (vf) return `${typed} ${vf}`;
  return typed;
}

/** Digi-Key search link for one BOM row (affiliate-wrapped when configured). */
export function digikeyUrl(r: BomRow): string {
  return outbound(`https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(partQuery(r))}`);
}

/** Rows that can go into a real cart: they declare a REAL part number. Connectors never do (their
 *  `part` is a catalog id) and family-placeholder strings poison the whole Digi-Key list request
 *  ("didn't accept the list") — both are kept out so one un-orderable row can't 502 the cart. */
export const orderable = (r: BomRow): boolean => r.type !== "connector" && looksLikeMpn(r.part);
