/**
 * A subtle, theme-aware page backdrop: a faint schematic dot-grid plus a few soft ambient color glows,
 * so the marketing/admin pages don't read as a flat empty canvas. Fixed + behind everything (-z-10) and
 * pointer-events-none, so it never interferes with content. The editor covers it with its own opaque bg.
 */
export default function SiteBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* schematic dot-grid, faded out at the very top/bottom so it never hits a hard edge */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--color-text) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)",
        }}
      />
      {/* ambient glows for color depth — very soft, low-alpha, themed */}
      <div className="absolute left-[-12%] top-[-8%] h-[620px] w-[620px] rounded-full blur-[90px]"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent)" }} />
      <div className="absolute right-[-14%] top-[26%] h-[680px] w-[680px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, #7c6cff 13%, transparent), transparent)" }} />
      <div className="absolute bottom-[-10%] left-[34%] h-[560px] w-[560px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 11%, transparent), transparent)" }} />
    </div>
  );
}
