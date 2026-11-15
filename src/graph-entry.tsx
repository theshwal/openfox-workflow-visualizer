/**
 * iframe entry: renders the ORIGINAL OpenFox workflow-manager diagram
 * (vendored FlowDiagram + layout, see PROVENANCE.md) with live runtime facts.
 *
 * No drawing code lives here — the component is used as-is.
 */
import { createRoot } from 'react-dom/client'
import { FlowDiagram } from './vendor/FlowDiagram'
import { buildRuntime, toAgentTypes, toFlowSteps } from './adapter'

const PLUGIN_ID = 'openfox-workflow-visualizer'

function params() {
  const q = new URLSearchParams(location.search)
  return {
    sessionId: q.get('sessionId') ?? '',
    workdir: q.get('workdir') ?? '',
    projectId: q.get('projectId') ?? '',
    token: q.get('token') ?? '',
    origin: new URL(location.href).origin,
  }
}

const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {})

async function getJson(url, token, init) {
  const res = await fetch(url, { mode: 'cors', headers: authHeaders(token), ...init })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function setStatus(text, isError) {
  const el = document.getElementById('status')
  if (!el) return
  el.textContent = text
  el.className = isError ? 'status error' : 'status'
}

function describe(execution) {
  if (!execution) return ''
  const bits = [execution.workflowName ?? 'Workflow', execution.status ?? '']
  if (execution.currentStepName) bits.push(execution.currentStepName)
  if (typeof execution.iterations === 'number') {
    const cap = typeof execution.maxIterations === 'number' ? `/${execution.maxIterations}` : ''
    const total =
      typeof execution.totalIterations === 'number' && execution.totalIterations > execution.iterations
        ? ` · ${execution.totalIterations} total`
        : ''
    bits.push(`iteration ${execution.iterations}${cap}${total}`)
  }
  return bits.filter(Boolean).join(' · ')
}

async function main() {
  const { sessionId, workdir, projectId, token, origin } = params()
  const root = createRoot(document.getElementById('root'))

  if (!sessionId) {
    setStatus('No session id in the panel URL — open this from a running workflow.', true)
    return
  }

  try {
    const state = await getJson(
      `${origin}/api/plugins/${PLUGIN_ID}/rpc/getGraph`,
      token,
      { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ sessionId, workdir, projectId }) },
    )
    const execution = state?.result?.execution ?? null
    if (!execution) {
      setStatus('No workflow running in this session yet. Start one and the diagram will appear.')
      return
    }

    const query = new URLSearchParams()
    if (execution.workflowScope) query.set('scope', execution.workflowScope)
    if (workdir) query.set('workdir', workdir)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const [definition, agents] = await Promise.all([
      getJson(`${origin}/api/workflows/${encodeURIComponent(execution.workflowId)}${suffix}`, token),
      getJson(`${origin}/api/agents${workdir ? `?workdir=${encodeURIComponent(workdir)}` : ''}`, token).catch(() => null),
    ])

    const steps = toFlowSteps(definition)
    if (steps.length === 0) {
      setStatus('The workflow definition has no usable steps.', true)
      return
    }
    setStatus(describe(execution))

    root.render(
      <FlowDiagram
        steps={steps}
        entryStep={definition.entryStep ?? steps[0].id}
        selectedNodeId={null}
        selectedEdgeKey={null}
        startConditionLabel=""
        agentTypes={toAgentTypes(agents)}
        isReadOnly={true}
        onSelectNode={() => {}}
        onSelectEdge={() => {}}
        onRemoveStep={() => {}}
        onCreateTransition={() => {}}
        onReconnectTo={() => {}}
        onReconnectFrom={() => {}}
        onDeleteTransition={() => {}}
        runtime={buildRuntime(execution)}
      />,
    )
  } catch (error) {
    setStatus(String(error?.message ?? error), true)
  }
}

main()
