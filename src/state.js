/**
 * Pure state + view builders for the Workflow Visualizer plugin.
 *
 * Everything here is framework-free so it can be unit-tested without an
 * OpenFox host. The views are OpenFox `DeclarativeNode` trees (plugin API v2);
 * the plugin never touches the DOM or React internals.
 */

/** Panel id of the iframe graph contributed by this plugin. */
export const GRAPH_PANEL_ID = 'workflow-visualizer-graph'

/** Workflow statuses that mean "a run is in flight" and deserve the bar. */
const ACTIVE_STATUSES = new Set(['running', 'waiting'])

/**
 * @typedef {object} WorkflowExecutionSnapshot
 * @property {string} executionId
 * @property {string} workflowId
 * @property {string} workflowName
 * @property {string} [workflowColor]
 * @property {string} status
 * @property {string} [currentStepId]
 * @property {string} [currentStepName]
 * @property {number} [iterations]
 * @property {number} [totalIterations]
 * @property {number} [maxIterations]
 * @property {Record<string, number>} [stepIterations]
 * @property {string} [workflowScope]
 * @property {number} updatedAt
 */

/**
 * Create the per-session execution cache.
 * Sessions are keyed by id, so two panes never share state.
 */
export function createStore() {
  /** @type {Map<string, WorkflowExecutionSnapshot>} */
  const bySession = new Map()
  return {
    /**
     * Apply a `workflow.execution.changed` hook payload.
     * Unknown fields are never invented: an absent counter stays absent.
     *
     * @param {string} sessionId
     * @param {Record<string, unknown>} data
     * @returns {WorkflowExecutionSnapshot | null}
     */
    apply(sessionId, data) {
      if (!sessionId || !data || typeof data !== 'object') return null
      const executionId = typeof data.executionId === 'string' ? data.executionId : ''
      if (!executionId) return null
      const previous = bySession.get(sessionId)
      // A late event from a replaced execution must not overwrite the current
      // run's step or counters (same rule as the core client).
      if (previous && previous.executionId !== executionId) {
        const previousActive = ACTIVE_STATUSES.has(previous.status)
        if (previousActive) return previous
      }
      /** @type {WorkflowExecutionSnapshot} */
      const next = {
        executionId,
        workflowId: typeof data.workflowId === 'string' ? data.workflowId : (previous?.workflowId ?? ''),
        workflowName:
          typeof data.workflowName === 'string' ? data.workflowName : (previous?.workflowName ?? 'Workflow'),
        status: typeof data.status === 'string' ? data.status : 'running',
        updatedAt: Date.now(),
        ...(typeof data.workflowColor === 'string' ? { workflowColor: data.workflowColor } : {}),
        ...(typeof data.currentStepId === 'string' ? { currentStepId: data.currentStepId } : {}),
        ...(typeof data.currentStepName === 'string' ? { currentStepName: data.currentStepName } : {}),
        ...(typeof data.workflowScope === 'string' ? { workflowScope: data.workflowScope } : {}),
        ...(typeof data.iterations === 'number' ? { iterations: data.iterations } : {}),
        ...(typeof data.totalIterations === 'number' ? { totalIterations: data.totalIterations } : {}),
        ...(typeof data.maxIterations === 'number' ? { maxIterations: data.maxIterations } : {}),
        ...(isStepCounts(data.stepIterations) ? { stepIterations: { ...data.stepIterations } } : {}),
      }
      bySession.set(sessionId, next)
      return next
    },

    /**
     * @param {string} sessionId
     * @returns {WorkflowExecutionSnapshot | null}
     */
    read(sessionId) {
      if (!sessionId) return null
      return bySession.get(sessionId) ?? null
    },

    /** Test/teardown helper. */
    clear() {
      bySession.clear()
    },
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, number>}
 */
function isStepCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((count) => typeof count === 'number')
}

/**
 * True when the execution is worth showing in the composer zone.
 * @param {WorkflowExecutionSnapshot | null} execution
 */
export function isVisible(execution) {
  return execution !== null && ACTIVE_STATUSES.has(execution.status)
}

/**
 * Build the localized iteration label from the engine's own numbers.
 * A resumed run keeps its cumulative total visible next to the per-run counter.
 *
 * @param {WorkflowExecutionSnapshot} execution
 * @returns {{ en: string, fr: string } | null}
 */
export function iterationLabel(execution) {
  const { iterations, maxIterations, totalIterations } = execution
  if (typeof iterations !== 'number') return null
  const capped = typeof maxIterations === 'number'
  const suffixEn = totalIterations !== undefined && totalIterations > iterations ? ` · ${totalIterations} total` : ''
  const suffixFr = totalIterations !== undefined && totalIterations > iterations ? ` · ${totalIterations} au total` : ''
  if (capped) {
    return { en: `iteration ${iterations}/${maxIterations}${suffixEn}`, fr: `itération ${iterations}/${maxIterations}${suffixFr}` }
  }
  const plural = iterations === 1 ? '' : 's'
  return {
    en: `${iterations} iteration${plural}${suffixEn}`,
    fr: `${iterations} itération${plural}${suffixFr}`,
  }
}

