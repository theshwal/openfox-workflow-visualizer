/**
 * Graph model for the iframe panel.
 *
 * Pure functions only: the workflow definition coming from the host API is
 * sanitized into a small, explicit shape (no passthrough of arbitrary fields),
 * then laid out into columns for SVG rendering. Nothing here touches the DOM,
 * so it is unit-testable in Node.
 */

/**
 * @typedef {object} GraphStep
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string[]} next  ids of the target steps
 * @property {number} [visits] engine-observed run count for this step
 * @property {boolean} [current]
 */

/**
 * @typedef {object} GraphModel
 * @property {string} workflowId
 * @property {string} workflowName
 * @property {string} [color]
 * @property {string} entryStep
 * @property {GraphStep[]} steps
 * @property {{ from: string, to: string, label: string }[]} edges
 * @property {number} columns
 * @property {{ id: string, name: string, type: string, column: number, row: number }[]} nodes
 * @property {{ x1: number, y1: number, x2: number, y2: number, from: string, to: string, label: string }[]} lines
 * @property {{ width: number, height: number }} size
 */

const NODE_W = 168
const NODE_H = 54
const COL_GAP = 92
const ROW_GAP = 26
const PAD = 24

/** Only these step types are accepted; anything else renders as 'unknown'. */
const STEP_TYPES = new Set(['agent', 'sub_agent', 'shell', 'user', 'parallel'])

/**
 * Workflow definitions use `{ when, goto }`; older/hand-written ones use
 * `{ to }`. Both are accepted, anything else is ignored (no invented edges).
 *
 * @param {unknown} transition
 * @returns {string | null}
 */
function targetOf(transition) {
  if (!isRecord(transition)) return null
  const target = transition.goto ?? transition.to
  return typeof target === 'string' && target ? target : null
}

/**
 * Human label of a transition, taken from the condition when it is a plain
 * string or a `when.result` value. Never rendered as HTML.
 *
 * @param {unknown} transition
 * @returns {string}
 */
