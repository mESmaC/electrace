import { ThemeSpecimen } from "@electrace/ui";

/** The same component markup re-themed by `data-theme` — Mid (default), Dark, Light, side by side. */
export const Themes = () => (
  <div style={{ background: "var(--color-bg2)", padding: 16 }} data-theme="mid">
    <ThemeSpecimen />
  </div>
);
