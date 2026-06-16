import { loadPageSchema } from './request'
import { validatePageSchema } from './schema'
import type { PageStore } from './store'

export async function reloadStorePageSchema(store: PageStore) {
  const route = resolveStorePageRoute(store)
  if (!route) {
    return false
  }

  const raw = await loadPageSchema(route, { skipValueCache: true })
  if (!raw) {
    return false
  }

  store.getState().reset(validatePageSchema(raw))
  return true
}

function resolveStorePageRoute(store: PageStore) {
  const state = store.getState()
  return String(state.pagePath || state.schema.page?.route || '').trim()
}
