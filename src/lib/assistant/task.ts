import {
  assistantReferencePayload,
  type AssistantReferenceFile,
} from './reference'
import type { AssistantFieldContext } from './context'

export type AssistantFormTaskMode = 'field' | 'form' | 'paste'

export type AssistantFormTaskOptions = {
  mode: AssistantFormTaskMode
  field?: AssistantFieldContext
  instruction?: string
  sourceText?: string
  references?: AssistantReferenceFile[]
  overwrite?: boolean
}

export function withAssistantTaskReferences<TTask extends Record<string, unknown>>(
  task: TTask,
  references?: AssistantReferenceFile[]
): TTask & { reference_files?: AssistantReferenceFile[] } {
  const referenceFiles = assistantReferencePayload(references)
  if (!referenceFiles) {
    return task
  }
  return {
    ...task,
    reference_files: referenceFiles,
  }
}

export function mergeAssistantTaskReferences(
  task: Record<string, unknown> | undefined,
  references?: AssistantReferenceFile[],
  fallbackType = 'assistant_chat'
) {
  const referenceFiles = assistantReferencePayload(references)
  if (!task && !referenceFiles) {
    return undefined
  }
  const nextTask = {
    type: task?.type || fallbackType,
    ...(task ?? {}),
  }
  return referenceFiles
    ? {
        ...nextTask,
        reference_files: referenceFiles,
      }
    : nextTask
}

export function buildAssistantFormFillTask({
  mode,
  field,
  instruction,
  sourceText,
  references,
  overwrite = false,
}: AssistantFormTaskOptions) {
  const fillCurrentForm = mode !== 'field'

  return withAssistantTaskReferences(
    {
      type:
        mode === 'field'
          ? 'generate_form_field'
          : mode === 'paste'
            ? 'parse_and_fill_current_form'
            : 'fill_current_form',
      target_field: field,
      instruction: String(instruction || '').trim() || undefined,
      source_text: String(sourceText || '').trim() || undefined,
      fill_mode: overwrite ? 'overwrite' : 'empty_only',
      allowed_action_types: fillCurrentForm ? ['patch_form'] : ['fill_form'],
      save: false,
    },
    references
  )
}
