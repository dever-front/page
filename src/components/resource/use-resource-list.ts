import { useEffect, useState } from 'react'
import { listResources } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'

export type ResourceListFilters = {
  page: number
  pageSize: number
  kind: string
  keyword: string
  fileType: string
  sourceKey: string
  categoryId: string
}

export function useResourceList(
  filters: ResourceListFilters,
  effectiveKind: string,
  refreshVersion: string | number
) {
  const [resources, setResources] = useState<UploadFileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadResourceList() {
      setLoading(true)
      setErrorMessage('')

      try {
        const result = await listResources({
          page: filters.page,
          pageSize: filters.pageSize,
          bizKey: filters.sourceKey,
          kind: effectiveKind,
          keyword: filters.keyword,
          fileType: filters.fileType,
          categoryId: filters.categoryId,
        })

        if (cancelled) {
          return
        }

        setResources(result.list)
        setTotal(result.total)
      } catch (error) {
        if (cancelled) {
          return
        }

        setResources([])
        setTotal(0)
        setErrorMessage(error instanceof Error ? error.message : '加载资源失败')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadResourceList()

    return () => {
      cancelled = true
    }
  }, [effectiveKind, filters, refreshVersion])

  return {
    resources,
    total,
    loading,
    errorMessage,
  }
}
