// YouTube shorts paired to block pages. A listed block embeds the video below its explainer and
// emits VideoObject JSON-LD (video rich-result eligibility) — the passive cross-feed loop:
// video description links the page, the page hosts the video. Add an entry per published short.
export const BLOCK_VIDEOS: Record<string, { id: string; title: string; uploadDate: string }> = {
  "timer-555": { id: "DSAZE8EtnfY", title: "There's no magic inside a 555 timer", uploadDate: "2026-06-10" },
  // "usb-c-power": { id: "<youtube-video-id>", title: "Why your USB-C project won't power on (it's two resistors)", uploadDate: "..." },
};
