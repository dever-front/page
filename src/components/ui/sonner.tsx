import { useEffect } from 'react'
import { toast, Toaster as Sonner, ToasterProps } from 'sonner'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

export function Toaster({
  closeButton = true,
  duration = 3000,
  className,
  style,
  ...props
}: ToasterProps) {
  const { theme = 'system' } = useTheme()

  useEffect(() => {
    const dismissOnPageClick = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest('[data-sonner-toaster]')) {
        return
      }
      toast.dismiss()
    }

    document.addEventListener('pointerdown', dismissOnPageClick)
    return () => document.removeEventListener('pointerdown', dismissOnPageClick)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position={props.position ?? 'top-right'}
      expand={props.expand ?? true}
      closeButton={closeButton}
      duration={duration}
      className={cn(
        'toaster group [&_div[data-content]]:w-full',
        '[&_[data-close-button]]:!left-auto [&_[data-close-button]]:!right-0',
        '[&_[data-close-button]]:!translate-x-[35%] [&_[data-close-button]]:!-translate-y-[35%]',
        className
      )}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(35%, -35%)',
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
