/**
 * Provenance of the vendored workflow-manager sources.
 *
 * These files are the ORIGINAL OpenFox components from the **official**
 * repository, copied verbatim except for their import paths, plus one small,
 * documented patch (see `runtime-highlight.patch`).
 *
 * - Official repository:  https://github.com/co-l/openfox
 * - Official commit:     0694574dc1b1cf432ef5fa63c5429cbc89797b2c (branch `develop`)
 * - License:             MIT — declared in the official package.json (the upstream
 *                        repository ships no standalone LICENSE file)
 * - Retrieved:           2026-11-15
 *
 * | Vendored file                 | Official path                                            |
 * | ----------------------------- | -------------------------------------------------------- |
 * | src/vendor/FlowDiagram.tsx    | web/src/components/settings/workflows/FlowDiagram.tsx     |
 * | src/vendor/workflow-layout.ts | web/src/components/settings/workflows/layout.ts           |
 * | src/vendor/types.ts           | types from web/src/lib/workflows-actions.ts and           |
 * |                               | web/src/lib/agents-actions.ts (types only, no runtime)    |
 *
 * ## Changes applied (exhaustive)
 *
 * 1. Import paths: `./layout` → `./workflow-layout`; the two host `lib/*` type
 *    imports → `./types` (the host web app is not an importable module).
 * 2. `runtime-highlight.patch` — the minimal read-only runtime overlay
 *    (`runtime?: WorkflowRuntimeInfo` + `resolveStepRuntime`), which is what
 *    lets the plugin show the active step and the per-step counters. It is the
 *    same change that was proposed upstream in co-l/openfox#465 (closed,
 *    unmerged); the patch is kept in-tree so this repository is **fully
 *    self-contained** and reproducible from the official commit alone.
 *
 * No drawing, geometry, colour or layout logic was altered. `git apply` of the
 * patch on the official files reproduces these sources byte for byte.
 *
 * ## Re-vendoring procedure (no dependency on any personal branch)
 *
 *   git clone https://github.com/co-l/openfox /tmp/openfox
 *   git -C /tmp/openfox checkout 0694574dc1b1cf432ef5fa63c5429cbc89797b2c
 *   cp /tmp/openfox/web/src/components/settings/workflows/FlowDiagram.tsx src/vendor/
 *   cp /tmp/openfox/web/src/components/settings/workflows/layout.ts src/vendor/workflow-layout.ts
 *   cd src/vendor && patch -p6 FlowDiagram.tsx < runtime-highlight.patch
 *                 patch -p6 workflow-layout.ts < runtime-highlight.patch
 *   # re-apply the two import rewrites, then:
 *   node scripts/build-graph.mjs
 */
