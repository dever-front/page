import { getSiteConfig } from '@/config/app-config'
import { cn } from '@/lib/utils'
import { SiteLogo } from '@/components/layout/site-logo'
import type { NodeItemProps } from '../../nodes'

export function AppSiteBrand({ item }: NodeItemProps) {
  const site = getSiteConfig()

  return (
    <div
      className={cn('flex min-w-0 items-center justify-center', item.className)}
    >
      <SiteLogo className={cn('me-2', item.meta?.logoClassName)} />
      <h1
        className={cn(
          'truncate text-xl font-medium',
          item.meta?.titleClassName
        )}
      >
        {item.name || site.name}
      </h1>
    </div>
  )
}
