import type { OptionItem } from './schema'

type RemoteOptionCacheValue = any[]

type RemoteOptionResultCacheEntry<T extends RemoteOptionCacheValue> = {
  options: T
  expiresAt: number
}

const remoteOptionPromiseCache = new Map<
  string,
  Promise<RemoteOptionCacheValue | undefined>
>()
const remoteOptionResultCache = new Map<
  string,
  RemoteOptionResultCacheEntry<RemoteOptionCacheValue>
>()
const remoteOptionResultCacheTtl = 5 * 60 * 1000

export function getRemoteOptionPromise<
  T extends RemoteOptionCacheValue = OptionItem[],
>(cacheKey: string) {
  return remoteOptionPromiseCache.get(cacheKey) as
    | Promise<T | undefined>
    | undefined
}

export function setRemoteOptionPromise<
  T extends RemoteOptionCacheValue = OptionItem[],
>(
  cacheKey: string,
  promise: Promise<T | undefined>
) {
  remoteOptionPromiseCache.set(
    cacheKey,
    promise as Promise<RemoteOptionCacheValue | undefined>
  )
}

export function deleteRemoteOptionPromise(cacheKey: string) {
  remoteOptionPromiseCache.delete(cacheKey)
}

export function getCachedRemoteOptionResult<
  T extends RemoteOptionCacheValue = OptionItem[],
>(cacheKey: string) {
  const cached = remoteOptionResultCache.get(cacheKey)
  if (!cached) {
    return undefined
  }
  if (cached.expiresAt <= Date.now()) {
    remoteOptionResultCache.delete(cacheKey)
    return undefined
  }
  return cached.options as T
}

export function setCachedRemoteOptionResult<
  T extends RemoteOptionCacheValue = OptionItem[],
>(
  cacheKey: string,
  options: T
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
