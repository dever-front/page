import type { PageSchemaType } from '@/lib/schema'

type NodeLike = {
  type?: unknown
  items?: unknown
}

export function collectSchemaNodeTypes(
  schema: PageSchemaType | null | undefined
) {
  return collectNodeTypesFromSchema(schema)
}

function collectNodeTypesFromSchema(schema: PageSchemaType | null | undefined) {
  const types = new Set<string>()
  if (!schema) {
    return []
  }

  for (const items of Object.values(schema.nodes ?? {})) {
    if (!Array.isArray(items)) {
      continue
    }
    for (const item of items) {
      collectNodeTypes(item as NodeLike, types)
    }
  }

  return Array.from(types)
}

function collectNodeTypes(
  node: NodeLike | null | undefined,
  types: Set<string>
) {
  if (!node || typeof node !== 'object') {
    return
  }

  addType(types, node.type)

  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      collectNodeTypes(child as NodeLike, types)
    }
  }
}

function addType(types: Set<string>, value: unknown) {
  const type = String(value || '').trim()
  if (type) {
    types.add(type)
  }
}
