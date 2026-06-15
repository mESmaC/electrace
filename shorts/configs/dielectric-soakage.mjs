// Dielectric soakage: "this capacitor recharges itself." The deep-cuts / haunted lane — the
// spookiest bench demo in electronics. Block: dielectric-soakage (charge → R1 → C1 + shorting
// switch → ground). Retention architecture: ~43 s, single concept, payoff ~80% mark, CTA inside
// the median watch window. Render slug: "dielectric-soakage".
export default {
  slug: "dielectric-soakage",
  title: "This capacitor recharges itself",
  script: "Charge up a big capacitor. Now short it out — a wire straight across it. The voltmeter drops to zero. It's dead. Take the wire off, walk away, come back: the voltage has climbed back on its own. Nothing's connected. It charged itself from nothing. This isn't a trick — it's dielectric soakage. A capacitor's insulator isn't perfect. Most of the charge sits on the plates and dumps the instant you short it. But some soaks deep into the material, into slow molecules that take minutes to let go. The short empties the plates — not the soak. Seconds later that hidden charge leaks back out, and the voltage returns. It's real energy you couldn't reach. It's why big capacitors ship with a shorting strap — and why a powered-off microwave can still bite you. Build it free in Electrace — link in comments.",
  ctaAnchor: "Build it free",
  tailSeconds: 1.6,
  pronounce: { "C1": "C one", "R1": "R one" },
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => {
    return [
      // assemble during the hook — the whole demo is up by "Now short it out"
      { from: 0.2, to: 1.6, tween: "symbolsShown", start: 0, end: 6 },
      { from: 0.8, to: at("Now short it out"), tween: "wireProgress", start: 0, end: 6 },
      { from: at("Now short it out"), to: ctaT, set: { wireProgress: 6, symbolsShown: 6 } },
      // charge the cap — zoom C1
      ...zoomIn(at("Charge up a big"), "C1", 1.6),
      { from: at("Charge up a big"), to: at("Now short it out"), set: { highlight: "C1" } },
      // short it dead — focus the switch, thud on "It's dead"
      ...refocus(at("Now short it out"), "SW1"),
      ...sfx(at("It's dead"), "thud"),
      { from: at("Now short it out"), to: at("Take the wire off"), set: { highlight: "SW1" } },
      // the reveal: voltage climbs back — pull focus back to C1
      ...refocus(at("Take the wire off"), "C1"),
      ...sfx(at("on its own"), "pop"),
      { from: at("Take the wire off"), to: at("This isn't a trick"), set: { highlight: "C1" } },
      // explain: pull back to the whole circuit for the mechanism
      ...zoomOut(at("This isn't a trick")),
      { from: at("This isn't a trick"), to: at("The short empties"), set: { highlight: "" } },
      { from: at("The short empties"), to: at("Seconds later"), set: { highlight: "SW1,C1" } },
      // payoff: the danger line — settle on the cap
      ...zoomIn(at("Seconds later"), "C1", 1.5),
      ...sfx(at("the voltage returns"), "thud"),
      { from: at("Seconds later"), to: ctaT, set: { highlight: "C1" } },
    ];
  },
};
