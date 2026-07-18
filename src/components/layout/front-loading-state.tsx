import { cn } from '@/lib/utils'

type FrontLoadingStateProps = {
  className?: string
  label?: string
}

export function FrontLoadingState({
  className,
  label = '正在加载页面',
}: FrontLoadingStateProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-40 w-full items-center justify-center p-8',
        className
      )}
      role='status'
      aria-live='polite'
    >
      <div className='flex w-48 flex-col items-center text-center'>
        <span className='text-sm font-medium text-muted-foreground'>{label}</span>
        <div
          className='mt-3 h-0.5 w-40 overflow-hidden rounded-full bg-border/70'
          aria-hidden='true'
        >
          <div className='front-loading-bar h-full w-10 rounded-full bg-foreground/60' />
        </div>
      </div>
    </div>
  )
}
