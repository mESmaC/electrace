// Comparison-page data ("Electrace vs X"). Tone rules: scrupulously honest — every competitor
// gets a real "when it's the better choice" section, their strengths stated plainly, and our
// gaps admitted (no simulation, no breadboard view, young product). Trash-talk reads as FUD to
// engineers and kills conversion; honest comparisons earn the click AND the trust.

export interface Comparison {
  slug: string;
  name: string;                 // their product name
  title: string;                // SEO title
  tagline: string;              // one-line framing
  what: string;                 // what THEY are, fairly described
  theirStrengths: string[];     // stated plainly
  whenThem: string;             // when X is the better choice (honest)
  whenUs: string;               // when Electrace is the better choice
  rows: { feature: string; us: string; them: string }[];
  faq: { q: string; a: string }[];
  verdict: string;
}

const SHARED_ROWS = {
  explain: "Every block carries its schematic, per-part reasoning, and failure modes",
  checks: "Deterministic electrical checks on declared specs — open nets, over-voltage, current budgets, polarity — as you draw",
  ai: "AI assistant that builds and wires real, BOM-backed subcircuits",
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "fritzing",
    name: "Fritzing",
    title: "Electrace vs Fritzing — which circuit design tool should you use?",
    tagline: "Breadboard pictures vs schematics that explain themselves.",
    what: "Fritzing is the classic maker tool for drawing breadboard-realistic wiring diagrams — the pictures you see in thousands of Arduino tutorials. It also has schematic and PCB views, and a large community parts library.",
    theirStrengths: [
      "Breadboard view — photorealistic wiring pictures, perfect for tutorials and documentation",
      "Huge community parts library of hobbyist modules and dev boards",
      "Long-established: enormous amount of existing content uses it",
    ],
    whenThem: "If your goal is a breadboard illustration for a tutorial, a classroom handout, or documentation of a physical prototype, Fritzing's breadboard view is still the best tool for that exact job — Electrace doesn't draw breadboards.",
    whenUs: "If your goal is to UNDERSTAND the circuit and get it checked — not just picture the wires — Electrace is built for exactly that: blocks that explain what they do and why each part is there, live electrical checks Fritzing doesn't attempt, an automatic BOM, and a real netlist/PCB path that exports to KiCad. Fritzing's development has also been famously sporadic, and the download is paywalled; Electrace runs free in the browser.",
    rows: [
      { feature: "Runs in the browser, no install", us: "Yes — free", them: "Desktop download (small fee)" },
      { feature: "Breadboard illustration view", us: "No", them: "Yes — its signature feature" },
      { feature: "Self-explaining design", us: SHARED_ROWS.explain, them: "Parts are graphics; no reasoning attached" },
      { feature: "Electrical checking", us: SHARED_ROWS.checks, them: "None — wiring errors aren't flagged" },
      { feature: "AI assistant", us: SHARED_ROWS.ai, them: "None" },
      { feature: "BOM", us: "Automatic, with buy links", them: "Parts list export" },
      { feature: "PCB", us: "Placement, routing, DRC, KiCad/Gerber path", them: "Basic PCB view with fab service" },
      { feature: "Active development", us: "Continuous", them: "Historically sporadic" },
    ],
    faq: [
      { q: "Can Electrace draw breadboard diagrams like Fritzing?", a: "No — Electrace draws real schematics, organized as self-explaining functional blocks. If you need a breadboard illustration for a tutorial, Fritzing remains the right tool for that; many people use both." },
      { q: "Is Electrace free like Fritzing?", a: "Electrace's whole understand-loop is free in the browser, forever — blocks, explanations, electrical checks, BOM, up to 10 designs. Fritzing asks for a small fee to download." },
      { q: "Does Electrace check my circuit?", a: "Yes — deterministically, against declared specs: open nets, over-voltage, current budgets, polarity conflicts, missing pull-ups. Fritzing draws what you tell it without checking it." },
    ],
    verdict: "Fritzing pictures the wiring; Electrace explains and checks the circuit. For tutorials and breadboard documentation, keep Fritzing. For actually understanding and verifying a design — then taking it to a real board — Electrace.",
  },
  {
    slug: "tinkercad",
    name: "Tinkercad Circuits",
    title: "Electrace vs Tinkercad Circuits — beyond the classroom",
    tagline: "The classroom sandbox vs the tool you graduate to.",
    what: "Tinkercad Circuits is Autodesk's free in-browser electronics sandbox: drag virtual parts onto a virtual breadboard, simulate them, and even run code on a virtual Arduino. It's the default first-touch tool in schools.",
    theirStrengths: [
      "Live simulation — watch the virtual LED actually blink, with a virtual Arduino running real code",
      "Zero-setup and genuinely beginner-proof; ideal for classrooms",
      "Free, from Autodesk, with classroom management built in",
    ],
    whenThem: "For a first-ever contact with electronics — especially a classroom of 12-year-olds who need to see an LED blink in 30 seconds — Tinkercad's simulation sandbox is unbeatable, and Electrace doesn't simulate.",
    whenUs: "The moment you want to build something REAL, Tinkercad has no next step: no real schematic, no BOM you can order, no PCB, no export. Electrace is the graduation path — still in the browser, still beginner-friendly, but with real schematics that explain themselves, electrical checks against real specs, an orderable BOM, a PCB editor, and KiCad export when you outgrow even that.",
    rows: [
      { feature: "Live simulation (virtual Arduino)", us: "No — deterministic spec checks instead", them: "Yes — its signature feature" },
      { feature: "Real schematic output", us: "Yes — block-organized, exportable", them: "Breadboard view only, effectively" },
      { feature: "Self-explaining design", us: SHARED_ROWS.explain, them: "Parts are simulated, not explained" },
      { feature: "Path to real hardware", us: "BOM with buy links, PCB editor, Gerber/KiCad export", them: "None — designs stay in the sandbox" },
      { feature: "Electrical checking", us: SHARED_ROWS.checks, them: "Simulation shows symptoms, doesn't name causes" },
      { feature: "AI assistant", us: SHARED_ROWS.ai, them: "None" },
      { feature: "Grows with you", us: "Hobby → shipping real boards", them: "Ceiling is the sandbox" },
    ],
    faq: [
      { q: "Does Electrace simulate circuits like Tinkercad?", a: "No — deliberately. Electrace checks your design against declared specs deterministically (over-voltage, current budgets, open nets) and explains the reasoning. Simulation shows you THAT the LED doesn't light; Electrace tells you WHY the rail is over-budget." },
      { q: "Is Electrace too hard after Tinkercad?", a: "It's designed as the graduation step: blocks explain themselves in plain language, the checker catches mistakes with reasons, and the AI assistant can build and wire subcircuits for you to study." },
      { q: "Can I order what I design?", a: "Yes — every design has an automatic BOM with distributor links, and the PCB side exports manufacturing files. That's the part Tinkercad can't do at all." },
    ],
    verdict: "Tinkercad is the best first 30 minutes in electronics. Electrace is everything after: real schematics, real checks, real parts, a real board — with the explanations still attached.",
  },
  {
    slug: "easyeda",
    name: "EasyEDA",
    title: "Electrace vs EasyEDA — explanation-first vs fab-first design",
    tagline: "Understanding your circuit vs ordering it fast.",
    what: "EasyEDA is a capable, free, browser-based EDA suite tightly integrated with JLCPCB's fabrication and LCSC's parts catalog — schematic capture, simulation, PCB layout, and one-click ordering.",
    theirStrengths: [
      "Genuinely capable free EDA — schematic, PCB, huge LCSC parts library",
      "The JLCPCB pipeline: design-to-ordered-board friction is famously low",
      "Mature: years of development, large user base, lots of tutorials",
    ],
    whenThem: "If you already know exactly what you're building and want the cheapest, fastest path to fabricated boards through JLCPCB, EasyEDA's vertical integration is excellent and Electrace doesn't compete with that pipeline today.",
    whenUs: "EasyEDA assumes you already understand your circuit — it's a drafting and ordering tool. Electrace is for the stage before and during: blocks that carry their reasoning, deterministic checks that catch mistakes a netlist won't, spec-search ('18V → 5V at 3A') instead of part-number archaeology, and an AI assistant grounded in declared data. It's also vendor-neutral — your BOM links to distributors, but nothing about the tool is built to funnel you to one fab's catalog.",
    rows: [
      { feature: "Free, in the browser", us: "Yes", them: "Yes" },
      { feature: "Self-explaining design", us: SHARED_ROWS.explain, them: "Conventional symbols and nets" },
      { feature: "Electrical checking", us: SHARED_ROWS.checks, them: "Conventional ERC (pin-type rules), plus simulation" },
      { feature: "Find parts by need", us: "Spec-search: '18V → 5V at 3A' returns blocks that can do it", them: "Search the LCSC catalog by part number/keyword" },
      { feature: "AI assistant", us: SHARED_ROWS.ai, them: "None" },
      { feature: "Vendor neutrality", us: "Neutral — distributor-agnostic BOM links", them: "Built around the JLCPCB/LCSC ecosystem" },
      { feature: "Fab integration", us: "Export: Gerber, KiCad, BOM/CPL — order anywhere", them: "One-click JLCPCB ordering — its signature strength" },
      { feature: "Simulation", us: "No", them: "Yes (SPICE-based)" },
    ],
    faq: [
      { q: "Can Electrace replace EasyEDA for ordering boards?", a: "Electrace exports standard manufacturing files (Gerber, BOM, pick-and-place) you can send to any fab — but it doesn't have EasyEDA's one-click JLCPCB pipeline. If instant JLC ordering is your priority, that's EasyEDA's home turf." },
      { q: "Why no simulation?", a: "Different philosophy: Electrace checks declared specs deterministically and explains failures in plain language. It's faster than setting up a simulation and catches the structural mistakes that actually bite beginners — but if you need waveform-level analysis, use a simulator alongside." },
      { q: "Is my design locked in?", a: "No — KiCad netlist and PCB export are built in, and the BOM is distributor-agnostic. Leaving Electrace cleanly is a feature, not an afterthought." },
    ],
    verdict: "EasyEDA optimizes the path from finished design to fabricated board. Electrace optimizes the path from idea to UNDERSTOOD design — then exports cleanly to whatever fab pipeline you like.",
  },
  {
    slug: "kicad",
    name: "KiCad",
    title: "Electrace + KiCad — the on-ramp to the open-source standard",
    tagline: "Not a replacement. The on-ramp.",
    what: "KiCad is the open-source standard for serious PCB design — professional-grade schematic capture, simulation, and board layout used for everything from hobby boards to commercial products. It's free, powerful, and has earned its reputation.",
    theirStrengths: [
      "Professional depth: multi-sheet schematics, simulation, length-matching, 3D view, scripting",
      "The open-source standard — files, libraries, and community knowledge everywhere",
      "Free forever, no vendor agenda",
    ],
    whenThem: "For final board layout on anything serious — tight analog, RF, high-speed digital, production designs — KiCad (or a commercial suite) is the right destination, and Electrace deliberately EXPORTS to it rather than competing with it.",
    whenUs: "KiCad's depth comes with a famous learning curve, and it offers no guidance: a buck converter in KiCad is a pile of symbols only YOU know is a buck converter. Electrace is the stage before: sketch the system as self-explaining blocks, let deterministic checks catch the structural mistakes, get a sane first-pass schematic/BOM/board — then export the netlist or .kicad_pcb and finish in KiCad with its full power. They're complements, and we built the export path on purpose.",
    rows: [
      { feature: "Intended role", us: "Intent → understood, checked design", them: "Full professional EDA depth" },
      { feature: "Learning curve", us: "Minutes — blocks explain themselves", them: "Famously steep" },
      { feature: "Self-explaining design", us: SHARED_ROWS.explain, them: "Symbols and nets; intent lives in your head" },
      { feature: "Electrical checking", us: SHARED_ROWS.checks, them: "ERC (pin-type rules) + optional SPICE simulation" },
      { feature: "AI assistant", us: SHARED_ROWS.ai, them: "None built in" },
      { feature: "PCB depth", us: "Placement, routing, vias, DRC — first-pass boards", them: "Professional: length matching, zones, 3D, scripting" },
      { feature: "Works together", us: "Exports KiCad netlist + .kicad_pcb; imports .kicad_mod footprints", them: "Opens what Electrace exports" },
    ],
    faq: [
      { q: "Is Electrace trying to replace KiCad?", a: "No. Electrace is the on-ramp: design and understand the system as blocks, catch structural mistakes early, then export to KiCad for final-polish layout. The KiCad export path is a core feature, not an escape hatch." },
      { q: "What does Electrace export?", a: "KiCad netlists (.net) from the schematic side, KiCad PCB files (.kicad_pcb) from the board side, plus BOM/CSV — and it imports KiCad footprints (.kicad_mod) for real land patterns." },
      { q: "Who should start in Electrace instead of KiCad?", a: "Anyone who wants to understand the circuit, not just draft it: learners, firmware engineers who also make boards, and anyone tired of redoing power-tree boilerplate. KiCad veterans use Electrace as the fast, checked first pass." },
    ],
    verdict: "Use both. Electrace gets you from idea to a checked, explained, BOM-backed design in minutes; KiCad takes that design to production depth. The export button is the whole point.",
  },
];

export const comparisonBySlug = (slug: string) => COMPARISONS.find((c) => c.slug === slug);
