// Injected (esbuild `inject`) into the design-system bundle's local code so free references to the
// Node `process` global resolve to a harmless empty env. The app reads runtime/server config via
// process.env.*; in a design preview those are irrelevant, so every read is simply undefined.
export const process = { env: {} as Record<string, string | undefined> };
