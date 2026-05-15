import { useEffect, useMemo, useState } from 'react'
import {
  getCachedUploadRuleMetas,
  listUploadRuleMetas,
  type UploadRuleMeta,
} from '@/lib/upload'

export function useUploadRuleMetas(ruleIds: Array<number | string>) {
  const normalizedRuleKey = useMemo(() => {
    const ids = Array.from(
      new Set(
        (Array.isArray(ruleIds) ? ruleIds : [])
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
      )
    )

    return ids.join(',')
  }, [ruleIds])
  const currentRuleIds = useMemo(
    () => parseUploadRuleMetaKey(normalizedRuleKey),
    [normalizedRuleKey]
  )
  const [metas, setMetas] = useState<Map<number, UploadRuleMeta>>(() =>
    getCachedUploadRuleMetas(currentRuleIds)
  )

  useEffect(() => {
    let cancelled = false

    async function loadMetas() {
      if (currentRuleIds.length === 0) {
        setMetas((current) => (current.size === 0 ? current : new Map()))
        return
      }

      const cached = getCachedUploadRuleMetas(currentRuleIds)
      setMetas((current) =>
        sameUploadRuleMetaMap(current, cached) ? current : cached
      )

      try {
        const result = await listUploadRuleMetas(currentRuleIds)
        if (!cancelled) {
          setMetas(result)
        }
      } catch {
        if (!cancelled) {
          setMetas(new Map())
        }
      }
    }

    void loadMetas()

    return () => {
      cancelled = true
    }
  }, [currentRuleIds])

  return metas
}

function parseUploadRuleMetaKey(key: string) {
  return key
    ? key
        .split(',')
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    : []
}

function sameUploadRuleMetaMap(
  left: Map<number, UploadRuleMeta>,
  right: Map<number, UploadRuleMeta>
) {
  if (left.size !== right.size) {
    return false
  }
  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false
    }
  }
  return true
}
