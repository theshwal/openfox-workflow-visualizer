/**
 * Local type shims for the vendored workflow diagram.
 *
 * The original files import these types from the host web app
 * (`web/src/lib/workflows-actions.ts`, `web/src/lib/agents-actions.ts`), which
 * is not an importable module. The shapes below are copied verbatim from those
 * files at the pinned upstream SHA — types only, no runtime code.
 */

export type WorkflowCondition =
  | { type: 'step_result'; result: string }
  | { type: 'metadata_all_match'; key?: string; value?: string }
  | { type: 'metadata_all_in'; key?: string; values?: string[] }
  | { type: string; [key: string]: unknown }

export interface WorkflowStep {
  id: string
  name: string
  type: 'agent' | 'sub_agent' | 'shell' | 'user' | 'parallel'
  phase: string
  transitions: Array<{ when: WorkflowCondition; goto: string; subGroup?: string }>
  agentId?: string
  subAgentType?: string
}

export interface AgentInfo {
  id: string
  name: string
  description: string
  subagent: boolean
  allowedTools: string[]
  color?: string
  results?: string[]
}
