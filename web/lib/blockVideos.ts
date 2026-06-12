// YouTube shorts paired to block pages. A listed block embeds the video below its explainer and
// emits VideoObject JSON-LD (video rich-result eligibility) — the passive cross-feed loop:
// video description links the page, the page hosts the video. Add an entry per published short.
export const BLOCK_VIDEOS: Record<string, { id: string; title: string; uploadDate: string }> = {
  "timer-555": { id: "DSAZE8EtnfY", title: "There's no magic inside a 555 timer", uploadDate: "2026-06-10" },
  "usb-c-power": { id: "7ydwaV_iLus", title: "Why your USB-C project won't power on (it's two resistors)", uploadDate: "2026-06-11" },
  "opamp-noninverting": { id: "sDrgscWDw7w", title: "The only difference between an op-amp and a comparator is one tiny capacitor", uploadDate: "2026-06-11" },
  "liion-charger": { id: "IYFb2K2S5vI", title: "How your battery knows to stop charging at exactly 4.2V", uploadDate: "2026-06-11" },
  "comparator-hysteresis": { id: "4fV1H43HSkI", title: "Why your comparator chatters (and the one resistor that fixes it)", uploadDate: "2026-06-12" },
};
