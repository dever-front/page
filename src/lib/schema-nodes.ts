import type { PageSchemaType } from '@/lib/schema'

type NodeLike = {
  type?: unknown
  items?: unknown
  meta?: {
    openPath?: unknown
  }
}

export function collectSchemaNodeTypes(
  schema: PageSchemaType | null | undefined
) {
  return collectNodeTypesFromSchema(schema, false)
}

export function collectImmediateSchemaNodeTypes(
  schema: PageSchemaType | null | undefined
) {
  return collectNodeTypesFromSchema(schema, true)
}

function collectNodeTypesFromSchema(
  schema: PageSchemaType | null | undefined,
  skipDeferredNodes: boolean
) {
  const types = new Set<string>()
  if (!schema) {
    return []
  }

  for (const items of Object.values(schema.nodes ?? {})) {
    if (!Array.isArray(items)) {
      continue
    }
    for (const item of items) {
      collectNodeTypes(item as NodeLike, types, skipDeferredNodes)
    }
  }

  return Array.from(types)
}

function collectNodeTypes(
  node: NodeLike | null | undefined,
  types: Set<string>,
  skipDeferredNodes: boolean
) {
  if (!node || typeof node !== 'object') {
    return
  }

  if (skipDeferredNodes && hasOpenPath(node)) {
    return
  }

  addType(types, node.type)

  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      collectNodeTypes(child as NodeLike, types, skipDeferredNodes)
    }
  }
}

function hasOpenPath(node: NodeLike) {
  return String(node.meta?.openPath || '').trim() !== ''
}

function addType(types: Set<string>, value: unknown) {
  const type = String(value || '').trim()
  if (type) {
    types.add(type)
  }
}
