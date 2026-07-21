import { lazy, Suspense } from 'react'
import { ASSISTANT_DIALOG_LAYER_CLASS } from '@/lib/floating-layer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResourcePickerDialogProps } from './resource-picker-dialog'
import {
  ResourcePreviewDialog,
  type ResourcePreviewDialogProps,
} from './resource-preview-dialog'

const LazyResourcePickerDialog = lazy(() =>
  import('./resource-picker-dialog').then((mod) => ({
    default: mod.ResourcePickerDialog,
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
          layerZIndex={props.layerZIndex}
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

  return <ResourcePreviewDialog {...props} />
}

function ResourceDialogFallback({
  open,
  title,
  description,
  assistantLayer,
  layerZIndex,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  assistantLayer?: boolean
  layerZIndex?: number
  onOpenChange: (open: boolean) => void
}) {
  const fallback = (
    <div className='space-y-3 p-6'>
      <Skeleton className='h-14 w-full' />
      <Skeleton className='h-10 w-2/3' />
      <Skeleton className='h-10 w-1/2' />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant-layer={assistantLayer ? 'true' : undefined}
        layerClassName={
          assistantLayer ? ASSISTANT_DIALOG_LAYER_CLASS : undefined
        }
        layerZIndex={layerZIndex}
        className='flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl'
      >
        <DialogHeader className='border-b px-6 py-4'>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {fallback}
      </DialogContent>
    </Dialog>
  )
}
