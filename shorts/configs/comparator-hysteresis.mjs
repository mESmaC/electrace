// Comparator hysteresis: why a bare comparator chatters at the threshold, and how one
// feedback resistor (R3) fixes it. Sequel to the op-amp short (its winning beat was
// "comparator vs op-amp"). Architecture per the retention data: ~41 s total, single
// concept, payoff lands ~33 s, CTA INSIDE the median watch window, nothing taught
// after the reveal. Render URL slug: "comparator-hysteresis?scenes=block" (one scene).
export default {
  slug: "comparator-hysteresis",
  title: "Why your comparator chatters",
  script: "Your comparator works perfectly on the bench. Then the real world hits it, and the output chatters like mad. Here's why. A comparator flips at one exact voltage. But real signals are noisy — near the threshold, they cross the line dozens of times. Every crossing flips the output. The fix is one resistor. It feeds a little of the output back to the plus input. The instant the output flips, the threshold itself moves — away from the signal. To flip back, the input has to cross the entire gap. Noise can't make that jump. That gap is called hysteresis. Same chip, two thresholds, zero chatter. Drawn in Electrace — free, in your browser. Link in comments.",
  ctaAnchor: "Drawn in Electrace",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => [
    // assemble during the hook — full schematic visible by "Here's why"
    { from: 0.2, to: 1.6, tween: "symbolsShown", start: 0, end: 10 },
    { from: 0.8, to: at("Here's why"), tween: "wireProgress", start: 0, end: 13 },
    { from: at("Here's why"), to: ctaT, set: { wireProgress: 13, symbolsShown: 10 } },
    // the problem: one exact threshold — spotlight the chip and its reference divider
    ...zoomIn(at("A comparator flips"), "U1", 1.55),
    { from: at("A comparator flips"), to: at("The fix"), set: { highlight: "U1,R1,R2" } },
    // THE beat: one resistor — snap focus to R3, the feedback loop
    ...refocus(at("The fix is one resistor"), "R3"),
    { from: at("The fix is one resistor"), to: at("That gap"), set: { highlight: "R3" } },
    // the mechanism: the threshold itself moves — bring the divider back into the story
    ...sfx(at("the threshold itself moves"), "pop"),
    { from: at("the threshold itself moves"), to: at("To flip back"), set: { highlight: "R3,R1,R2" } },
    { from: at("To flip back"), to: at("That gap"), set: { highlight: "R3,Rin" } },
    // payoff: pull back to the whole circuit
    ...zoomOut(at("That gap is called hysteresis")),
    ...sfx(at("Same chip"), "thud"),
    { from: at("Same chip"), to: ctaT, set: { highlight: "R3" } },
  ],
};
