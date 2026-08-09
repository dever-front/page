import { Suspense, lazy, useState } from 'react'
import { ChevronDown, LoaderCircle, X } from 'lucide-react'
import { resolveLucideIcon } from '@/lib/icon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { NodeItemProps } from '../../nodes'

const FormIconPicker = lazy(() =>
  import('./icon-picker').then((module) => ({
    default: module.FormIconPicker,
  }))
)

export function FormIcon({ item, value, setValue, error }: NodeItemProps) {
  const [open, setOpen] = useState(false)

  const currentName = String(value ?? '').trim()
  const CurrentIcon = resolveLucideIcon(currentName)

  return (
    <>
      <div className='flex w-full flex-col gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={!!item.meta?.disabled}
          aria-invalid={!!error}
          className={cn(
            'w-full justify-between',
            !currentName && 'text-muted-foreground',
            error &&
              'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
            item.meta?.controlClassName
          )}
          onClick={() => setOpen(true)}
        >
          <span className='flex min-w-0 items-center gap-2'>
            {CurrentIcon ? (
              <span className='inline-flex size-7 items-center justify-center rounded-md border bg-muted/20'>
                <CurrentIcon className='size-4' />
              </span>
            ) : null}
            <span className='truncate'>
              {currentName || item.placeholder || '请选择图标'}
            </span>
          </span>
          <span className='ml-3 flex items-center gap-1'>
            {currentName ? (
              <span
                role='button'
                tabIndex={0}
                className='inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground'
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setValue('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    setValue('')
                  }
                }}
              >
                <X className='size-4' />
              </span>
            ) : null}
            <ChevronDown className='size-4 shrink-0 opacity-60' />
          </span>
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side='right'
          className='w-[92vw] gap-0 p-0 sm:max-w-[38rem]'
        >
          {open ? (
            <Suspense fallback={<IconPickerLoading />}>
              <FormIconPicker
                currentName={currentName}
                onClose={() => setOpen(false)}
                onSelect={setValue}
              />
            </Suspense>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function IconPickerLoading() {
  return (
    <>
      <SheetHeader className='border-b px-5 py-4'>
        <SheetTitle>选择图标</SheetTitle>
        <SheetDescription>正在加载图标目录。</SheetDescription>
      </SheetHeader>
      <div className='flex min-h-0 flex-1 items-center justify-center text-muted-foreground'>
        <LoaderCircle className='size-5 animate-spin' />
      </div>
    </>
  )
}
