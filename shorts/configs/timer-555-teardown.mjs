// The flagship teardown: 555 block -> the chip's discrete internals -> the comparator's internals.
// Render URL slug: "timer-555?scenes=block,ne555,comparator" (scene 0,1,2).
export default {
  slug: "timer-555-teardown",
  title: "What's inside a 555 timer?",
  script: "This chip is fifty years old, and it's in everything. So what's actually inside a 555 timer? Let's open it up. Nineteen parts. No magic. These three 5k resistors — that's where the name comes from — split the supply into two reference voltages. Two comparators watch your capacitor against those references. This latch remembers which one fired last. And this transistor drains the capacitor to start the cycle over. Charge, trip, discharge, repeat — that's a 555. But wait. Those comparators open up too. Two transistors sharing one current, racing. Whichever input is higher steals the current — that's the entire decision. It's not magic. It was never magic. It's transistors all the way down. See inside every chip — free, in your browser. Link in comments.",
  ctaAnchor: "See inside every chip",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, sfx }) => {
    const cut1 = at("Nineteen parts");
    const cut2 = at("Two transistors");
    return [
      // ---- scene 0: the 555 block, assembling during the hook ----
      { from: 0.2, to: 1.6, tween: "symbolsShown", start: 0, end: 8 },
      { from: 0.8, to: at("So what's actually"), tween: "wireProgress", start: 0, end: 13 },
      { from: at("So what's actually"), to: cut1, set: { wireProgress: 13, symbolsShown: 8 } },
      ...zoomIn(at("Let's open it up"), "U1", 2.4),
      // ---- CUT into the chip ----
      { from: cut1, to: ctaT, set: { scene: 1, camK: 1, camU: 0, focus: "" } },
      { from: cut1, to: cut1 + 0.9, tween: "symbolsShown", start: 0, end: 15 },
      { from: cut1 + 0.3, to: at("These three 5k"), tween: "wireProgress", start: 0, end: 16 },
      { from: at("These three 5k"), to: cut2, set: { wireProgress: 16, symbolsShown: 15 } },
      { from: cut1, to: ctaT, set: { title: "Inside the 555" } },
      // the tour, spotlit phrase by phrase
      ...sfx(at("These three 5k"), "pop"),
      { from: at("These three 5k"), to: at("Two comparators"), set: { highlight: "R1,R2,R3" } },
      ...sfx(at("Two comparators"), "pop"),
      { from: at("Two comparators"), to: at("This latch"), set: { highlight: "U1,U2" } },
      ...sfx(at("This latch"), "pop"),
      { from: at("This latch"), to: at("And this transistor"), set: { highlight: "L1" } },
      ...sfx(at("And this transistor"), "pop"),
      { from: at("And this transistor"), to: at("Charge, trip"), set: { highlight: "Q1" } },
      ...zoomIn(at("Those comparators open"), "U1", 2.4),
      // ---- CUT into the comparator ----
      { from: cut2, to: ctaT, set: { scene: 2, camK: 1, camU: 0, focus: "", title: "Inside the comparator" } },
      { from: cut2, to: cut2 + 0.7, tween: "symbolsShown", start: 0, end: 10 },
      { from: cut2 + 0.2, to: at("Whichever input"), tween: "wireProgress", start: 0, end: 10 },
      { from: at("Whichever input"), to: ctaT, set: { wireProgress: 10, symbolsShown: 10 } },
      ...sfx(at("Two transistors sharing"), "pop"),
      { from: at("Two transistors sharing"), to: at("that's the entire decision"), set: { highlight: "Q1,Q2" } },
      ...sfx(at("It's not magic"), "thud"),
      { from: at("It's transistors all"), to: ctaT, set: { highlight: "Q1,Q2" } },
    ];
  },
};
