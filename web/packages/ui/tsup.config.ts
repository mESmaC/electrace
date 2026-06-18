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
  // NOT clean:true — tsup's clean wipes ALL of dist/, including dist/electrace-ui.css (produced by the
  // separate build:css step). With a single stable entry, outputs overwrite in place, so cleaning isn't
  // needed — and skipping it means `build:js` alone can't strip the stylesheet out from under the converter.
  clean: false,
  treeshake: true,
  // Bundle ONLY the local Electrace component code (web/app/* via the @/ alias, plus src/*); keep
  // EVERY node_modules package external as clean ESM imports. The design-sync converter bundles the
  // React ecosystem (react, react-dom, react/jsx-runtime, @xyflow/react, @dagrejs/dagre and their
  // transitive deps) at ITS bundle step, where it shims react/react-dom/react-is to window globals.
  // Pre-bundling them here instead bakes esbuild's throwing `__require("react")` stub into the dist
  // (any CJS dep that `require("react")` — e.g. use-sync-external-store) which the converter can't
  // intercept. Externalizing them keeps the dist a thin layer the converter can finish cleanly.
  skipNodeModulesBundle: true,
  // Force-bundle (vs externalize) the packages we alias to local browser-safe stubs:
  // - marked references the Node `process` global at module-eval.
  // - next/link, next/navigation pull the Next router runtime (absent in the design IIFE).
  noExternal: [/^marked$/, /^next\//],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      "@": webRoot,
      marked: path.resolve(webRoot, "packages/ui/src/_stubs/marked.ts"),
      // Decouple app-page components (AuthForm, BlocksBrowser) from Next + Supabase at the bundle
      // boundary — these are only exercised on navigation/submit, which a static preview never does.
      "next/link": path.resolve(webRoot, "packages/ui/src/_stubs/next-link.tsx"),
      "next/navigation": path.resolve(webRoot, "packages/ui/src/_stubs/next-navigation.ts"),
      "@/lib/auth": path.resolve(webRoot, "packages/ui/src/_stubs/lib-auth.ts"),
      // FootprintLibrary fetches /api/footprints (empty in a preview) — seed a few via the stub.
      "@/lib/footprints": path.resolve(webRoot, "packages/ui/src/_stubs/lib-footprints.ts"),
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
