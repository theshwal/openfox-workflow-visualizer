import { describe, expect, it } from 'vitest'
import { buildRuntime, toAgentTypes, toFlowSteps } from './adapter.js'

const definition = {
  metadata: { id: 'default', name: 'Build & Verify' },
  entryStep: 'work_location',
  steps: [
    {
      id: 'work_location',
      name: 'Where to work',
      type: 'user',
      phase: 'build',
      transitions: [
        { when: { type: 'step_result', result: 'Work in current workspace' }, goto: 'build' },
        { when: { type: 'step_result', result: 'Start a new workspace' }, goto: 'ghost' },
      ],
    },
    { id: 'build', name: 'Implement', type: 'agent', phase: 'build', agentId: 'builder', transitions: [{ when: { type: 'always' }, goto: 'verify' }] },
    { id: 'verify', name: 'Verifier', type: 'sub_agent', phase: 'verification', subAgentType: 'code_reviewer', transitions: [] },
  ],
}

describe('toFlowSteps', () => {
  it('maps a real definition onto the diagram props without inventing steps', () => {
    const steps = toFlowSteps(definition)
    expect(steps.map((step) => step.id)).toEqual(['work_location', 'build', 'verify'])
    expect(steps[1]).toMatchObject({ name: 'Implement', type: 'agent', agentId: 'builder' })
  })

  it('drops transitions pointing at unknown steps', () => {
    const steps = toFlowSteps(definition)
    expect(steps[0].transitions.map((t: { goto: string }) => t.goto)).toEqual(['build'])
  })

  it('keeps the transition condition untouched (the diagram labels edges from it)', () => {
    const steps = toFlowSteps(definition)
    expect(steps[0].transitions[0].when).toEqual({ type: 'step_result', result: 'Work in current workspace' })
  })

  it('degrades unknown step types to a renderable one and empty input to []', () => {
    const steps = toFlowSteps({ steps: [{ id: 'x', type: 'mystery', transitions: [] }] })
    expect(steps[0]).toMatchObject({ id: 'x', name: 'x', type: 'shell' })
    expect(toFlowSteps(null)).toEqual([])
    expect(toFlowSteps({})).toEqual([])
  })
})

describe('buildRuntime', () => {
  it('forwards the active step and the engine counters', () => {
    expect(buildRuntime({ currentStepId: 'build', stepIterations: { build: 2, verify: 1 } })).toEqual({
      currentStepId: 'build',
      stepIterationCounts: { build: 2, verify: 1 },
    })
  })

  it('never invents a counter or an active step', () => {
    expect(buildRuntime({})).toBeUndefined()
    expect(buildRuntime(null)).toBeUndefined()
    expect(buildRuntime({ stepIterations: { build: 'x' } })).toBeUndefined()
  })

  it('keeps only numeric counters', () => {
    expect(buildRuntime({ stepIterations: { a: 1, b: 'no' } })).toEqual({ stepIterationCounts: { a: 1 } })
  })
})

describe('toAgentTypes', () => {
  it('flattens the three agent buckets', () => {
    const types = toAgentTypes({ defaults: [{ id: 'a' }], userItems: [{ id: 'b' }], projectItems: [{ id: 'c' }] })
    expect(types.map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('is empty and safe on a missing payload', () => {
    expect(toAgentTypes(null)).toEqual([])
    expect(toAgentTypes({ defaults: [{ nope: true }] })).toEqual([])
  })
})
