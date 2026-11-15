/**
 * OpenFox Workflow Visualizer plugin (openfox/plugin API v2).
 *
 * Contributes a live, read-only workflow indicator to the `composer.top` zone
 * (above the chat composer) plus a panel with the engine's per-step counters.
 *
 * Contract notes:
 * - No DOM access, no React internals, no monkey patching: the host renders the
 *   declarative nodes returned by our RPC.
 * - State comes exclusively from the `workflow.execution.changed` hook, so every
 *   number shown is the engine's own value.
 *
 * @typedef {import('./state.js').WorkflowExecutionSnapshot} WorkflowExecutionSnapshot
 */

import { buildComposerNode, buildPanelNodes, createStore, isVisible } from './state.js'

export const RPC_STATE = 'workflow-visualizer.state'
export const RPC_GRAPH = 'workflow-visualizer.graph'
export const PANEL_ID = 'workflow-visualizer-progress'
export const COMPONENT_ID = 'workflow-visualizer-bar'
export const ZONE = 'composer.top'
/** Refresh cadence for the composer contribution while it stays mounted. */
export const REFRESH_MS = 1500

/**
 * The zone context is merged into `params` for UI contributions, while the REST
 * RPC route passes it as the second argument. Accept both so the same plugin
 * works from the chat zone and from `/api/plugins/:id/rpc/:method`.
 *
 * @param {Record<string, unknown>} params
 * @param {unknown} context
 */
function sessionIdOf(params, context) {
  if (typeof params.sessionId === 'string' && params.sessionId) return params.sessionId
  const fromContext = context && typeof context === 'object' ? /** @type {Record<string, unknown>} */ (context).sessionId : undefined
  return typeof fromContext === 'string' ? fromContext : ''
}

/**
 * @param {import('openfox/plugin').PluginRegistry} registry
 */
export function register(registry) {
  const store = createStore()

  registry.registerHook('workflow.execution.changed', (payload) => {
    store.apply(payload.sessionId, payload.data)
  })

  // The zone context carries sessionId; each pane therefore reads its own run.
  registry.registerRpc(RPC_STATE, (params, context) => {
    const sessionId = sessionIdOf(params, context)
    const execution = store.read(sessionId)
    return { content: buildComposerNode(execution) }
  })

  registry.registerRpc(RPC_GRAPH, (params, context) => {
    const sessionId = sessionIdOf(params, context)
    return { nodes: buildPanelNodes(store.read(sessionId)) }
  })

  registry.registerUiComponent({
    id: COMPONENT_ID,
    zone: ZONE,
    order: 0,
    component: { type: 'stack', direction: 'row', gap: 'sm', children: [] },
    contentSource: { kind: 'rpc', method: RPC_STATE, refreshMs: REFRESH_MS },
  })

  registry.registerUiPanel({
    id: PANEL_ID,
    title: { en: 'Workflow progress', fr: 'Progression du workflow' },
    size: 'md',
    kind: 'declarative',
    content: buildPanelNodes(null),
  })

  // Exposed for tests and for hosts that want to inspect the cache.
  return {
    /** @param {string} sessionId */
    snapshot: (sessionId) => store.read(sessionId),
    /** @param {string} sessionId */
    hasActiveRun: (sessionId) => isVisible(store.read(sessionId)),
    store,
  }
}
