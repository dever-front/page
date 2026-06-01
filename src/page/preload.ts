import {
  ensureNodePluginsForSchema,
  preloadNodeComponents,
} from '@/lib/registry'
import { loadPageSchema } from '@/lib/request'
import { validatePageSchema, type PageSchemaType } from '@/lib/schema'
import { collectLayoutPageRoutes } from '@/lib/schema-nodes'

const MAX_NESTED_PRELOAD_DEPTH = 1

export async function preparePageSchema(schema: PageSchemaType) {
  await ensureNodePluginsForSchema(schema)
  if (import.meta.env.DEV) {
    return
  }
  await Promise.allSettled([
    preloadNodeComponents(schema),
    preloadNestedPageSchemas(schema, MAX_NESTED_PRELOAD_DEPTH),
  ])
}

async function preloadNestedPageSchemas(
  schema: PageSchemaType,
  depth: number,
  activeRoutes = new Set<string>()
) {
  if (depth <= 0) {
    return
  }

  await Promise.allSettled(
    collectLayoutPageRoutes(schema).map((route) =>
      preloadNestedPageSchema(route, depth - 1, activeRoutes)
    )
  )
}

async function preloadNestedPageSchema(
  route: string,
  depth: number,
  activeRoutes: Set<string>
) {
  if (activeRoutes.has(route)) {
    return
  }

  activeRoutes.add(route)
  try {
    const raw = await loadPageSchema(route)
    if (!raw) {
      return
    }
    const schema = validatePageSchema(raw)
    await ensureNodePluginsForSchema(schema)
    await preloadNodeComponents(schema)
    await preloadNestedPageSchemas(schema, depth, activeRoutes)
  } finally {
    activeRoutes.delete(route)
  }
}
