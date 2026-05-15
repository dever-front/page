import { lazy, Suspense } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
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
  preview,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  assistantLayer?: boolean
  layerClassName?: string
  preview?: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={layerClassName || (assistantLayer ? 'z-[95]' : undefined)}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-3 p-6">
          <Skeleton className={preview ? 'h-[52vh] w-full rounded-xl' : 'h-14 w-full'} />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