function labelOf(transition) {
  if (!isRecord(transition)) return ''
  if (typeof transition.condition === 'string') return transition.condition
  if (isRecord(transition.when) && typeof transition.when.result === 'string') return transition.when.result
  return ''
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Pick the definition that matches the running execution.
 *
 * Precedence mirrors the server (project > user > builtin): the caller passes
 * the candidate buckets it fetched, and the first bucket containing the id wins.
 *
 * @param {string} workflowId
 * @param {{ scope: string, workflows: unknown[] }[]} buckets ordered by precedence
 * @returns {{ scope: string, definition: Record<string, unknown> } | null}
 */
export function resolveDefinition(workflowId, buckets) {
  if (!workflowId) return null
  for (const bucket of buckets) {
    if (!bucket || !Array.isArray(bucket.workflows)) continue
    const found = bucket.workflows.find((entry) => isRecord(entry) && isRecord(entry.metadata) && entry.metadata.id === workflowId)
    if (isRecord(found)) return { scope: bucket.scope, definition: found }
  }
  return null
}

/**
 * Sanitize a raw workflow definition into the fields the panel may render.
 * Unknown/extra fields are dropped, ids are coerced to strings, and the
 * transitions are kept only when they point at a known step (no invented edges).
 *
 * @param {Record<string, unknown>} definition
 * @param {{ currentStepId?: string, stepIterations?: Record<string, number> }} [runtime]
 * @returns {GraphModel | null}
 */
export function buildGraphModel(definition, runtime = {}) {
  if (!isRecord(definition) || !isRecord(definition.metadata) || !Array.isArray(definition.steps)) return null
  const rawSteps = definition.steps.filter((step) => isRecord(step) && typeof step.id === 'string')
  if (rawSteps.length === 0) return null

  const ids = new Set(rawSteps.map((step) => step.id))
  const counts = runtime.stepIterations ?? {}
  const currentStepId = runtime.currentStepId

  /** @type {GraphStep[]} */
  const steps = rawSteps.map((step) => {
    const id = String(step.id)
    const transitions = Array.isArray(step.transitions) ? step.transitions : []
    const next = transitions
      .map((transition) => targetOf(transition))
      .filter((target) => target !== null && ids.has(target))
    return {
      id,
      name: typeof step.name === 'string' && step.name ? step.name : id,
      type: typeof step.type === 'string' && STEP_TYPES.has(step.type) ? step.type : 'unknown',
      next,
      ...(typeof counts[id] === 'number' ? { visits: counts[id] } : {}),
      ...(id === currentStepId ? { current: true } : {}),
    }
  })

  const byId = new Map(steps.map((step) => [step.id, step]))
  /** @type {{ from: string, to: string, label: string }[]} */
  const edges = []
  for (const step of rawSteps) {
    const id = String(step.id)
    const transitions = Array.isArray(step.transitions) ? step.transitions : []
    for (const transition of transitions) {
      const target = targetOf(transition)
      if (target === null || !ids.has(target)) continue
      edges.push({ from: id, to: target, label: labelOf(transition) })
    }
  }

  const entryStep = typeof definition.entryStep === 'string' && ids.has(definition.entryStep) ? definition.entryStep : steps[0].id
  const { nodes, lines, columns } = layout(steps, edges, entryStep, byId)

  const metadata = definition.metadata
  return {
    workflowId: String(metadata.id),
    workflowName: typeof metadata.name === 'string' ? metadata.name : String(metadata.id),
    ...(typeof metadata.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(metadata.color) ? { color: metadata.color } : {}),
    entryStep,
    steps,
    edges,
    columns,
    nodes,
    lines,
    size: {
      width: PAD * 2 + Math.max(columns, 1) * NODE_W + Math.max(columns - 1, 0) * COL_GAP,
      height: PAD * 2 + maxRowCount(nodes) * NODE_H + Math.max(maxRowCount(nodes) - 1, 0) * ROW_GAP,
    },
  }
}

/**
 * @param {{ column: number, row: number }[]} nodes
 */
function maxRowCount(nodes) {
  if (nodes.length === 0) return 1
  const perColumn = new Map()
  for (const node of nodes) perColumn.set(node.column, (perColumn.get(node.column) ?? 0) + 1)
  return Math.max(...perColumn.values())
}

/**
 * Left-to-right layered layout by BFS distance from the entry step.
 * Deterministic: steps keep their definition order inside a column.
 *
 * @param {GraphStep[]} steps
 * @param {{ from: string, to: string }[]} edges
 * @param {string} entryStep
 * @param {Map<string, GraphStep>} byId
 */
function layout(steps, edges, entryStep, byId) {
  /** @type {Map<string, number>} */
  const depth = new Map([[entryStep, 0]])
  const queue = [entryStep]
  while (queue.length > 0) {
    const id = queue.shift()
    const step = byId.get(id)
    if (!step) continue
    const nextDepth = (depth.get(id) ?? 0) + 1
    for (const target of step.next) {
      if (depth.has(target)) continue
      depth.set(target, nextDepth)
      queue.push(target)
    }
  }
  // Unreachable steps are appended in the last column rather than dropped.
  const maxKnown = depth.size > 0 ? Math.max(...depth.values()) : 0
  for (const step of steps) {
    if (!depth.has(step.id)) depth.set(step.id, maxKnown + 1)
  }

  /** @type {Map<number, string[]>} */
  const columns = new Map()
  for (const step of steps) {
    const column = depth.get(step.id) ?? 0
    const list = columns.get(column) ?? []
    list.push(step.id)
    columns.set(column, list)
  }

  const nodes = []
  const positions = new Map()
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const ids = columns.get(column) ?? []
    ids.forEach((id, row) => {
      const step = byId.get(id)
      nodes.push({ id, name: step?.name ?? id, type: step?.type ?? 'unknown', column, row })
      positions.set(id, {
        x: PAD + column * (NODE_W + COL_GAP),
        y: PAD + row * (NODE_H + ROW_GAP),
      })
    })
  }

  const lines = edges
    .map((edge) => {
      const from = positions.get(edge.from)
      const to = positions.get(edge.to)
      if (!from || !to) return null
      return {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        x1: from.x + NODE_W,
        y1: from.y + NODE_H / 2,
        x2: to.x,
        y2: to.y + NODE_H / 2,
      }
    })
    .filter(Boolean)

  return { nodes, lines, columns: Math.max(columns.size, 1) }
}

export const GEOMETRY = { NODE_W, NODE_H, COL_GAP, ROW_GAP, PAD }
