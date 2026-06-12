// TL431 teardown: the most-manufactured chip nobody's heard of — zener + amp + transistor.
// Deep-technical Friday slot (the op-amp winner's lane). ~43 s, payoff ~35 s, CTA inside
// the median watch window. Render URL slug: "tl431-reference?scenes=block,tl431".
export default {
  slug: "tl431-teardown",
  title: "The most-made chip you've never heard of",
  script: "This is one of the most manufactured chips in history — billions every year — and you've probably never heard of it. It's called the TL431, and it hides inside almost every phone charger ever made. Its job: be exactly two and a half volts, no matter what. Crack it open and it's three tricks. A reference that refuses to drift. An amplifier, comparing your voltage against that reference. And a transistor that bleeds current away until the two agree. It doesn't just measure your voltage — it pushes back. That pushback is what holds your charger at exactly five volts while the wall voltage swings. Three cents of silicon, regulating everything you own. Drawn in Electrace — free, in your browser. Link in comments.",
  ctaAnchor: "Drawn in Electrace",
  tailSeconds: 1.6,
  pronounce: { "TL431": "T L four three one" },
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => {
    const cut1 = at("Crack it open");
    return [
      // ---- scene 0: the block in its simplest job, assembling during the hook ----
      { from: 0.2, to: 1.4, tween: "symbolsShown", start: 0, end: 5 },
      { from: 0.8, to: at("It's called"), tween: "wireProgress", start: 0, end: 5 },
      { from: at("It's called"), to: cut1, set: { wireProgress: 5, symbolsShown: 5 } },
      // ---- CUT inside ----
      { from: cut1, to: ctaT, set: { scene: 1, camK: 1, camU: 0, focus: "", title: "Inside the TL431" } },
      { from: cut1, to: cut1 + 0.9, tween: "symbolsShown", start: 0, end: 12 },
      { from: cut1 + 0.3, to: at("A reference"), tween: "wireProgress", start: 0, end: 14 },
      { from: at("A reference"), to: ctaT, set: { wireProgress: 14, symbolsShown: 12 } },
      // the three tricks
      ...zoomIn(at("A reference that refuses"), "D1", 1.5),
      { from: at("A reference that refuses"), to: at("An amplifier"), set: { highlight: "D1" } },
      ...refocus(at("An amplifier"), "U2"),
      { from: at("An amplifier"), to: at("And a transistor"), set: { highlight: "U2" } },
      ...refocus(at("And a transistor"), "Q1"),
      { from: at("And a transistor"), to: at("It doesn't just measure"), set: { highlight: "Q1" } },
      // pull back: the whole loop pushes back
      ...zoomOut(at("It doesn't just measure")),
      ...sfx(at("it pushes back"), "thud"),
      { from: at("It doesn't just measure"), to: ctaT, set: { highlight: "D1,U2,Q1" } },
    ];
  },
};
