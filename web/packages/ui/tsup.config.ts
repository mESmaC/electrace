import { defineConfig } from "tsup";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `@/*` in the app resolves to the web root; the DS components live under web/app and import via it.
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "es2020",
  dts: true,
  clean: true,
  treeshake: true,
  // Bundle ONLY the local Electrace component code (web/app/* via the @/ alias, plus src/*); keep
  // EVERY node_modules package external as clean ESM imports. The design-sync converter bundles the
  // React ecosystem (react, react-dom, react/jsx-runtime, @xyflow/react, @dagrejs/dagre and their
  // transitive deps) at ITS bundle step, where it shims react/react-dom/react-is to window globals.
  // Pre-bundling them here instead bakes esbuild's throwing `__require("react")` stub into the dist
  // (any CJS dep that `require("react")` — e.g. use-sync-external-store) which the converter can't
  // intercept. Externalizing them keeps the dist a thin layer the converter can finish cleanly.
  skipNodeModulesBundle: true,
  // `marked` (used by AssistantBubble) references the Node `process` global at module-eval, which
  // throws in the design IIFE. Alias it to a browser-safe passthrough stub so the bubble renders.
  noExternal: [/^marked$/],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      "@": webRoot,
      marked: path.resolve(webRoot, "packages/ui/src/_stubs/marked.ts"),
    };
    options.jsx = "automatic";
    // The app reads runtime config from `process.env.*` (e.g. the affiliate-link template in
    // partLinks). There's no `process` in the design IIFE, so inject an empty-env shim wherever the
    // bundled local code references the `process` global — these are runtime/server concerns,
    // irrelevant to a preview, so every read resolves to undefined.
    options.inject = [...(options.inject ?? []), path.resolve(webRoot, "packages/ui/src/_stubs/process-shim.ts")];
  },
  // NetlistView does `import "@xyflow/react/dist/style.css"`; drop all CSS imports from the JS — the
  // xyflow base CSS is concatenated into the compiled stylesheet by build:css instead.
  esbuildPlugins: [
    {
      name: "drop-css-imports",
      setup(build) {
        build.onResolve({ filter: /\.css$/ }, () => ({ path: "ds-css-noop", namespace: "ds-css-noop" }));
        build.onLoad({ filter: /.*/, namespace: "ds-css-noop" }, () => ({ contents: "", loader: "js" }));
      },
    },
  ],
});
