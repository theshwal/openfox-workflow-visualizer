// src/state.js
var GRAPH_PANEL_ID = "workflow-visualizer-graph";
var ACTIVE_STATUSES = /* @__PURE__ */ new Set(["running", "waiting"]);
function createStore() {
  const bySession = /* @__PURE__ */ new Map();
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
      if (!sessionId || !data || typeof data !== "object") return null;
      const executionId = typeof data.executionId === "string" ? data.executionId : "";
      if (!executionId) return null;
      const previous = bySession.get(sessionId);
      if (previous && previous.executionId !== executionId) {
        const previousActive = ACTIVE_STATUSES.has(previous.status);
        if (previousActive) return previous;
      }
      const next = {
        executionId,
        workflowId: typeof data.workflowId === "string" ? data.workflowId : previous?.workflowId ?? "",
        workflowName: typeof data.workflowName === "string" ? data.workflowName : previous?.workflowName ?? "Workflow",
        status: typeof data.status === "string" ? data.status : "running",
        updatedAt: Date.now(),
        ...typeof data.workflowColor === "string" ? { workflowColor: data.workflowColor } : {},
        ...typeof data.currentStepId === "string" ? { currentStepId: data.currentStepId } : {},
        ...typeof data.currentStepName === "string" ? { currentStepName: data.currentStepName } : {},
        ...typeof data.workflowScope === "string" ? { workflowScope: data.workflowScope } : {},
        ...typeof data.iterations === "number" ? { iterations: data.iterations } : {},
        ...typeof data.totalIterations === "number" ? { totalIterations: data.totalIterations } : {},
        ...typeof data.maxIterations === "number" ? { maxIterations: data.maxIterations } : {},
        ...isStepCounts(data.stepIterations) ? { stepIterations: { ...data.stepIterations } } : {}
      };
      bySession.set(sessionId, next);
      return next;
    },
    /**
     * @param {string} sessionId
     * @returns {WorkflowExecutionSnapshot | null}
     */
    read(sessionId) {
      if (!sessionId) return null;
      return bySession.get(sessionId) ?? null;
    },
    /** Test/teardown helper. */
    clear() {
      bySession.clear();
    }
  };
}
function isStepCounts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((count) => typeof count === "number");
}
function isVisible(execution) {
  return execution !== null && ACTIVE_STATUSES.has(execution.status);
}
function iterationLabel(execution) {
  const { iterations, maxIterations, totalIterations } = execution;
  if (typeof iterations !== "number") return null;
  const capped = typeof maxIterations === "number";
  const suffixEn = totalIterations !== void 0 && totalIterations > iterations ? ` \xB7 ${totalIterations} total` : "";
  const suffixFr = totalIterations !== void 0 && totalIterations > iterations ? ` \xB7 ${totalIterations} au total` : "";
  if (capped) {
    return { en: `iteration ${iterations}/${maxIterations}${suffixEn}`, fr: `it\xE9ration ${iterations}/${maxIterations}${suffixFr}` };
  }
  const plural = iterations === 1 ? "" : "s";
  return {
    en: `${iterations} iteration${plural}${suffixEn}`,
    fr: `${iterations} it\xE9ration${plural}${suffixFr}`
  };
}
function stepRows(execution) {
  const counts = execution.stepIterations;
  if (!counts) return [];
  return Object.entries(counts).filter(([, count]) => typeof count === "number").sort((a, b) => b[1] - a[1]).map(([stepId, count]) => ({
    key: { en: stepId === execution.currentStepId ? `\u25B6 ${stepId}` : stepId, fr: stepId === execution.currentStepId ? `\u25B6 ${stepId}` : stepId },
    value: String(count)
  }));
}
function buildComposerNode(execution) {
  const active = isVisible(execution) && execution !== null;
  if (!active) {
    return {
      type: "stack",
      direction: "row",
      gap: "sm",
      align: "center",
      // Never let the zone's other contributions squeeze the entry point away.
      className: "shrink-0",
      children: [
        {
          type: "button",
          label: { en: "Workflow graph", fr: "Graphe du workflow" },
          title: {
            en: "Open the workflow graph \u2014 no workflow is running in this session yet",
            fr: "Ouvrir le graphe du workflow \u2014 aucun workflow ne tourne dans cette session"
          },
          variant: "pill",
          action: { kind: "openPanel", panelId: GRAPH_PANEL_ID }
        }
      ]
    };
  }
  const children = [
    {
      type: "badge",
      label: { en: execution.workflowName, fr: execution.workflowName },
      ...execution.workflowColor ? { color: execution.workflowColor } : {},
      tone: "info"
    }
  ];
  if (execution.currentStepName) {
    children.push({ type: "text", text: { en: `\xB7 ${execution.currentStepName}`, fr: `\xB7 ${execution.currentStepName}` }, muted: true });
  }
  const counter = iterationLabel(execution);
  if (counter) {
    children.push({ type: "text", text: counter, muted: true });
  }
  children.push({
    type: "button",
    label: { en: "Graph", fr: "Graphe" },
    title: { en: "Open the workflow graph", fr: "Ouvrir le graphe du workflow" },
    variant: "ghost",
    action: { kind: "openPanel", panelId: GRAPH_PANEL_ID }
  });
  return { type: "stack", direction: "row", gap: "sm", align: "center", className: "shrink-0", children };
}
function buildPanelNodes(execution) {
  if (!isVisible(execution) || execution === null) {
    return [
      {
        type: "callout",
        tone: "info",
        title: { en: "No workflow running", fr: "Aucun workflow en cours" },
        text: {
          en: "Start a workflow: its live step and iteration counters appear above the composer.",
          fr: "Lancez un workflow : son \xE9tape et ses compteurs d\u2019it\xE9rations apparaissent au-dessus du compositeur."
        }
      }
    ];
  }
  const items = [
    { key: { en: "Workflow", fr: "Workflow" }, value: execution.workflowName },
    { key: { en: "Status", fr: "Statut" }, value: execution.status }
  ];
  if (execution.currentStepName) {
    items.push({ key: { en: "Current step", fr: "\xC9tape courante" }, value: execution.currentStepName });
  }
  const counter = iterationLabel(execution);
  if (counter) {
    items.push({ key: { en: "Iterations", fr: "It\xE9rations" }, value: counter.en });
  }
  if (execution.workflowScope) {
    items.push({ key: { en: "Scope", fr: "Port\xE9e" }, value: execution.workflowScope });
  }
  const nodes = [
    { type: "keyValue", items }
  ];
  const rows = stepRows(execution);
  if (rows.length > 0) {
    nodes.push({
      type: "table",
      columns: [{ en: "Step", fr: "\xC9tape" }, { en: "Runs", fr: "Ex\xE9cutions" }],
      rows: rows.map((row) => [row.key.en, row.value])
    });
  } else {
    nodes.push({
      type: "text",
      text: {
        en: "The engine has not reported per-step counts yet.",
        fr: "Le moteur n\u2019a pas encore rapport\xE9 de compteurs par \xE9tape."
      },
      muted: true
    });
  }
  return nodes;
}

