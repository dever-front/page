import {
  ensureNodePluginsForSchema,
  preloadNodeComponents,
} from '@/lib/registry'
import { type PageSchemaType } from '@/lib/schema'

export async function preparePageSchema(schema: PageSchemaType) {
  await ensureNodePluginsForSchema(schema)
  if (import.meta.env.DEV) {
    return
  }
  await preloadNodeComponents(schema)
}
