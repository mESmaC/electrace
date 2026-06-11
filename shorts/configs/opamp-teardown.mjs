// Op-amp teardown: the noninverting-amp block -> the op-amp's discrete internals.
// The story beat: the Miller cap IS the difference between an op-amp and a comparator.
// Render URL slug: "opamp-noninverting?scenes=block,opamp" (scene 0,1).
export default {
  slug: "opamp-teardown",
  title: "What's inside an op-amp?",
  script: "This little chip is an op-amp. It's in almost every analog circuit ever built. And inside? Three tricks, stacked. Let's open it up. Twelve parts. Trick one: two matched transistors share one current. Whichever input is higher steals more — the pair literally weighs your inputs against each other. Trick two: a current mirror. It copies one side onto the other, so the tiniest imbalance gets doubled and pushed forward. Trick three: one transistor blows that whisper up to the full supply swing. And this tiny capacitor is the whole secret. Without it, this circuit is a comparator. With it, the amplifier stays stable — feedback you can trust. A push-pull pair muscles the result out. No magic. Just transistors. See inside every chip — free, in your browser. Link in comments.",
  ctaAnchor: "See inside every chip",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, zoomOut, sfx }) => {
    const cut1 = at("Twelve parts");
    return [
      // ---- scene 0: the noninverting-amp block, assembling during the hook ----
      { from: 0.2, to: 1.4, tween: "symbolsShown", start: 0, end: 7 },
      { from: 0.8, to: at("And inside"), tween: "wireProgress", start: 0, end: 8 },
      { from: at("And inside"), to: cut1, set: { wireProgress: 8, symbolsShown: 7 } },
      ...zoomIn(at("Let's open it up"), "U1", 2.4),
      // ---- CUT into the chip ----
      { from: cut1, to: ctaT, set: { scene: 1, camK: 1, camU: 0, focus: "", title: "Inside the op-amp" } },
      { from: cut1, to: cut1 + 0.9, tween: "symbolsShown", start: 0, end: 17 },
      { from: cut1 + 0.3, to: at("Trick one"), tween: "wireProgress", start: 0, end: 25 },
      { from: at("Trick one"), to: ctaT, set: { wireProgress: 25, symbolsShown: 17 } },
      // the three tricks, spotlit
      ...sfx(at("Trick one"), "pop"),
      { from: at("Trick one"), to: at("Trick two"), set: { highlight: "Q1,Q2" } },
      ...sfx(at("Trick two"), "pop"),
      { from: at("Trick two"), to: at("Trick three"), set: { highlight: "Q3,Q4" } },
      ...sfx(at("Trick three"), "pop"),
      { from: at("Trick three"), to: at("And this tiny capacitor"), set: { highlight: "Q5,RC" } },
      // THE beat: zoom to the Miller cap — the entire op-amp-vs-comparator difference
      { from: at("And this tiny capacitor"), to: at("A push-pull"), set: { highlight: "CC" } },
      ...zoomIn(at("And this tiny capacitor"), "CC", 2.1),
      ...zoomOut(at("A push-pull")),
      ...sfx(at("A push-pull"), "pop"),
      { from: at("A push-pull"), to: at("No magic"), set: { highlight: "Q6,Q7" } },
      ...sfx(at("No magic"), "thud"),
      { from: at("Just transistors"), to: ctaT, set: { highlight: "Q1,Q2,Q3,Q4,Q5,Q6,Q7" } },
    ];
  },
};
