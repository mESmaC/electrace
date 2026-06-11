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

/** Does this look like an actual orderable part number (BC547, TP4056, SMBJ18A…)? Descriptive
 *  sentences ("logic-level N-MOSFET, ≥30V, low Rds(on)…") sneak into the part field from
 *  authoring — sent verbatim they return 0 search results and get the whole cart rejected. */
export function looksLikeMpn(s: string | undefined): s is string {
  return !!s && s.length >= 3 && s.length <= 32 && !/[\s,;≥≤()]/.test(s);
}

/** Searchable fallbacks per part type — generic, but they return RESULTS instead of zero. */
const TYPE_SEARCH: Record<string, string> = {
  res: "Resistor", cap: "Ceramic Capacitor", "cap-pol": "Electrolytic Capacitor", inductor: "Inductor",
  mosfet: "MOSFET", nmos: "N-Channel MOSFET", pmos: "P-Channel MOSFET", bjt: "Bipolar Transistor",
  npn: "NPN Transistor", pnp: "PNP Transistor", diode: "Rectifier Diode", schottky: "Schottky Diode",
  zener: "Zener Diode", tvs: "TVS Diode", led: "LED", crystal: "Crystal", regulator: "Voltage Regulator",
  fuse: "Fuse", ferrite: "Ferrite Bead", thermistor: "Thermistor", relay: "Relay", switch: "Tactile Switch",
};

/** The search text for a row: a REAL part number when there is one; else value + package; else a
 *  searchable type term. Never a spec sentence — those return zero results. */
export function partQuery(r: BomRow): string {
  if (looksLikeMpn(r.part)) return r.part;
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

/** Rows that can go into a real cart: they declare a REAL part number — descriptive strings
 *  poison the whole Digi-Key list request ("didn't accept the list"). */
export const orderable = (r: BomRow): boolean => looksLikeMpn(r.part);
