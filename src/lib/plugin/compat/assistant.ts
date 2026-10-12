import { assistantCompatSources as source } from './sources'

export const assistantCompatModuleLoaders = {
  [source.interactionPanel]: () =>
    import('@/components/agent/interaction-panel'),
  [source.streamRequestParams]: () =>
    import('@/components/agent/stream-request-params'),
  [source.formActions]: () => import('@/components/assistant/form-actions'),
  [source.memoryDialog]: () => import('@/components/assistant/memory-dialog'),
  [source.referencePicker]: () =>
    import('@/components/assistant/reference-picker'),
  [source.sessionHistoryDialog]: () =>
    import('@/components/assistant/session-history-dialog'),
  [source.taskPopover]: () => import('@/components/assistant/task-popover'),
  [source.agentResultProtocol]: () => import('@/lib/agent-result-protocol'),
  [source.agentRunner]: () => import('@/lib/agent/runner'),
  [source.assistantContext]: () => import('@/lib/assistant/context'),
  [source.assistantReference]: () => import('@/lib/assistant/reference'),
}
