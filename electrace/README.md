# Electrace — core

The framework-agnostic **brain** of Electrace: the block/design schema, the canonical
TypeScript types, the seed block corpus, and the pure-logic core (resolver, lint engine,
projections). No UI, no framework — just typed, testable functions. The editor, the public
pages, and the AI tool are all thin views over this.

Maps to the planning docs in the parent folder: [data-model](../data-model.md),
[lint](../lint.md), [registry](../registry.md), [ai](../ai.md).

## Layout
```
electrace/
├── package.json · tsconfig.json
├── schema/                 JSON Schema — the publish/validation gate
│   ├── block.schema.json
│   └── design.schema.json
├── src/                    pure, framework-agnostic core (operates on parsed objects)
│   ├── types.ts            the canonical contract
│   ├── resolve.ts          parse'd design + blocks → ResolvedDesign (stitches nets)
│   ├── lint.ts             the rule registry → Finding[]
│   ├── bom.ts              BOM projection
│   └── index.ts            public API (incl. analyze())
├── blocks/                 the seed corpus (authored block packages)
│   ├── power-entry/        block.yaml + explain.md
│   ├── buck-converter/
│   └── mcu-load/
├── examples/
│   └── buck-supply.design.json   a sample design wiring the three blocks
└── scripts/
    └── demo.ts             loads the seed blocks + sample design, runs analyze(), prints
```

## Run it
```bash
cd electrace
npm install
npm run demo        # resolve + lint + BOM on the sample design
npm run typecheck   # tsc --noEmit
```

## Design rules (why it's shaped this way)
- **Pure core.** `src/` never touches the filesystem or YAML — it works on already-parsed
  objects, so it runs identically in the editor, on the server, and behind the AI's tools
  (isomorphic). File/YAML loading lives at the edges (`scripts/`, later the app).
- **Declared, not inferred.** The lint only uses values the block/design declared. Missing
  value → `unknown` finding, never a fake pass/fail.
- **Projections, not sources.** Lint findings, BOM (and later the flat schematic) are
  *derived* from the one block-graph. Edit blocks; the projections follow.
