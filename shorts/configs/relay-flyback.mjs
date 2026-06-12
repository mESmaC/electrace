// Flyback diode: the relay coil's inductive kick and the one backwards diode that eats it.
// Practical-format slot in the Friday batch (the battery video's lane). Same retention
// architecture as comparator-hysteresis: ~40 s, single concept, payoff ~33 s = ~75% mark,
// CTA inside the median watch window. Render URL slug: "relay-driver?scenes=block".
export default {
  slug: "relay-flyback",
  title: "Why relays kill microcontrollers",
  script: "This relay circuit works perfectly — and the moment it switches off, it can kill your microcontroller. Here's the trap. A relay coil is an inductor. It stores energy in a magnetic field, and when the transistor cuts the current, that energy refuses to vanish. The coil slams its voltage up — hundreds of volts — hunting for a path. This diode is the path. Pointed backwards, it does nothing while the relay runs. The instant the coil kicks, it catches the whole spike and loops it back through the coil until the energy dies out. One backwards diode. Hundreds of volts, gone. Drawn in Electrace — free, in your browser. Link in comments.",
  ctaAnchor: "Drawn in Electrace",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => [
    // assemble during the hook
    { from: 0.2, to: 1.4, tween: "symbolsShown", start: 0, end: 7 },
    { from: 0.8, to: at("Here's the trap"), tween: "wireProgress", start: 0, end: 6 },
    { from: at("Here's the trap"), to: ctaT, set: { wireProgress: 6, symbolsShown: 7 } },
    // the trap: the transistor that cuts the current
    ...zoomIn(at("A relay coil is an inductor"), "Q1", 1.5),
    { from: at("when the transistor cuts"), to: at("This diode"), set: { highlight: "Q1" } },
    // THE beat: the diode is the path
    ...refocus(at("This diode is the path"), "D1"),
    { from: at("This diode is the path"), to: at("One backwards diode"), set: { highlight: "D1" } },
    ...sfx(at("The instant the coil kicks"), "pop"),
    // payoff: pull back to the whole circuit
    ...zoomOut(at("One backwards diode")),
    ...sfx(at("Hundreds of volts, gone"), "thud"),
    { from: at("One backwards diode"), to: ctaT, set: { highlight: "D1" } },
  ],
};
