import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResourceBrowser } from '@/components/resource/resource-browser'
import type { ResourceScope, ResourceUploadRule } from '@/lib/resource'
import type { UploadFileItem } from '@/lib/upload'

export type ResourcePickerDialogProps = {
  open: boolean
  title?: string
  description?: string
  bizKey?: string
  initialScope?: ResourceScope
  defaultKind?: string
  fixedKind?: boolean
  value?: UploadFileItem[]
  multiple?: boolean
  maxSelection?: number
  emptyText?: string
  uploadRules?: ResourceUploadRule[]
  allowUpload?: boolean
  assistantLayer?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (items: UploadFileItem[]) => void
}

const EMPTY_RESOURCE_PICKER_VALUE: UploadFileItem[] = []

export function ResourcePickerDialog({
  open,
  title = '资源库',
  description,
  bizKey,
  initialScope,
  defaultKind,
  fixedKind,
  value = EMPTY_RESOURCE_PICKER_VALUE,
  multiple = false,
  maxSelection = 1,
  emptyText,
  uploadRules = [],
  allowUpload = true,
  assistantLayer = false,
  onOpenChange,
  onConfirm,
}: ResourcePickerDialogProps) {
  const [selectedItems, setSelectedItems] = useState<UploadFileItem[]>(value)

  useEffect(() => {
    if (open) {
      setSelectedItems(value)
    }
  }, [open, value])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={assistantLayer ? 'z-[95]' : undefined}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ResourceBrowser
            bizKey={bizKey}
            initialScope={initialScope}
            defaultKind={defaultKind}
            fixedKind={fixedKind}
            cardDensity="compact"
            uploadRules={uploadRules}
            allowUpload={allowUpload}
            selectionMode={multiple ? 'multiple' : 'single'}
            selectedItems={selectedItems}
            maxSelection={multiple ? maxSelection : 1}
            emptyText={emptyText}
            onSelectedItemsChange={setSelectedItems}
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={selectedItems.length === 0}
            onClick={() => {
              onConfirm(selectedItems)
              onOpenChange(false)
            }}
          >
            使用所选资源
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