/**
 * Per-step progression rows, newest engine counts only.
 * @param {WorkflowExecutionSnapshot} execution
 * @returns {{ key: { en: string, fr: string }, value: string }[]}
 */
export function stepRows(execution) {
  const counts = execution.stepIterations
  if (!counts) return []
  return Object.entries(counts)
    .filter(([, count]) => typeof count === 'number')
    .sort((a, b) => b[1] - a[1])
    .map(([stepId, count]) => ({
      key: { en: stepId === execution.currentStepId ? `▶ ${stepId}` : stepId, fr: stepId === execution.currentStepId ? `▶ ${stepId}` : stepId },
      value: String(count),
    }))
}

/**
 * The composer.top contribution: one compact row, or an empty stack when no
 * workflow is running (the zone must not reserve space otherwise).
 *
 * @param {WorkflowExecutionSnapshot | null} execution
 * @returns {Record<string, unknown>}
 */
export function buildComposerNode(execution) {
  const active = isVisible(execution) && execution !== null
  if (!active) {
    // Always render an entry point: a workflow that is not running yet must not
    // hide the feature. The label says what will happen, and the panel explains
    // the empty state.
    return {
      type: 'stack',
      direction: 'row',
      gap: 'sm',
      align: 'center',
      children: [
        {
          type: 'button',
          label: { en: 'Workflow graph', fr: 'Graphe du workflow' },
          title: {
            en: 'Open the workflow graph — no workflow is running in this session yet',
            fr: 'Ouvrir le graphe du workflow — aucun workflow ne tourne dans cette session',
          },
          variant: 'pill',
          action: { kind: 'openPanel', panelId: GRAPH_PANEL_ID },
        },
      ],
    }
  }
  /** @type {Record<string, unknown>[]} */
  const children = [
    {
      type: 'badge',
      label: { en: execution.workflowName, fr: execution.workflowName },
      ...(execution.workflowColor ? { color: execution.workflowColor } : {}),
      tone: 'info',
    },
  ]
  if (execution.currentStepName) {
    children.push({ type: 'text', text: { en: `· ${execution.currentStepName}`, fr: `· ${execution.currentStepName}` }, muted: true })
  }
  const counter = iterationLabel(execution)
  if (counter) {
    children.push({ type: 'text', text: counter, muted: true })
  }
  children.push({
    type: 'button',
    label: { en: 'Graph', fr: 'Graphe' },
    title: { en: 'Open the workflow graph', fr: 'Ouvrir le graphe du workflow' },
    variant: 'ghost',
    action: { kind: 'openPanel', panelId: GRAPH_PANEL_ID },
  })
  return { type: 'stack', direction: 'row', gap: 'sm', align: 'center', children }
}

/**
 * Panel body: the engine-observed step progression for the current execution.
 * Only facts the engine reported are rendered; nothing is inferred.
 *
 * @param {WorkflowExecutionSnapshot | null} execution
 * @returns {Record<string, unknown>[]}
 */
export function buildPanelNodes(execution) {
  if (!isVisible(execution) || execution === null) {
    return [
      {
        type: 'callout',
        tone: 'info',
        title: { en: 'No workflow running', fr: 'Aucun workflow en cours' },
        text: {
          en: 'Start a workflow: its live step and iteration counters appear above the composer.',
          fr: 'Lancez un workflow : son étape et ses compteurs d’itérations apparaissent au-dessus du compositeur.',
        },
      },
    ]
  }
  const items = [
    { key: { en: 'Workflow', fr: 'Workflow' }, value: execution.workflowName },
    { key: { en: 'Status', fr: 'Statut' }, value: execution.status },
  ]
  if (execution.currentStepName) {
    items.push({ key: { en: 'Current step', fr: 'Étape courante' }, value: execution.currentStepName })
  }
  const counter = iterationLabel(execution)
  if (counter) {
    items.push({ key: { en: 'Iterations', fr: 'Itérations' }, value: counter.en })
  }
  if (execution.workflowScope) {
    items.push({ key: { en: 'Scope', fr: 'Portée' }, value: execution.workflowScope })
  }

  /** @type {Record<string, unknown>[]} */
  const nodes = [
    { type: 'keyValue', items },
  ]
  const rows = stepRows(execution)
  if (rows.length > 0) {
    nodes.push({
      type: 'table',
      columns: [{ en: 'Step', fr: 'Étape' }, { en: 'Runs', fr: 'Exécutions' }],
      rows: rows.map((row) => [row.key.en, row.value]),
    })
  } else {
    nodes.push({
      type: 'text',
      text: {
        en: 'The engine has not reported per-step counts yet.',
        fr: 'Le moteur n’a pas encore rapporté de compteurs par étape.',
      },
      muted: true,
    })
  }
  return nodes
}
