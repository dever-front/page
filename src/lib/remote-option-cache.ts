import type { OptionItem } from './schema'

type RemoteOptionResultCacheEntry = {
  options: OptionItem[]
  expiresAt: number
}

const remoteOptionPromiseCache = new Map<
  string,
  Promise<OptionItem[] | undefined>
>()
const remoteOptionResultCache = new Map<string, RemoteOptionResultCacheEntry>()
const remoteOptionResultCacheTtl = 5 * 60 * 1000

export function getRemoteOptionPromise(cacheKey: string) {
  return remoteOptionPromiseCache.get(cacheKey)
}

export function setRemoteOptionPromise(
  cacheKey: string,
  promise: Promise<OptionItem[] | undefined>
) {
  remoteOptionPromiseCache.set(cacheKey, promise)
}

export function deleteRemoteOptionPromise(cacheKey: string) {
  remoteOptionPromiseCache.delete(cacheKey)
}

export function getCachedRemoteOptionResult(cacheKey: string) {
  const cached = remoteOptionResultCache.get(cacheKey)
  if (!cached) {
    return undefined
  }
  if (cached.expiresAt <= Date.now()) {
    remoteOptionResultCache.delete(cacheKey)
    return undefined
  }
  return cached.options
}

export function setCachedRemoteOptionResult(
  cacheKey: string,
  options: OptionItem[]
) {
  remoteOptionResultCache.set(cacheKey, {
    options,
    expiresAt: Date.now() + remoteOptionResultCacheTtl,
  })
}

export function clearRemoteOptionCache() {
  remoteOptionPromiseCache.clear()
  remoteOptionResultCache.clear()
}
