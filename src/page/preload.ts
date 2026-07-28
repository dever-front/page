import { ensureNodePluginsForSchema } from '@/lib/registry'
import { type PageSchemaType } from '@/lib/schema'

export async function preparePageSchema(schema: PageSchemaType) {
  // Runtime plugins must register first; individual node chunks load in NodeItem Suspense.
  await ensureNodePluginsForSchema(schema)
}
