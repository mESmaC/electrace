// RF field detector: "your ADC is secretly a radio." The "secretly Y" sensor lane — the direct
// sequel to the LED color-sensor short. HONEST framing: an ADC can't sample 2.4 GHz (Nyquist),
// but one Schottky + an RC in front turns any ADC pin into a field-strength meter. Same retention
// architecture: ~40 s, single concept, payoff ~80% mark, CTA inside the median watch window.
// Block: rf-field-detector (antenna → Schottky → RC → ADC pin). Render slug: "rf-field-detector".
export default {
  slug: "rf-field-detector",
  title: "Your ADC is secretly a radio",
  script: "Your microcontroller's analog pin can't read Wi-Fi — digitizing a 2.4 gigahertz wave needs five billion samples a second, and no ADC is that fast. Yet three cheap parts let that same pin feel the Wi-Fi in the room. The trick: don't read the signal. Just measure how much of it is there. Start with a wire — an antenna. Near any transmitter, a few millivolts of radio ride onto it. Then a Schottky diode, fast enough to chop those gigahertz waves in half where a normal diode can't. A capacitor catches the peaks and smooths them; a resistor bleeds it down. What's left is a DC level that tracks the field strength — and your ADC reads that all day. Point a phone at it, hit send: the number jumps. You built a radio from a wire and a diode. Build it free in Electrace — link in comments.",
  ctaAnchor: "Build it free",
  tailSeconds: 1.6,
  pronounce: { "ADC": "A-D-C", "2.4 gigahertz": "two point four gigahertz", "DC": "D-C", "Wi-Fi": "WiFi" },
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => {
    return [
      // assemble during the hook — the whole detector is on screen by "Start with a wire"
      { from: 0.2, to: 1.8, tween: "symbolsShown", start: 0, end: 6 },
      { from: 1.0, to: at("Start with a wire"), tween: "wireProgress", start: 0, end: 6 },
      { from: at("Start with a wire"), to: ctaT, set: { wireProgress: 6, symbolsShown: 6 } },
      // the build walk: antenna → diode → cap+resistor, each highlighted as it's named
      ...zoomIn(at("Start with a wire"), "ANT1", 1.7),
      { from: at("Start with a wire"), to: at("Then a Schottky"), set: { highlight: "ANT1" } },
      ...refocus(at("Then a Schottky"), "D1"),
      { from: at("Then a Schottky"), to: at("A capacitor catches"), set: { highlight: "D1" } },
      ...refocus(at("A capacitor catches"), "C1"),
      ...sfx(at("smooths them"), "pop"),
      { from: at("A capacitor catches"), to: at("a resistor bleeds"), set: { highlight: "C1" } },
      { from: at("a resistor bleeds"), to: at("What's left"), set: { highlight: "C1,R1" } },
      // payoff: pull back to the whole detector — "a DC level your ADC can read"
      ...zoomOut(at("What's left")),
      { from: at("What's left"), to: at("Point a phone"), set: { highlight: "" } },
      // the demo beat: phone transmits, number jumps — thud on the reveal
      ...sfx(at("the number jumps"), "thud"),
      { from: at("Point a phone"), to: ctaT, set: { highlight: "ANT1,D1,C1,R1" } },
    ];
  },
};
