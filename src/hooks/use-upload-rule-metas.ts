import { useEffect, useMemo, useState } from 'react'
import { listUploadRuleMetas, type UploadRuleMeta } from '@/lib/upload'

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
  const [metas, setMetas] = useState<Map<number, UploadRuleMeta>>(new Map())

  useEffect(() => {
    let cancelled = false
    const currentRuleIds = normalizedRuleKey
      ? normalizedRuleKey
          .split(',')
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
      : []

    async function loadMetas() {
      if (currentRuleIds.length === 0) {
        setMetas((current) => (current.size === 0 ? current : new Map()))
        return
      }

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
  }, [normalizedRuleKey])

  return metas
}
