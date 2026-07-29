import {
  ensureNodePluginsForSchema,
  preloadImmediateNodeComponents,
} from '@/lib/registry'
import { type PageSchemaType } from '@/lib/schema'

export async function preparePageSchema(schema: PageSchemaType) {
  await ensureNodePluginsForSchema(schema)
  await preloadImmediateNodeComponents(schema)
}
