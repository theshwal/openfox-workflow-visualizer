import { describe, expect, it } from 'vitest'
import {
  buildComposerNode,
  buildPanelNodes,
  createStore,
  isVisible,
  iterationLabel,
  stepRows,
} from './state.js'

const baseEvent = {
  executionId: 'exec-1',
  workflowId: 'default',
  workflowName: 'Build & Verify',
  status: 'running',
  currentStepId: 'build',
  currentStepName: 'Builder',
  iterations: 3,
  totalIterations: 3,
  maxIterations: 50,
  stepIterations: { build: 3 },
}

describe('store', () => {
  it('caches the execution per session and keeps sessions isolated', () => {
    const store = createStore()
    store.apply('session-a', { ...baseEvent, iterations: 2 })
    store.apply('session-b', { ...baseEvent, executionId: 'exec-2', iterations: 7 })

    expect(store.read('session-a')?.iterations).toBe(2)
    expect(store.read('session-b')?.iterations).toBe(7)
    expect(store.read('session-c')).toBeNull()
  })

  it('ignores a late event from a replaced execution while a run is active', () => {
    const store = createStore()
    store.apply('s', { ...baseEvent, executionId: 'exec-2', currentStepId: 'verify', iterations: 4 })
    store.apply('s', { ...baseEvent, executionId: 'exec-1', currentStepId: 'build', iterations: 9 })

    const snapshot = store.read('s')
    expect(snapshot?.executionId).toBe('exec-2')
    expect(snapshot?.currentStepId).toBe('verify')
    expect(snapshot?.iterations).toBe(4)
  })

  it('never invents an absent counter', () => {
    const store = createStore()
    store.apply('s', { executionId: 'e', workflowId: 'wf', workflowName: 'WF', status: 'running' })
    const snapshot = store.read('s')
    expect(snapshot?.iterations).toBeUndefined()
    expect(snapshot?.maxIterations).toBeUndefined()
  })

  it('ignores payloads without an execution id', () => {
    const store = createStore()
    expect(store.apply('s', { workflowName: 'x' })).toBeNull()
    expect(store.read('s')).toBeNull()
  })
})

describe('visibility', () => {
  it('is visible only for running and waiting runs', () => {
    expect(isVisible({ ...baseEvent, updatedAt: 0 })).toBe(true)
    expect(isVisible({ ...baseEvent, status: 'waiting', updatedAt: 0 })).toBe(true)
    expect(isVisible({ ...baseEvent, status: 'completed', updatedAt: 0 })).toBe(false)
    expect(isVisible(null)).toBe(false)
  })
})

describe('iteration label', () => {
  it('shows the cap and the cumulative total after a resume', () => {
    expect(iterationLabel({ ...baseEvent, iterations: 1, totalIterations: 12 })).toEqual({
      en: 'iteration 1/50 · 12 total',
      fr: 'itération 1/50 · 12 au total',
    })
  })

  it('uses the singular form for a single uncapped iteration', () => {
    expect(iterationLabel({ ...baseEvent, iterations: 1, maxIterations: undefined, totalIterations: undefined })).toEqual({
      en: '1 iteration',
      fr: '1 itération',
    })
  })

  it('returns null when the engine sent no counter', () => {
    expect(iterationLabel({ ...baseEvent, iterations: undefined })).toBeNull()
  })
})

describe('composer contribution', () => {
  it('renders an empty stack when no workflow is running', () => {
    const node = buildComposerNode(null)
    expect(node).toMatchObject({ type: 'stack', children: [] })
  })

  it('renders workflow name, step and counter for an active run', () => {
    const node = buildComposerNode({ ...baseEvent, updatedAt: 0 })
    const children = node.children
    expect(Array.isArray(children)).toBe(true)
    const labels = JSON.stringify(children)
    expect(labels).toContain('Build & Verify')
    expect(labels).toContain('Builder')
    expect(labels).toContain('iteration 3/50')
  })

  it('stays empty once the run is completed', () => {
    expect(buildComposerNode({ ...baseEvent, status: 'completed', updatedAt: 0 })).toMatchObject({
      type: 'stack',
      children: [],
    })
  })
})

describe('panel contribution', () => {
  it('explains the empty state when nothing runs', () => {
    const nodes = buildPanelNodes(null)
    expect(nodes[0]).toMatchObject({ type: 'callout' })
  })

  it('lists the engine-observed steps with the current step marked', () => {
    const nodes = buildPanelNodes({
      ...baseEvent,
      currentStepId: 'verify',
      stepIterations: { build: 3, verify: 1 },
      updatedAt: 0,
    })
    const table = nodes.find((node) => node.type === 'table')
    expect(table).toBeDefined()
    const rows = JSON.stringify(table?.rows)
    expect(rows).toContain('▶ verify')
    expect(rows).toContain('build')
  })

  it('reports the absence of per-step counts instead of guessing', () => {
    const nodes = buildPanelNodes({ ...baseEvent, stepIterations: undefined, updatedAt: 0 })
    expect(nodes.some((node) => node.type === 'table')).toBe(false)
    expect(JSON.stringify(nodes)).toContain('not reported per-step counts yet')
  })

  it('sorts steps by descending run count', () => {
    const rows = stepRows({ ...baseEvent, stepIterations: { a: 1, b: 5 }, updatedAt: 0 })
    expect(rows.map((row) => row.value)).toEqual(['5', '1'])
  })
})
