import { loadAssistantPermissionContext } from '@/lib/request'
import type { AssistantPermissionContext } from './actions'

const EMPTY_ASSISTANT_PERMISSION_CONTEXT: AssistantPermissionContext = {
  menu: [],
  entry: '',
  permissions: [],
}

export async function loadAssistantPermissionContextSafe(): Promise<AssistantPermissionContext> {
  try {
    return await loadAssistantPermissionContext()
  } catch {
    return emptyAssistantPermissionContext()
  }
}

export function emptyAssistantPermissionContext(): AssistantPermissionContext {
  return {
    menu: [...EMPTY_ASSISTANT_PERMISSION_CONTEXT.menu],
    entry: EMPTY_ASSISTANT_PERMISSION_CONTEXT.entry,
    permissions: [...EMPTY_ASSISTANT_PERMISSION_CONTEXT.permissions],
  }
}

export function buildAssistantPermissionPayload(
  permissionContext?: AssistantPermissionContext | null
) {
  const permissions = permissionContext?.permissions ?? []
  return {
    entry: permissionContext?.entry || '',
    menu: permissionContext?.menu ?? [],
    items: permissions.map((item) => ({
      key: item.key,
      name: item.name,
      path: item.path || '',
      parent_key: item.parent_key || '',
      type: item.type ?? 0,
      query: item.query,
    })),
  }
}
