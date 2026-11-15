import { describe, expect, it } from 'vitest'
import { buildGraphModel, inspectGraphStep, resolveDefinition } from './graph.js'

const definition = {
  metadata: { id: 'default', name: 'Build & Verify', color: '#3b82f6' },
  entryStep: 'work_location',
  settings: { maxIterations: 12 },
  steps: [
    {
      id: 'work_location',
      name: 'Where to work',
      type: 'user',
      transitions: [{ when: { type: 'step_result', result: 'Work in current workspace' }, goto: 'build' }],
    },
    { id: 'build', name: 'Builder', type: 'agent', agentId: 'builder', transitions: [{ to: 'verify' }] },
    { id: 'verify', name: 'Verifier', type: 'sub_agent', transitions: [{ to: 'done' }, { to: 'build' }] },
    { id: 'done', name: 'Done', type: 'shell', transitions: [] },
  ],
}

describe('resolveDefinition', () => {
  it('follows project > user > builtin precedence', () => {
    const buckets = [
      { scope: 'project', workflows: [{ metadata: { id: 'other' } }] },
      { scope: 'user', workflows: [{ metadata: { id: 'default' }, marker: 'user' }] },
      { scope: 'builtin', workflows: [{ metadata: { id: 'default' }, marker: 'builtin' }] },
    ]
    const resolved = resolveDefinition('default', buckets)
    expect(resolved?.scope).toBe('user')
    expect(resolved?.definition.marker).toBe('user')
  })

  it('prefers the project bucket when it shadows the same id', () => {
    const buckets = [
      { scope: 'project', workflows: [{ metadata: { id: 'default' }, marker: 'project' }] },
      { scope: 'builtin', workflows: [{ metadata: { id: 'default' }, marker: 'builtin' }] },
    ]
    expect(resolveDefinition('default', buckets)?.definition.marker).toBe('project')
  })

  it('returns null when no bucket holds the id', () => {
    expect(resolveDefinition('missing', [{ scope: 'builtin', workflows: [] }])).toBeNull()
    expect(resolveDefinition('', [{ scope: 'builtin', workflows: [{ metadata: { id: '' } }] }])).toBeNull()
  })
})

describe('buildGraphModel', () => {
  it('builds nodes, edges and marks the current step', () => {
    const model = buildGraphModel(definition, { currentStepId: 'verify', stepIterations: { build: 3, verify: 1 } })!
    expect(model).not.toBeNull()
    expect(model.workflowName).toBe('Build & Verify')
    expect(model.entryStep).toBe('work_location')
    expect(model.steps.map((step) => step.id)).toEqual(['work_location', 'build', 'verify', 'done'])
    expect(model.edges).toHaveLength(4)
    const verify = model.steps.find((step) => step.id === 'verify')
    expect(verify?.current).toBe(true)
    expect(verify?.visits).toBe(1)
    expect(model.steps.find((step) => step.id === 'build')?.current).toBeUndefined()
  })

  it('reads the real definition shape (when/goto) and labels the edge', () => {
    const model = buildGraphModel({
      metadata: { id: 'wf', name: 'WF' },
      entryStep: 'a',
      steps: [
        {
          id: 'a',
          name: 'A',
          type: 'user',
          transitions: [{ when: { type: 'step_result', result: 'go' }, goto: 'b' }],
        },
        { id: 'b', name: 'B', type: 'agent', transitions: [] },
      ],
    })
    expect(model?.edges).toEqual([{ from: 'a', to: 'b', label: 'go' }])
  })

  it('never invents transitions to unknown steps', () => {
    const model = buildGraphModel({
      metadata: { id: 'wf', name: 'WF' },
      entryStep: 'a',
      steps: [
        { id: 'a', name: 'A', type: 'agent', transitions: [{ to: 'ghost' }, { to: 'b' }] },
        { id: 'b', name: 'B', type: 'agent', transitions: [] },
      ],
    })
    expect(model?.edges).toEqual([{ from: 'a', to: 'b', label: '' }])
    expect(model?.steps[0].next).toEqual(['b'])
  })

  it('drops fields the panel must not render', () => {
    const model = buildGraphModel({
      metadata: { id: 'wf', name: 'WF', secret: 'token-abc' },
      entryStep: 'a',
      steps: [{ id: 'a', name: 'A', type: 'agent', prompt: 'internal', transitions: [] }],
    })
    const serialized = JSON.stringify(model)
    expect(serialized).not.toContain('token-abc')
    expect(serialized).not.toContain('internal')
  })

  it('rejects malformed definitions instead of rendering a fake graph', () => {
    expect(buildGraphModel(null as never)).toBeNull()
    expect(buildGraphModel({ metadata: { id: 'x' }, steps: [] })).toBeNull()
    expect(buildGraphModel({ steps: [{ id: 'a' }] })).toBeNull()
  })

  it('falls back to the first step when entryStep is unknown', () => {
    const model = buildGraphModel({
      metadata: { id: 'wf', name: 'WF' },
      entryStep: 'nope',
      steps: [{ id: 'a', name: 'A', type: 'agent', transitions: [] }],
    })
    expect(model?.entryStep).toBe('a')
  })

  it('lays unreachable steps out instead of dropping them', () => {
    const model = buildGraphModel({
      metadata: { id: 'wf', name: 'WF' },
      entryStep: 'a',
      steps: [
        { id: 'a', name: 'A', type: 'agent', transitions: [] },
        { id: 'orphan', name: 'Orphan', type: 'shell', transitions: [] },
      ],
    })
    expect(model?.nodes.map((node) => node.id)).toEqual(['a', 'orphan'])
    expect(model?.nodes[1].column).toBeGreaterThan(model?.nodes[0].column ?? 0)
  })

  it('produces deterministic geometry and a positive canvas size', () => {
    const first = buildGraphModel(definition, {})
    const second = buildGraphModel(definition, {})
    expect(second?.nodes).toEqual(first?.nodes)
    expect(first?.size.width).toBeGreaterThan(0)
    expect(first?.size.height).toBeGreaterThan(0)
    expect(first?.lines.every((line) => Number.isFinite(line.x1) && Number.isFinite(line.y2))).toBe(true)
  })

  it('ignores an invalid colour instead of passing it through to CSS', () => {
    const model = buildGraphModel({ ...definition, metadata: { id: 'wf', name: 'WF', color: 'red;background:url(x)' } })
    expect(model?.color).toBeUndefined()
  })
})

describe('inspectGraphStep', () => {
  it('returns observed counters and real transitions for the selected step', () => {
    const model = buildGraphModel(definition, { currentStepId: 'verify', stepIterations: { verify: 2 } })!
    expect(inspectGraphStep(model, 'verify')).toEqual({
      id: 'verify', name: 'Verifier', type: 'sub_agent', current: true, visits: 2,
      incoming: [{ from: 'build', label: '' }],
      outgoing: [{ to: 'done', label: '' }, { to: 'build', label: '' }],
    })
  })
  it('does not return unknown steps or internal workflow fields', () => {
    const model = buildGraphModel(definition)!
    expect(inspectGraphStep(model, 'missing')).toBeNull()
    expect(inspectGraphStep(null, 'verify')).toBeNull()
    expect(JSON.stringify(inspectGraphStep(model, 'build'))).not.toContain('builder')
  })
})
