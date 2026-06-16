// Import a KiCad netlist (.net, the S-expression "version E" format that every KiCad export and most
// EDA toolchains emit) into a flat model Electrace can analyze. This is the universal, zero-friction
// path for "Explain this board" — paste a netlist, see findings — chosen over .kicad_sch precisely
// because requiring the native project file reintroduces the commitment friction the feature exists
// to remove (see EXPLAIN-THIS-BOARD.md).
//
// What a .net reliably carries: components (ref, value, footprint, fields) + nets (name + node pins).
// What it does NOT carry: pin electrical-types (Input/Output/Power) — those live in .kicad_sch. So the
// honest contract here is: connectivity is CERTAIN; anything about roles/voltages is INFERRED and must
// be labeled as such downstream. This parser only extracts what's truly in the file + a part-type
// guess from the value; it makes no electrical claims.

// ── S-expression reader (same shape as kicad-footprint.ts) ───────────────────────────────────────
type SNode = string | SNode[];

function tokenize(s: string): string[] {
  const toks: string[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "(" || c === ")") { toks.push(c); i++; }
    else if (c === '"') {
      let j = i + 1, str = "";
      while (j < s.length && s[j] !== '"') { if (s[j] === "\\") { str += s[j + 1] ?? ""; j += 2; } else { str += s[j]; j++; } }
      toks.push(str); i = j + 1;
    } else if (/\s/.test(c)) i++;
    else { let j = i; while (j < s.length && !/[\s()"]/.test(s[j])) j++; toks.push(s.slice(i, j)); i = j; }
  }
  return toks;
}

function parseSexpr(text: string): SNode | null {
  const toks = tokenize(text);
  let i = 0;
  const node = (): SNode => {
    if (toks[i] === "(") {
      i++;
      const list: SNode[] = [];
      while (i < toks.length && toks[i] !== ")") list.push(node());
      i++;
      return list;
    }
    return toks[i++];
  };
  while (i < toks.length && toks[i] !== "(") i++;
  return i < toks.length ? node() : null;
}

const isList = (n: SNode | null | undefined): n is SNode[] => Array.isArray(n);
const head = (n: SNode): string | null => (isList(n) && typeof n[0] === "string" ? n[0] : null);
const subs = (n: SNode[], h: string): SNode[][] => n.filter((c): c is SNode[] => isList(c) && c[0] === h);
const sub = (n: SNode[], h: string): SNode[] | null => subs(n, h)[0] ?? null;
/** the first bare string after the head, e.g. (value "10k") → "10k" */
const arg = (n: SNode[] | null): string | undefined => (n ? n.slice(1).find((x): x is string => typeof x === "string") : undefined);

// ── the import model ─────────────────────────────────────────────────────────────────────────────
export interface ImportedComponent {
  ref: string;            // "R1", "U2"
  value?: string;         // "10k", "buck-controller"
  footprint?: string;     // "C0805"
  type: string;           // guessed Electrace part type from value/ref (res, cap, ic, …) — see guessType
}
export interface ImportedNet {
  name: string;           // "+5V", "GND", "REG1/FB"
  nodes: { ref: string; pin: string }[];
}
export interface ImportedDesign {
  name: string;
  components: ImportedComponent[];
  nets: ImportedNet[];
  source: "kicad-net";
  warnings: string[];     // parse-quality notes (never throws on a messy file)
}

// Map a KiCad value/ref to an Electrace part TYPE. This is the only inference the PARSER does, and it's
// the safe kind — a refdes prefix (R/C/L/D/Q/U/J/Y) is a near-universal convention, and the value
// disambiguates a few. It makes NO electrical claim (no roles, no voltages). Unknowns stay "part".
function guessType(ref: string, value?: string): string {
  const v = (value ?? "").toLowerCase();
  const pfx = (ref.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();
  if (/\bled\b/.test(v)) return "led";
  if (/zener/.test(v)) return "zener";
  if (/tvs/.test(v)) return "tvs";
  if (/schottky/.test(v)) return "schottky";
  if (/p-?fet|pmos/.test(v)) return "pmos";
  if (/n-?fet|nmos/.test(v)) return "nmos";
  if (/pnp/.test(v)) return "pnp";
  if (/npn/.test(v)) return "npn";
  switch (pfx) {
    case "R": case "RV": case "RN": return "res";
    case "C": return /pol|elec|tant/.test(v) ? "cap-pol" : "cap";
    case "L": case "FB": return "inductor";
    case "D": return "diode";
    case "Q": return "bjt";
    case "U": case "IC": return "ic";
    case "J": case "P": case "CN": case "CON": return "connector";
    case "Y": case "X": return "crystal";
    case "SW": case "S": return "switch";
    case "F": return "fuse";
    case "BT": case "B": return "battery";
    case "T": return "transformer";
    default: return "part";
  }
}

/** Parse a KiCad .net netlist. Never throws — a malformed file yields whatever was readable plus a
 *  warning, so the import UI can always show *something* and say what it couldn't read. */
export function importKicadNet(text: string, fallbackName = "Imported design"): ImportedDesign {
  const warnings: string[] = [];
  const root = parseSexpr(text);
  if (!isList(root) || head(root) !== "export") {
    return { name: fallbackName, components: [], nets: [], source: "kicad-net", warnings: ["Not a recognizable KiCad netlist (expected an `(export …)` root). Export your schematic as a netlist (.net) in KiCad: File → Export → Netlist → KiCadXML/Legacy."] };
  }

  // design name from the source field, else fallback
  const design = sub(root, "design");
  const name = (design && arg(sub(design, "source"))?.replace(/\.(design\.json|net|kicad_sch|sch|kicad_pcb)$/i, "")) || fallbackName;

  // components
  const compsRoot = sub(root, "components");
  const components: ImportedComponent[] = [];
  if (compsRoot) {
    for (const comp of subs(compsRoot, "comp")) {
      const ref = arg(sub(comp, "ref"));
      if (!ref) continue;
      const value = arg(sub(comp, "value"));
      const footprint = arg(sub(comp, "footprint"));
      components.push({ ref, value, footprint, type: guessType(ref, value) });
    }
  } else warnings.push("No (components …) section found.");

  // nets
  const netsRoot = sub(root, "nets");
  const nets: ImportedNet[] = [];
  if (netsRoot) {
    for (const net of subs(netsRoot, "net")) {
      const nm = arg(sub(net, "name")) ?? arg(sub(net, "code")) ?? `N${nets.length + 1}`;
      const nodes: { ref: string; pin: string }[] = [];
      for (const node of subs(net, "node")) {
        const ref = arg(sub(node, "ref")); const pin = arg(sub(node, "pin"));
        if (ref && pin != null) nodes.push({ ref, pin });
      }
      if (nodes.length) nets.push({ name: nm, nodes });
    }
  } else warnings.push("No (nets …) section found — connectivity can't be analyzed.");

  if (!components.length && !nets.length) warnings.push("Nothing readable in this file.");
  return { name, components, nets, source: "kicad-net", warnings };
}