// src/index.js
var RPC_STATE = "workflow-visualizer.state";
var RPC_GRAPH = "workflow-visualizer.graph";
var RPC_GET_GRAPH = "getGraph";
var GRAPH_HTML = "assets/graph.html";
var GRAPH_JS = "assets/graph.js";
var PANEL_ID = "workflow-visualizer-progress";
var COMPONENT_ID = "workflow-visualizer-bar";
var ZONE = "composer.top";
var REFRESH_MS = 1500;
function sessionIdOf(params, context) {
  if (typeof params.sessionId === "string" && params.sessionId) return params.sessionId;
  const fromContext = context && typeof context === "object" ? (
    /** @type {Record<string, unknown>} */
    context.sessionId
  ) : void 0;
  return typeof fromContext === "string" ? fromContext : "";
}
function register(registry) {
  const store = createStore();
  registry.registerHook("workflow.execution.changed", (payload) => {
    store.apply(payload.sessionId, payload.data);
  });
  registry.registerRpc(RPC_STATE, (params, context) => {
    const sessionId = sessionIdOf(params, context);
    const execution = store.read(sessionId);
    return { content: buildComposerNode(execution) };
  });
  registry.registerRpc(RPC_GRAPH, (params, context) => {
    const sessionId = sessionIdOf(params, context);
    return { nodes: buildPanelNodes(store.read(sessionId)) };
  });
  registry.registerUiComponent({
    id: COMPONENT_ID,
    zone: ZONE,
    order: 0,
    component: { type: "stack", direction: "row", gap: "sm", children: [] },
    contentSource: { kind: "rpc", method: RPC_STATE, refreshMs: REFRESH_MS }
  });
  registry.registerRpc(RPC_GET_GRAPH, (params, context) => {
    const sessionId = sessionIdOf(params, context);
    const execution = store.read(sessionId);
    return { execution: execution ? { ...execution } : null };
  });
  registry.registerRpc("initPanel", (params, context) => {
    const sessionId = sessionIdOf(params, context);
    return { content: buildPanelNodes(store.read(sessionId)) };
  });
  registry.registerAsset(GRAPH_HTML);
  registry.registerAsset(GRAPH_JS);
  registry.registerUiPanel({
    id: GRAPH_PANEL_ID,
    title: { en: "Workflow graph", fr: "Graphe du workflow" },
    size: "xl",
    kind: "iframe",
    url: GRAPH_HTML
  });
  registry.registerUiPanel({
    id: PANEL_ID,
    title: { en: "Workflow progress", fr: "Progression du workflow" },
    size: "md",
    kind: "declarative",
    content: buildPanelNodes(null)
  });
  return {
    /** @param {string} sessionId */
    snapshot: (sessionId) => store.read(sessionId),
    /** @param {string} sessionId */
    hasActiveRun: (sessionId) => isVisible(store.read(sessionId)),
    store
  };
}
export {
  COMPONENT_ID,
  GRAPH_HTML,
  GRAPH_JS,
  GRAPH_PANEL_ID,
  PANEL_ID,
  REFRESH_MS,
  RPC_GET_GRAPH,
  RPC_GRAPH,
  RPC_STATE,
  ZONE,
  register
};
