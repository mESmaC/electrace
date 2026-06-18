import { FootprintLibrary } from "@electrace/ui";

/** The footprint-library modal, populated (seeded land patterns) — each row shows the FootprintPreview
 *  SVG, name, pad count, package kind and size, with import + manage controls. */
export const Library = () => (
  <div data-theme="mid" style={{ background: "var(--color-bg2)" }}>
    <FootprintLibrary onClose={() => {}} />
  </div>
);
