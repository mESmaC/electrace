// LED color sensor: every LED is secretly a wavelength-selective photodiode. The "secretly Y"
// format (op-amp lane). Same retention architecture as the others: ~40 s, single concept,
// payoff ~30 s = ~75% mark, CTA inside the median watch window. The block + glossary already
// ship (led-color-sensor / photovoltaic-mode); this is the Short that demos them.
// Render URL slug: "led-color-sensor?scenes=block".
export default {
  slug: "led-color-sensor",
  title: "Every LED is secretly a light sensor",
  script: "An LED makes light. Run it backwards, and it does something nobody tells you: it detects light. Here's the secret. A lit LED is a junction turning current into photons. Reverse it, and the same junction turns photons into current — a photodiode wearing a costume. And the strange part: each LED mostly sees its own color. A red one is nearly blind to blue. So point three LEDs at a surface — red, green, blue — and the three readings are a color fingerprint. No sensor chip, not even an analog pin: charge each LED backwards, time how fast the light drains it. Three diodes. That's your color sensor. Build it free in Electrace — link in comments.",
  ctaAnchor: "Build it free",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT, zoomIn, zoomOut, refocus, sfx }) => [
    // assemble during the hook — three channels appear by "Here's the secret"
    { from: 0.2, to: 1.6, tween: "symbolsShown", start: 0, end: 10 },
    { from: 0.8, to: at("Here's the secret"), tween: "wireProgress", start: 0, end: 9 },
    { from: at("Here's the secret"), to: ctaT, set: { wireProgress: 9, symbolsShown: 10 } },
    // the reveal: the junction itself — zoom the red channel as "photodiode wearing a costume"
    ...zoomIn(at("A lit LED is a junction"), "D1", 1.7),
    { from: at("Reverse it"), to: at("And the strange part"), set: { highlight: "D1" } },
    // the strange part: each LED sees its own color — light all three channels
    ...zoomOut(at("And the strange part")),
    ...sfx(at("each LED mostly sees its own color"), "pop"),
    { from: at("So point three LEDs"), to: at("No sensor chip"), set: { highlight: "D1,D2,D3" } },
    // the trick: no ADC, just timing — settle on one channel
    ...refocus(at("charge each LED backwards"), "D1"),
    ...sfx(at("time how fast"), "pop"),
    // payoff: pull back to the whole sensor
    ...zoomOut(at("Three diodes")),
    ...sfx(at("That's your color sensor"), "thud"),
    { from: at("That's your color sensor"), to: ctaT, set: { highlight: "D1,D2,D3" } },
  ],
};
