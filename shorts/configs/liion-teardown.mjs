// Li-ion charger teardown: the block -> the TP4056's discrete internals.
// The story beat: 4.2 V isn't firmware — it's a zener plus a Vbe, arithmetic cast in silicon.
// Render URL slug: "liion-charger?scenes=block,tp4056" (scene 0,1).
export default {
  slug: "liion-teardown",
  title: "How does it know to stop at 4.2 V?",
  script: "Your phone stops charging at exactly 4.2 volts. Every lithium battery does. How does the charger know? Let's open it up. Twelve parts. Two referees. This transistor passes the whole charge current. Referee one watches it through this tiny resistor — past point six volts of drop, it steals the drive. The current can't rise. Constant current. As the cell fills, its voltage climbs. Referee two: a 3.6 volt zener plus a transistor's point six — exactly 4.2. The moment the cell arrives, it robs the driver, and the current tapers to nothing. Constant voltage. No firmware. No magic. Arithmetic, cast in silicon. See inside every chip — free, in your browser. Link in comments.",
  ctaAnchor: "See inside every chip",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, zoomOut, sfx }) => {
    const cut1 = at("Twelve parts");
    return [
      // ---- scene 0: the charger block, assembling during the hook ----
      { from: 0.2, to: 1.4, tween: "symbolsShown", start: 0, end: 9 },
      { from: 0.8, to: at("How does"), tween: "wireProgress", start: 0, end: 14 },
      { from: at("How does"), to: cut1, set: { wireProgress: 14, symbolsShown: 9 } },
      ...zoomIn(at("Let's open it up"), "U1", 2.4),
      // ---- CUT into the chip ----
      { from: cut1, to: ctaT, set: { scene: 1, camK: 1, camU: 0, focus: "", title: "Inside the charger" } },
      { from: cut1, to: cut1 + 0.9, tween: "symbolsShown", start: 0, end: 18 },
      { from: cut1 + 0.3, to: at("This transistor"), tween: "wireProgress", start: 0, end: 22 },
      { from: at("This transistor"), to: ctaT, set: { wireProgress: 22, symbolsShown: 18 } },
      // the tour
      ...sfx(at("This transistor"), "pop"),
      { from: at("This transistor"), to: at("Referee one"), set: { highlight: "Q1" } },
      ...sfx(at("Referee one"), "pop"),
      { from: at("Referee one"), to: at("As the cell"), set: { highlight: "Q3,RS" } },
      // THE beat: the 4.2 V arithmetic
      { from: at("Referee two"), to: at("The moment"), set: { highlight: "D1,Q4" } },
      ...zoomIn(at("Referee two"), "D1", 2.1),
      ...zoomOut(at("The moment")),
      ...sfx(at("The moment"), "pop"),
      { from: at("The moment"), to: at("No firmware"), set: { highlight: "Q4" } },
      ...sfx(at("No firmware"), "thud"),
      { from: at("Arithmetic"), to: ctaT, set: { highlight: "Q1,Q2,Q3,Q4,Q5" } },
    ];
  },
};
