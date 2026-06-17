/**
 * Show/Page.tsx - 分页节点
 * 将分页从表格中独立出来，便于列表和其他数据视图复用
 */
import { useEffect, useMemo } from 'react'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, getPageNumbers } from '@/lib/utils'
import { normalizeDataContainerKey, reloadStoreDataContainer } from '@/lib/page-data-reload'
import type { NodeItemProps } from '../../nodes'
import type { Item } from '@/lib/schema'
import { useStorePathValue } from '@/lib/store'
import { useStore } from 'zustand'

export function ShowPage({ item, value, store, layoutId }: NodeItemProps) {
  const linkedTable = useLinkedTable(store, item.meta?.tableLayoutId ?? layoutId)
  const dataPath = item.value ?? linkedTable?.value
  const pagePath = item.meta?.pagePath ?? linkedTable?.meta?.pagePath
  const pageSizePath = item.meta?.pageSizePath ?? linkedTable?.meta?.pageSizePath
  const totalPath = item.meta?.totalPath ?? linkedTable?.meta?.totalPath
  const isRemote = item.meta?.remote === true || linkedTable?.meta?.remote === true
  const reloadKey = normalizeDataContainerKey(
    String(item.meta?.reloadDataKey || linkedTable?.meta?.reloadDataKey || 'table')
  )
  const dataFromPath = useStoreValue(store, dataPath)
  const data = Array.isArray(value) ? value : dataFromPath
  const rows = Array.isArray(data) ? data : []
  const currentPage = Number(useStoreValue(store, pagePath) ?? 1)
  const pageSize = Number(useStoreValue(store, pageSizePath) ?? 10)
  const totalValue = Number(useStoreValue(store, totalPath) ?? rows.length)
  const pageSizeOptions = item.meta?.pageSizeOptions || [10, 20, 30, 40, 50]
  const totalRows = isRemote ? totalValue : rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const pageNumbers = useMemo(
    () => getPageNumbers(safePage, totalPages),
    [safePage, totalPages]
  )

  useEffect(() => {
    if (!pagePath) return
    if (currentPage !== safePage) {
      store.getState().setValueByPath(pagePath, safePage)
    }
  }, [currentPage, pagePath, safePage, store])

  const setPage = async (nextPage: number) => {
    if (!pagePath) return
    store.getState().setValueByPath(pagePath, nextPage)
    if (isRemote) {
      await reloadStoreDataContainer(store, reloadKey)
    }
  }

  const setPageSize = async (nextPageSize: string) => {
    if (!pageSizePath) return
    store.getState().setValueByPath(pageSizePath, Number(nextPageSize))
    if (pagePath) {
      store.getState().setValueByPath(pagePath, 1)
    }
    if (isRemote) {
      await reloadStoreDataContainer(store, reloadKey)
    }
  }

  if (totalRows === 0 || totalPages <= 1 || totalRows <= pageSize) {
    return null
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        item.className
      )}
    >
      <div className="flex items-center gap-3">
        <Select value={String(pageSize)} onValueChange={(nextValue) => void setPageSize(nextValue)}>
          <SelectTrigger className="h-10 w-[92px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option: number) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-foreground">每页条数</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <span className="text-sm text-foreground">
          第 {safePage} 页，共 {totalPages} 页
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={safePage <= 1}
            onClick={() => void setPage(1)}
          >
            <ChevronsLeft size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={safePage <= 1}
            onClick={() => void setPage(safePage - 1)}
          >
            <ChevronLeft size={16} />
          </Button>

          {pageNumbers.map((pageNumber, index) =>
            pageNumber === '...' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === safePage ? 'default' : 'outline'}
                className="size-10"
                onClick={() => void setPage(Number(pageNumber))}
              >
                {pageNumber}
              </Button>
            )
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={safePage >= totalPages}
            onClick={() => void setPage(safePage + 1)}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={safePage >= totalPages}
            onClick={() => void setPage(totalPages)}
          >
            <ChevronsRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

function useLinkedTable(store: NodeItemProps['store'], layoutId?: string) {
  return useStore(store, (state) => {
    if (!layoutId) return undefined
    const items = state.schema.nodes?.[layoutId]
    if (!items?.length) return undefined
    return items.find((node) => node.type === 'show-table') as Item | undefined
  })
}

function useStoreValue(store: NodeItemProps['store'], path?: string) {
  return useStorePathValue(store, path)
}
