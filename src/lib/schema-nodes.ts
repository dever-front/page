import type { LayoutNode, PageSchemaType } from '@/lib/schema'

type NodeLike = {
  type?: unknown
  items?: unknown
}

export function collectSchemaNodeTypes(
  schema: PageSchemaType | null | undefined
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
      collectNodeTypes(item as NodeLike, types)
    }
  }

  return Array.from(types)
}

export function collectLayoutPageRoutes(
  schema: PageSchemaType | null | undefined
) {
  const routes = new Set<string>()
  collectLayoutRoutes(schema?.layout, routes)
  return Array.from(routes)
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

function collectLayoutRoutes(
  layout: LayoutNode | null | undefined,
  routes: Set<string>
) {
  if (!layout || typeof layout !== 'object') {
    return
  }

  const path = String(layout.path || '').trim()
  if (path.startsWith('/')) {
    routes.add(path)
  }

  for (const child of Object.values(layout.children ?? {})) {
    collectLayoutRoutes(child, routes)
  }
}
