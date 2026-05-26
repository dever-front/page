export const RUN_EVENT = {
  start: 'start',
  progress: 'progress',
  status: 'status',
  warning: 'warning',
  delta: 'delta',
  result: 'result',
  cancel: 'cancel',
  runStarted: 'run_started',
  runFinished: 'run_finished',
  thinkStarted: 'think_started',
  thinkFinished: 'think_finished',
  nodeStarted: 'node_started',
  nodeOutput: 'node_output',
  nodeFinished: 'node_finished',
  edgeActive: 'edge_active',
  waiting: 'waiting',
} as const

export const RUN_FEATURE = {
  power: 'power',
  agent: 'agent',
  brain: 'brain',
  think: 'think',
  upload: 'upload',
  skill: 'skill',
  energon: 'energon',
} as const

export const RUN_EVENT_TYPE = {
  lifecycle: 'lifecycle',
  progress: 'progress',
  output: 'output',
  result: 'result',
  edge: 'edge',
  waiting: 'waiting',
} as const

export type RunEventType = (typeof RUN_EVENT)[keyof typeof RUN_EVENT]
export type RunFeatureType = (typeof RUN_FEATURE)[keyof typeof RUN_FEATURE]
export type RunEventKind = (typeof RUN_EVENT_TYPE)[keyof typeof RUN_EVENT_TYPE]

export type RunEventOutput = {
  event?: RunEventType | string
  feature?: RunFeatureType | string
  event_type?: RunEventKind | string
  scope?: 'run' | 'think' | 'node' | 'edge' | string
  status?: string
  run_id?: number
  brain_id?: number
  release_id?: number
  think_run_id?: number
  think_id?: number
  think_key?: string
  think_name?: string
  node_run_id?: number
  node_id?: number
  node_key?: string
  node_name?: string
  node_type?: string
  edge_id?: number
  from_node_id?: number
  from_node_key?: string
  to_node_id?: number
  to_node_key?: string
  condition?: string
  input?: unknown
  output?: unknown
  error?: string
  meta?: Record<string, unknown>
}
