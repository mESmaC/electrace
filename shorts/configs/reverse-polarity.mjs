// Reverse-polarity protection: the P-FET that makes plugging power in backwards a non-event.
// Practical-format Friday slot. Same retention architecture: ~41 s, payoff ~35 s, CTA inside
// the median watch window. Render URL slug: "reverse-polarity-protection?scenes=block".
export default {
  slug: "reverse-polarity",
  title: "The transistor that survives backwards batteries",
  script: "Plug a battery in backwards and most boards die instantly. This one doesn't care. The secret is a single transistor. Here's the trick. A P-FET sits between the battery and everything else. Right way round, its gate gets pulled low and the channel turns on — power flows through with almost no loss. Backwards? The gate can never go low, the channel never forms, and the whole board is simply disconnected. Nothing conducts, nothing dies. No fuse to replace, no diode wasting half a volt of your battery — just a switch that refuses to make the mistake. One transistor, and backwards power becomes a non-event. Drawn in Electrace — free, in your browser. Link in comments.",
  ctaAnchor: "Drawn in Electrace",
  tailSeconds: 1.6,
  pronounce: { "P-FET": "P fet" },
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => [
    // assemble during the hook
    { from: 0.2, to: 1.4, tween: "symbolsShown", start: 0, end: 6 },
    { from: 0.8, to: at("Here's the trick"), tween: "wireProgress", start: 0, end: 6 },
    { from: at("Here's the trick"), to: ctaT, set: { wireProgress: 6, symbolsShown: 6 } },
    // the trick: the FET between battery and board
    ...zoomIn(at("A P-FET sits between"), "Q1", 1.5),
    { from: at("A P-FET sits between"), to: at("its gate gets pulled low"), set: { highlight: "Q1" } },
    // the gate chain makes the decision
    ...refocus(at("its gate gets pulled low"), "R1"),
    { from: at("its gate gets pulled low"), to: at("the channel turns on"), set: { highlight: "R1,D1" } },
    // backwards: back to the FET, the switch that refuses
    ...refocus(at("the channel turns on"), "Q1"),
    { from: at("the channel turns on"), to: at("One transistor"), set: { highlight: "Q1" } },
    // payoff
    ...zoomOut(at("One transistor")),
    ...sfx(at("a non-event"), "thud"),
    { from: at("One transistor"), to: ctaT, set: { highlight: "Q1" } },
  ],
};
