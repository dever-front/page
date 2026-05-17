import type {
  AgentInteraction,
  AgentInteractionSubmitResult,
} from '@/lib/agent/types'
import { streamValueText } from '@/lib/stream'

export function normalizeAssistantInteraction(
  output: Record<string, unknown>
): AgentInteraction | undefined {
  const interaction = output?.interaction
  if (!isPlainRecord(interaction)) {
    return undefined
  }
  const type = streamValueText(interaction.type)
  if (!type) {
    return undefined
  }
  return {
    ...interaction,
    type,
    id: streamValueText(interaction.id) || undefined,
    power: streamValueText(interaction.power) || undefined,
    title: streamValueText(interaction.title) || undefined,
    description: streamValueText(interaction.description) || undefined,
  } as AgentInteraction
}

export function buildAssistantInteractionInput(
  interaction: AgentInteraction,
  result: AgentInteractionSubmitResult
) {
  return {
    type: 'interaction_result',
    interaction_id: interaction.id || '',
    interaction_type: interaction.type || '',
    interaction,
    data: result.data,
    text: result.text,
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
