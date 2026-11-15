/**
 * Provenance of the vendored workflow-manager sources.
 *
 * These files are the ORIGINAL OpenFox components, copied verbatim except for
 * their import paths. They are NOT a re-implementation: the plugin renders the
 * very same component the workflow manager uses.
 *
 * - Upstream repository: https://github.com/co-l/openfox
 * - Pinned commit:       18cc7c388c7ca655c591eed77e0d8e51fa63cc3e
 * - Branch at that SHA:  feat/workflow-visualizer-native
 * - License:             MIT (see LICENSE.upstream)
 * - Retrieved:           2026-11-15
 *
 * | Vendored file             | Upstream path                                             |
 * | ------------------------- | --------------------------------------------------------- |
 * | src/vendor/FlowDiagram.tsx | web/src/components/settings/workflows/FlowDiagram.tsx     |
 * | src/vendor/workflow-layout.ts | web/src/components/settings/workflows/layout.ts        |
 * | src/vendor/types.ts        | types copied from web/src/lib/workflows-actions.ts and   |
 * |                            | web/src/lib/agents-actions.ts (types only, no runtime)    |
 *
 * Only change applied: import paths (`./layout` → `./workflow-layout`, host
 * `lib/*` type imports → `./types`). No logic, styling or geometry was altered.
 *
 * Re-vendoring procedure:
 *   1. git -C <openfox checkout> show <SHA>:web/src/components/settings/workflows/FlowDiagram.tsx > src/vendor/FlowDiagram.tsx
 *   2. same for layout.ts
 *   3. re-apply the two import rewrites
 *   4. node scripts/build-graph.mjs
 */
