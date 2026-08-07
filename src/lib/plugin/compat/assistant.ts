import * as interactionPanel from '@/components/agent/interaction-panel'
import * as streamRequestParams from '@/components/agent/stream-request-params'
import * as formActions from '@/components/assistant/form-actions'
import * as memoryDialog from '@/components/assistant/memory-dialog'
import * as referencePicker from '@/components/assistant/reference-picker'
import * as sessionHistoryDialog from '@/components/assistant/session-history-dialog'
import * as taskPopover from '@/components/assistant/task-popover'
import * as agentResultProtocol from '@/lib/agent-result-protocol'
import * as agentRunner from '@/lib/agent/runner'
import * as assistantContext from '@/lib/assistant/context'
import * as assistantReference from '@/lib/assistant/reference'
import { assistantCompatSources as source } from './sources'

export const compatModules = {
  [source.interactionPanel]: interactionPanel,
  [source.streamRequestParams]: streamRequestParams,
  [source.formActions]: formActions,
  [source.memoryDialog]: memoryDialog,
  [source.referencePicker]: referencePicker,
  [source.sessionHistoryDialog]: sessionHistoryDialog,
  [source.taskPopover]: taskPopover,
  [source.agentResultProtocol]: agentResultProtocol,
  [source.agentRunner]: agentRunner,
  [source.assistantContext]: assistantContext,
  [source.assistantReference]: assistantReference,
}
