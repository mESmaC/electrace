// Appends the @xyflow/react base stylesheet to the compiled dist/electrace-ui.css.
// NetlistView's `import "@xyflow/react/dist/style.css"` is dropped at bundle time (tsup .css->empty),
// so the graph's required base styles must travel with the design-system stylesheet instead.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = "dist/electrace-ui.css";

let css = readFileSync(out, "utf8");
try {
  const xyflowCss = require.resolve("@xyflow/react/dist/style.css");
  css += `\n/* ---- @xyflow/react base styles (for NetlistView) ---- */\n${readFileSync(xyflowCss, "utf8")}`;
  writeFileSync(out, css);
  console.log("append-vendor-css: appended @xyflow/react base styles");
} catch (err) {
  console.warn("append-vendor-css: could not resolve @xyflow/react/dist/style.css —", err.message);
}
