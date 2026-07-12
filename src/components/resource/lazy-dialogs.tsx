import { lazy, Suspense } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ASSISTANT_DIALOG_LAYER_CLASS } from '@/lib/floating-layer'
import type { ResourcePickerDialogProps } from './resource-picker-dialog'
import type { ResourcePreviewDialogProps } from './resource-preview-dialog'

const LazyResourcePickerDialog = lazy(() =>
  import('./resource-picker-dialog').then((mod) => ({
    default: mod.ResourcePickerDialog,
  }))
)

const LazyResourcePreviewDialog = lazy(() =>
  import('./resource-preview-dialog').then((mod) => ({
    default: mod.ResourcePreviewDialog,
  }))
)

export function ResourcePickerDialogLazy(props: ResourcePickerDialogProps) {
  if (!props.open) {
    return null
  }

  return (
    <Suspense
      fallback={
        <ResourceDialogFallback
          open={props.open}
          title={props.title || '资源库'}
          description={props.description}
          assistantLayer={props.assistantLayer}
          onOpenChange={props.onOpenChange}
        />
      }
    >
      <LazyResourcePickerDialog {...props} />
    </Suspense>
  )
}

export function ResourcePreviewDialogLazy(props: ResourcePreviewDialogProps) {
  if (!props.open) {
    return null
  }

  return (
    <Suspense
      fallback={
        <ResourceDialogFallback
          open={props.open}
          title={props.title || '资源详情'}
          description={props.description}
          assistantLayer={props.assistantLayer}
          layerClassName={props.layerClassName}
          layerZIndex={props.layerZIndex}
          presentation={props.presentation}
          preview
          onOpenChange={props.onOpenChange}
        />
      }
    >
      <LazyResourcePreviewDialog {...props} />
    </Suspense>
  )
}

function ResourceDialogFallback({
  open,
  title,
  description,
  assistantLayer,
  layerClassName,
  layerZIndex,
  presentation = 'dialog',
  preview,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  assistantLayer?: boolean
  layerClassName?: string
  layerZIndex?: number
  presentation?: 'dialog' | 'drawer'
  preview?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fallback = (
    <div className="space-y-3 p-6">
      <Skeleton className={preview ? 'h-[52vh] w-full rounded-xl' : 'h-14 w-full'} />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-10 w-1/2" />
    </div>
  )

  if (presentation === 'drawer') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          data-assistant-layer={assistantLayer ? 'true' : undefined}
          layerClassName={layerClassName}
          layerZIndex={layerZIndex}
          side="right"
          showOverlay={false}
          className="w-full gap-0 overflow-hidden p-0 shadow-[-16px_0_40px_rgba(15,23,42,0.12)] sm:w-[66vw] sm:max-w-[66vw]"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-start">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          {fallback}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={
          layerClassName ||
            (assistantLayer ? ASSISTANT_DIALOG_LAYER_CLASS : undefined)
        }
        layerZIndex={layerZIndex}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {fallback}
      </DialogContent>
    </Dialog>
  )
}
