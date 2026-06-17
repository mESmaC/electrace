// One-command build of the whole Electrace design-system bundle source.
// 1. build @electrace/core and mirror its dist into web/node_modules (the .d.ts graph needs it)
// 2. build @electrace/ui (tsup: dist/index.js + .d.ts; tailwind: dist/electrace-ui.css)
// Cross-platform (used by `npm run ds:build`, the CI drift guard, and cfg.buildCmd).
import { execSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/packages/ui/scripts
const ui = path.resolve(here, "..");                       // web/packages/ui
const web = path.resolve(ui, "../..");                     // web
const repo = path.resolve(web, "..");                      // repo root
const core = path.resolve(repo, "electrace");

const run = (cmd, cwd) => {
  console.log(`\n$ ${cmd}\n  (in ${path.relative(repo, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

// 1. @electrace/core → dist (+ mirror into web's copy, which is a real copy, not a symlink)
run("npm install --no-audit --no-fund", core);
run("npm run build", core);
const dest = path.join(web, "node_modules", "@electrace", "core", "dist");
mkdirSync(dest, { recursive: true });
cpSync(path.join(core, "dist"), dest, { recursive: true });
console.log(`  mirrored @electrace/core/dist → ${path.relative(repo, dest)}`);

// 2. @electrace/ui → dist (esbuild bundle + .d.ts + compiled stylesheet)
run("npm install --no-audit --no-fund", ui);
run("npm run build", ui);

console.log("\n✓ design-system build complete");
