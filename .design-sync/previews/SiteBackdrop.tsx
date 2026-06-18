import { SiteBackdrop } from "@electrace/ui";

/** The ambient page backdrop (faint schematic dot-grid + soft glows) shown behind sample content,
 *  so its subtle depth is visible. It's fixed + behind everything in real use. */
export const Backdrop = () => (
  <div data-theme="mid" style={{ position: "relative", minHeight: 460, background: "var(--color-bg)", overflow: "hidden" }}>
    <SiteBackdrop />
    <div style={{ position: "relative", padding: "64px 48px", fontFamily: "var(--font-sans)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-faint)" }}>Ambient backdrop</div>
      <h1 style={{ marginTop: 10, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text)" }}>See inside every circuit.</h1>
      <p style={{ marginTop: 10, maxWidth: 460, fontSize: 15, color: "var(--color-dim)" }}>The faint dot-grid and soft accent glows behind this text are the SiteBackdrop — depth without distraction.</p>
    </div>
  </div>
);
