# Optimization & debug backlog

Findings from the debug + performance pass that were **not** fixed in-pass — either because they
need the dev server running to verify (interactive perf), or they're larger refactors worth scheduling.
Each item has a `file:line`, the impact, and the proposed approach. Fix the **High** tier first.

Items already shipped in the pass (for reference): `delete_block` connector-wire loss, NDJSON tail
flush + reader release, `netName` rail regex, `validate` malformed-endpoint guard, `toggleAck`
prompt-in-updater, PCB trace/via id collisions + stale-`places` persist, `context.designContext`
O(n²)→Map, `SymbolNode` memo, Editor `consolidation`/`stressLimits` memo, assistant context moved
out of the cached prefix, spark cache warming, agent-loop abort on client disconnect.

---

## High — interactive perf (needs server-on verification)

- [ ] **PCB editor re-renders the whole SVG on every mouse move** — [PcbEditor.tsx:399](web/app/editor/PcbEditor.tsx#L399). In route/measure mode `onMove` calls `setCursor(p)` each pointer move, re-rendering every trace/component/pad/label. Dominant PCB perf cost. *Approach:* move the cursor-dependent overlays (routing crosshair, dashed preview, measure ruler) into a small child component that holds its own `cursor` state, or drive them imperatively via refs (as the X/Y readout already does), so the heavy geometry render stays off the cursor path.

- [ ] **`analyze()` runs on every drag tick** — [Editor.tsx:296-327](web/app/editor/Editor.tsx#L296), [Editor.tsx:373-385](web/app/editor/Editor.tsx#L373). `designLive` recomputes on every `nodes`/`edges` change, feeding a full `analyze()` + the `designCtx`/`designReport` string build; `onNodesChange` fires continuously during a drag. *Approach:* debounce the snapshot that feeds `designLive` (derive it from a ~150ms-debounced copy of nodes/edges) so `analyze()` doesn't run mid-drag.

- [ ] **Full `blockMap` rebuild on every in-block autosave** — [Editor.tsx:684-695](web/app/editor/Editor.tsx#L684). Each `draftV` bump (every BlockSchematic autosave) rebuilds the entire `blockMap`, re-reading localStorage + re-running `deriveBlockSchematic` for *every* block. *Approach:* re-derive only the block whose `id` is in the `electrace:blocksch` event detail.

- [ ] **`exposedTermIds` reads localStorage on every drag frame** — [BlockSchematic.tsx:534](web/app/editor/BlockSchematic.tsx#L534). The memo deps include `model` (changes on every drag/wire tick) and it calls `liveBlock()` → `getUserBlocks()` (localStorage) + Set rebuild. *Approach:* drop `model` from the deps (unused inside), or recompute from a `userblocks` event instead of every model mutation.

## Medium — perf / cost

- [ ] **`padPos`/`ratsGeom` rebuild on every component drag** — [PcbEditor.tsx:172-173](web/app/editor/PcbEditor.tsx#L172). `padPos` deps `[project, places]`, so dragging one component rebuilds the whole pad-position map and the O(n²) per-net MST in `ratsGeom`. *Approach:* recompute only the dragged component's pads during the drag, or debounce `ratsGeom` until drag end.

- [ ] **Zoom/pan can use a stale `panRef` on interleaved wheel events** — [PcbEditor.tsx:263-265](web/app/editor/PcbEditor.tsx#L263). The zoom branch reads `panRef.current` (refs lag un-flushed state updates) while the pan branch uses a functional updater. *Approach:* make the zoom branch also use functional `setPan`/`setZoom` updaters.

- [ ] **`project` rebuilds if the parent recreates the `blocks` Map each render** — [PcbEditor.tsx:253](web/app/editor/PcbEditor.tsx#L253). `project = useMemo([design, blocks])`; if `blocks` is a fresh Map identity per parent render, `pcbProject` (netlist derivation) re-runs every render and invalidates all downstream memos. *Approach:* confirm the parent memoizes `blocks`; if not, key the memo on a stable signature (design.id + block-id hash).

- [ ] **serverSync mirrors full blobs (incl. the 2000-entry events log) on every write** — [serverSync.ts:42-43](web/lib/serverSync.ts#L42). Monkey-patches `localStorage.setItem`/`removeItem` and POSTs the entire value per debounced write; high-churn keys (telemetry events, large designs) re-upload the whole blob. *Approach:* skip/throttle high-churn keys (events), cap mirrored size, and prefer an explicit `mirroredSet()` wrapper over patching the prototype methods.

- [ ] **AssistantBubble re-renders + re-parses markdown on every stream event** — [AssistantBubble.tsx:49-56](web/app/editor/AssistantBubble.tsx#L49). `setProgress({...prog})` fires for every status/tool/usage NDJSON event → full `useAssistant` re-render, plus a 16ms typewriter timer and `marked.parse` of the whole message. *Approach:* coalesce progress emits (rAF or min interval) and memoize rendered markdown by message id+text.

- [ ] **`storage` event re-parses all conversations on any `electrace:*` write** — [assistant.ts:~205](web/lib/assistant.ts). Cross-tab `sync()` re-reads/`JSON.parse`s all conversations even for unrelated keys (autosave, events). *Approach:* filter the `storage` event by `e.key` prefix (`electrace:chat`) before syncing.

- [ ] **Assistant payload re-sends the full design + the entire blocks map (incl. the whole library) every message** — [route.ts:521](web/app/api/assistant/route.ts#L521), client `sendMessage`. Large JSON per turn; the server also deep-clones the design via `JSON.parse(JSON.stringify())` on the request path. *Approach:* send only the block keys referenced by the design plus user blocks (the model gets the rest via `list_blocks`); `structuredClone` server-side; consider a server design cache keyed by a hash so unchanged designs aren't re-sent.

## Low — correctness / polish

- [ ] **Schematic symbol handles all anchor Left and are all `type="source"`** — [symbols.tsx:850-852](web/app/editor/symbols.tsx#L850). Edge routing anchors from the wrong geometric side; source→source may be rejected. *Approach:* derive `position` from the pin's x (left/right/top/bottom); allow source+target. *(Needs visual verification.)*

- [ ] **PCB device-zoom heuristic misclassifies some mice/trackpads** — [PcbEditor.tsx:259-262](web/app/editor/PcbEditor.tsx#L259). Infers device from `Number.isInteger(deltaY)`; ctrl+scroll browser zoom is treated as pinch. *Approach:* use `e.deltaMode` + a fixed step instead. *(Needs device testing.)*

- [ ] **QFN/QFP footprint geometry wrong when pin count isn't divisible by 4** — [footprints.ts:39-47](electrace/src/footprints.ts#L39). e.g. a 30-pin part lays out 32 then slices to 30, shorting one side. Labeled placeholder. *Approach:* distribute the remainder across sides.

- [ ] **Index keys in dynamic lists** — Editor findings/BOM/stress (`key={i}`), PcbEditor DRC/problems lists. Reorders (findings sort by ack+severity) cause remounts / state mismatch. *Approach:* use stable keys (`findingKey(f)`, a BOM ref key).

- [ ] **`performance.now()`-based ids can collide within the same millisecond** — BlockSchematic `addSymAt`/`onPin`. *Approach:* monotonic counter or `crypto.randomUUID()`.

- [ ] **Raw provider error text can reach the client** — [route.ts:566](web/app/api/assistant/route.ts#L566) (and the `error` emit). Bounded to 300 chars and not the key, but it's raw Anthropic body. *Approach:* generic client message; log the detail server-side only.

---

## Investigated — NOT bugs (don't re-chase)

- **Parallel-spark shared mutation** — `runTool` is fully synchronous (no `await` inside), so spark tool calls run atomically between `await` points and serialize naturally. The "parallel-safe" comment is correct.
- **`routed()` union-find "unbounded growth"** ([PcbEditor.tsx:223](web/app/editor/PcbEditor.tsx#L223)) — its `find()` only runs after `parent.has()` confirms presence, so it never inserts post-build.
- **PCB 2-pad footprint for an unconnected chip** ([pcb.ts:35](electrace/src/pcb.ts#L35)) — chips still land their full package via `part.chip.pins` in `resolveFootprint`; the `["1","2"]` fallback only affects 2-pin passives, which is correct.
- **derive-schematic "GND island" name collision** — two nets sharing a label name *should* merge; that's intended net-label semantics, not a bug.
- **`max_tokens` dangling `tool_use`** — already prevented: `stop_reason !== "tool_use"` finishes the turn gracefully, so no dangling tool_use is ever sent on a following turn.
- **ReactFlow `nodeTypes` stability** ([Editor.tsx:207](web/app/editor/Editor.tsx#L207)) — module-level constant, stable; no node remount risk.
