import {
  ensureNodePluginsForSchema,
  preloadImmediatePluginNodeComponents,
} from '@/lib/registry'
import { type PageSchemaType } from '@/lib/schema'

export async function preparePageSchema(schema: PageSchemaType) {
  await ensureNodePluginsForSchema(schema)
  // Keep the initial boot visible until plugin pages can render their own shell.
  await preloadImmediatePluginNodeComponents(schema)
}
