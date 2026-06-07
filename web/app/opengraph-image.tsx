import { ImageResponse } from "next/og";

export const alt = "Electrace — the electrical engineer's IDE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card (mid theme + blue accent). Rendered at build/request time.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "96px", background: "#3c4658", color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 104, fontWeight: 800, letterSpacing: "-3px" }}>
          Electrace
          <div style={{ width: 24, height: 64, background: "#4c8dff", marginLeft: 20, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 40, color: "#d4dae6", marginTop: 28 }}>The electrical engineer&apos;s IDE</div>
        <div style={{ fontSize: 27, color: "#9aa3b5", marginTop: 16 }}>
          Block-based schematics that explain themselves · live checks · no SPICE
        </div>
        <div style={{ display: "flex", marginTop: 52, height: 8, width: 280, background: "#4c8dff", borderRadius: 4 }} />
      </div>
    ),
    { ...size },
  );
}
