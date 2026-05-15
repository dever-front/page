import { useMemo, useState } from 'react'
import { ResourcePreviewDialogLazy } from '@/components/resource/lazy-dialogs'
import type { UploadFileItem } from '@/lib/upload'

type UseResourcePreviewDialogOptions = {
  title?: string
  description?: string
}

export function useResourcePreviewDialog(
  inputItems: UploadFileItem[],
  options?: UseResourcePreviewDialogOptions
) {
  const items = useMemo(
    () => (Array.isArray(inputItems) ? inputItems.filter(Boolean) : []),
    [inputItems]
  )
  const [open, setOpen] = useState(false)
  const [initialItemId, setInitialItemId] = useState<string | number | undefined>()

  const openPreview = (itemId?: string | number) => {
    if (items.length === 0) {
      return
    }
    setInitialItemId(itemId ?? items[0]?.id)
    setOpen(true)
  }

  const previewDialog = (
    <ResourcePreviewDialogLazy
      open={open}
      title={options?.title}
      description={options?.description}
      items={items}
      initialItemId={initialItemId}
      onOpenChange={setOpen}
    />
  )

  return {
    openPreview,
    previewDialog,
    hasItems: items.length > 0,
  }
}
