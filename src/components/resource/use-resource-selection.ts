import { useEffect, useMemo, useState } from 'react'
import {
  isSameUploadSelectionItem,
  resolveUploadSelectionKeys,
} from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'

type ResourceSelectionMode = 'browse' | 'single' | 'multiple'

type UseResourceSelectionInput = {
  resources: UploadFileItem[]
  selectionMode: ResourceSelectionMode
  allowBatchSelect: boolean
  selectedItems: UploadFileItem[]
  maxSelection: number
  onSelectedItemsChange?: (items: UploadFileItem[]) => void
}

export function useResourceSelection({
  resources,
  selectionMode,
  allowBatchSelect,
  selectedItems,
  maxSelection,
  onSelectedItemsChange,
}: UseResourceSelectionInput) {
  const [browseSelectedItems, setBrowseSelectedItems] = useState<UploadFileItem[]>([])
  const canSelect = selectionMode !== 'browse' && !!onSelectedItemsChange
  const canBatchSelect = selectionMode === 'browse' && allowBatchSelect
  const currentSelectedItems = canSelect ? selectedItems : browseSelectedItems
  const selectedKeys = useMemo(
    () => new Set(currentSelectedItems.flatMap((item) => resolveUploadSelectionKeys(item))),
    [currentSelectedItems]
  )

  useEffect(() => {
    if (!canBatchSelect) {
      return
    }

    setBrowseSelectedItems((current) =>
      current.filter((item) =>
        resources.some((resource) => isSameUploadSelectionItem(item, resource))
      )
    )
  }, [canBatchSelect, resources])

  const handleSelectResource = (item: UploadFileItem) => {
    if (canBatchSelect) {
      setBrowseSelectedItems((current) =>
        toggleMultipleSelection(current, item, Math.max(resources.length, 1))
      )
      return
    }

    if (!canSelect) {
      return
    }

    if (selectionMode === 'single') {
      const alreadySelected = resolveUploadSelectionKeys(item).some((current) =>
        selectedKeys.has(current)
      )
      onSelectedItemsChange?.(alreadySelected ? [] : [item])
      return
    }

    const nextItems = toggleMultipleSelection(selectedItems, item, maxSelection)
    onSelectedItemsChange?.(nextItems)
  }

  const isSelectedResource = (item: UploadFileItem) =>
    resolveUploadSelectionKeys(item).some((current) => selectedKeys.has(current))

  return {
    canSelect,
    canBatchSelect,
    browseSelectedItems,
    setBrowseSelectedItems,
    handleSelectResource,
    isSelectedResource,
  }
}

function toggleMultipleSelection(
  currentItems: UploadFileItem[],
  targetItem: UploadFileItem,
  maxSelection: number
) {
  const exists = currentItems.some((item) => isSameUploadSelectionItem(item, targetItem))
  if (exists) {
    return currentItems.filter((item) => !isSameUploadSelectionItem(item, targetItem))
  }

  return [...currentItems, targetItem].slice(0, Math.max(maxSelection, 1))
}
