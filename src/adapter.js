/**
 * Adapter between OpenFox runtime data and the vendored workflow diagram.
 *
 * The diagram itself is the *original* component from the OpenFox workflow
 * manager (see src/vendor/PROVENANCE.md); this file only maps host payloads to
 * its props and never re-implements drawing or layout.
 */

const STEP_TYPES = new Set(['agent', 'sub_agent', 'shell', 'user', 'parallel'])

/**
 * Sanitize a workflow definition into the `WorkflowStep[]` the diagram expects.
 * Unknown fields are dropped; transitions to unknown steps are removed.
 *
 * @param {Record<string, any> | null} definition
 * @returns {any[]}
 */
export function toFlowSteps(definition) {
  if (!definition || !Array.isArray(definition.steps)) return []
  const ids = new Set(definition.steps.filter((s) => s && typeof s.id === 'string').map((s) => s.id))
  return definition.steps
    .filter((step) => step && typeof step.id === 'string')
    .map((step) => ({
      id: step.id,
      name: typeof step.name === 'string' && step.name ? step.name : step.id,
      type: STEP_TYPES.has(step.type) ? step.type : 'shell',
      phase: typeof step.phase === 'string' ? step.phase : '',
      transitions: (Array.isArray(step.transitions) ? step.transitions : [])
        .filter((t) => t && typeof t.goto === 'string' && ids.has(t.goto))
        .map((t) => ({ when: t.when ?? { type: 'always' }, goto: t.goto, ...(t.subGroup ? { subGroup: t.subGroup } : {}) })),
      ...(typeof step.agentId === 'string' ? { agentId: step.agentId } : {}),
      ...(typeof step.subAgentType === 'string' ? { subAgentType: step.subAgentType } : {}),
    }))
}

/**
 * Runtime facts for the diagram's active-step highlight. Only values the engine
 * actually reported are forwarded: an absent counter stays absent.
 *
 * @param {Record<string, any> | null} execution
 * @returns {{ currentStepId?: string, stepIterationCounts?: Record<string, number> } | undefined}
 */
export function buildRuntime(execution) {
  if (!execution || typeof execution !== 'object') return undefined
  const currentStepId = typeof execution.currentStepId === 'string' ? execution.currentStepId : undefined
  const counts = execution.stepIterations
  const stepIterationCounts =
    counts && typeof counts === 'object' && !Array.isArray(counts)
      ? Object.fromEntries(Object.entries(counts).filter(([, v]) => typeof v === 'number'))
      : undefined
  const hasCounts = stepIterationCounts !== undefined && Object.keys(stepIterationCounts).length > 0
  if (!currentStepId && !hasCounts) return undefined
  return {
    ...(currentStepId ? { currentStepId } : {}),
    ...(hasCounts ? { stepIterationCounts } : {}),
  }
}

/**
 * Normalise the /api/agents payload into the diagram's `agentTypes`.
 *
 * @param {Record<string, any> | null} data
 * @returns {any[]}
 */
export function toAgentTypes(data) {
  if (!data || typeof data !== 'object') return []
  return [...(data.defaults ?? []), ...(data.userItems ?? []), ...(data.projectItems ?? [])].filter(
    (agent) => agent && typeof agent.id === 'string',
  )
}
