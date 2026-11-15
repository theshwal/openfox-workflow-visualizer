import { describe, expect, it, vi } from 'vitest'
import { COMPONENT_ID, GRAPH_PANEL_ID, PANEL_ID, REFRESH_MS, RPC_GET_GRAPH, RPC_GRAPH, RPC_STATE, ZONE, register } from './index.js'

/** Minimal fake of the openfox/plugin v2 registry surface we use. */
function makeRegistry() {
  const hooks = new Map()
  const rpcs = new Map()
  const components = []
  const panels = []
  const assets = []
  return {
    hooks,
    rpcs,
    components,
    panels,
    assets,
    registerHook: vi.fn((event, handler) => hooks.set(event, handler)),
    registerRpc: vi.fn((method, handler) => rpcs.set(method, handler)),
    registerUiComponent: vi.fn((component) => components.push(component)),
    registerUiPanel: vi.fn((panel) => panels.push(panel)),
    registerAsset: vi.fn((asset) => assets.push(asset)),
  }
}

const event = {
  executionId: 'exec-1',
  workflowId: 'default',
  workflowName: 'Build & Verify',
  status: 'running',
  currentStepId: 'build',
  currentStepName: 'Builder',
  iterations: 2,
  totalIterations: 2,
  maxIterations: 50,
  stepIterations: { build: 2 },
}

describe('plugin registration', () => {
  it('contributes to the composer.top zone with an RPC content source', () => {
    const registry = makeRegistry()
    register(registry)

    expect(registry.registerUiComponent).toHaveBeenCalledTimes(1)
    const component = registry.components[0]
    expect(component).toMatchObject({
      id: COMPONENT_ID,
      zone: ZONE,
      contentSource: { kind: 'rpc', method: RPC_STATE, refreshMs: REFRESH_MS },
    })
  })

  it('registers the workflow.execution.changed hook and both RPCs', () => {
    const registry = makeRegistry()
    register(registry)

    expect([...registry.hooks.keys()]).toEqual(['workflow.execution.changed'])
    expect([...registry.rpcs.keys()].sort()).toEqual([RPC_GET_GRAPH, RPC_GRAPH, RPC_STATE].sort())
  })

  it('declares an iframe graph panel backed by a registered asset', () => {
    const registry = makeRegistry()
    register(registry)

    const graph = registry.panels.find((panel) => panel.id === GRAPH_PANEL_ID)
    expect(graph).toMatchObject({ kind: 'iframe', url: 'assets/graph.html', size: 'xl' })
    expect(registry.assets).toEqual(expect.arrayContaining(['assets/graph.html', 'assets/graph.js']))
  })

  it('keeps a declarative text panel as the fallback', () => {
    const registry = makeRegistry()
    register(registry)

    const panel = registry.panels.find((candidate) => candidate.id === PANEL_ID)
    expect(panel).toMatchObject({ id: PANEL_ID, kind: 'declarative' })
    expect(JSON.stringify(panel.content)).toContain('No workflow running')
  })

  it('serves the engine state to the iframe through getGraph, per session', async () => {
    const registry = makeRegistry()
    register(registry)
    registry.hooks.get('workflow.execution.changed')({ event: 'workflow.execution.changed', sessionId: 's1', data: event })

    const mine = await registry.rpcs.get(RPC_GET_GRAPH)({ sessionId: 's1' }, {})
    const other = await registry.rpcs.get(RPC_GET_GRAPH)({ sessionId: 's2' }, {})

    expect(mine.execution).toMatchObject({ workflowId: 'default', currentStepId: 'build', iterations: 2 })
    expect(mine.execution.stepIterations).toEqual({ build: 2 })
    expect(other.execution).toBeNull()
  })

  it('accepts the session id from the RPC context (REST route)', async () => {
    const registry = makeRegistry()
    register(registry)
    registry.hooks.get('workflow.execution.changed')({ event: 'workflow.execution.changed', sessionId: 's1', data: event })

    const viaContext = await registry.rpcs.get(RPC_GET_GRAPH)({}, { sessionId: 's1' })
    expect(viaContext.execution?.executionId).toBe('exec-1')
  })
})

describe('hook + rpc integration', () => {
  it('returns an empty contribution before any workflow event', async () => {
    const registry = makeRegistry()
    register(registry)
    const state = await registry.rpcs.get(RPC_STATE)({ sessionId: 's1' }, {})
    expect(state).toMatchObject({ content: { type: 'stack', children: [] } })
  })

  it('serves the live run to the zone context of its own session only', async () => {
    const registry = makeRegistry()
    register(registry)
    registry.hooks.get('workflow.execution.changed')({ event: 'workflow.execution.changed', sessionId: 's1', data: event })

    const mine = await registry.rpcs.get(RPC_STATE)({ sessionId: 's1' }, {})
    const other = await registry.rpcs.get(RPC_STATE)({ sessionId: 's2' }, {})

    expect(JSON.stringify(mine.content)).toContain('Build & Verify')
    expect(JSON.stringify(mine.content)).toContain('iteration 2/50')
    expect(other).toMatchObject({ content: { type: 'stack', children: [] } })
  })

  it('serves the panel body from the same cached execution', async () => {
    const registry = makeRegistry()
    register(registry)
    registry.hooks.get('workflow.execution.changed')({ event: 'workflow.execution.changed', sessionId: 's1', data: event })

    const body = await registry.rpcs.get(RPC_GRAPH)({ sessionId: 's1' }, {})
    expect(JSON.stringify(body.nodes)).toContain('build')
    expect(body.nodes.some((node) => node.type === 'table')).toBe(true)
  })

  it('degrades to the empty state when the session id is missing', async () => {
    const registry = makeRegistry()
    register(registry)
    const state = await registry.rpcs.get(RPC_STATE)({}, {})
    expect(state).toMatchObject({ content: { type: 'stack', children: [] } })
  })
})
