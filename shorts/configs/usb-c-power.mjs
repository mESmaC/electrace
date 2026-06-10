export default {
  slug: "usb-c-power",
  title: "Why won't USB-C give you 5V?",
  script: "Why won't USB-C give you five volts? You wire up VBUS, plug in a charger... and get nothing. Here's the secret: USB-C doesn't hand out power to anyone who won't introduce themselves. These two resistors are the introduction. 5.1k, one on each CC line — they tell the charger: I'm a device. Give me five volts. No resistors? The charger assumes nothing is plugged in, and keeps the power off. That's why the same cable works on some boards and not others — somebody forgot the introduction. The fix costs two cents. Design the whole circuit yourself — free, in your browser. Link in comments.",
  ctaAnchor: "Design the whole circuit",
  tailSeconds: 1.6,
  tracks: ({ at, ctaT }) => [
    { from: at("You wire up VBUS"), to: at("Here's the secret"), tween: "symbolsShown", start: 0, end: 12 },
    { from: at("Here's the secret"), to: at("These two resistors"), tween: "wireProgress", start: 0, end: 14 },
    { from: at("These two resistors"), to: at("one on each CC line"), set: { highlight: "R1" } },
    { from: at("one on each CC line"), to: at("No resistors?"), set: { highlight: "R2" } },
    { from: at("No resistors?"), to: ctaT, set: { wireProgress: 14, symbolsShown: 12 } },
  ],
};
