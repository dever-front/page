import { useEffect, useState } from 'react'
import {
  buildFilterSourceItems,
  listResourceCategories,
  listResourceSources,
  type ResourceCategoryItem,
  type ResourceSourceItem,
} from '@/lib/resource'

type UseResourceCatalogInput = {
  sourceKey: string
  effectiveKind: string
  normalizedBizKey: string
  normalizedBizName: string
  refreshVersion: string | number
  sourceVersion: number
}

export function useResourceCatalog({
  sourceKey,
  effectiveKind,
  normalizedBizKey,
  normalizedBizName,
  refreshVersion,
  sourceVersion,
}: UseResourceCatalogInput) {
  const [categories, setCategories] = useState<ResourceCategoryItem[]>([])
  const [sources, setSources] = useState<ResourceSourceItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const result = await listResourceCategories({
          bizKey: sourceKey,
          kind: effectiveKind,
        })
        if (!cancelled) {
          setCategories(result)
        }
      } catch {
        if (!cancelled) {
          setCategories([])
        }
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [effectiveKind, refreshVersion, sourceKey])

  useEffect(() => {
    let cancelled = false

    async function loadSources() {
      try {
        const result = await listResourceSources({
          kind: effectiveKind,
        })
        if (!cancelled) {
          setSources(buildFilterSourceItems(result, normalizedBizKey, normalizedBizName))
        }
      } catch {
        if (!cancelled) {
          setSources(buildFilterSourceItems([], normalizedBizKey, normalizedBizName))
        }
      }
    }

    void loadSources()

    return () => {
      cancelled = true
    }
  }, [effectiveKind, normalizedBizKey, normalizedBizName, refreshVersion, sourceVersion])

  return {
    categories,
    sources,
  }
}
