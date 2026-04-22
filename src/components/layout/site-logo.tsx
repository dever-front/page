import { Logo } from '@/assets/logo'
import { getSiteConfig } from '@/config/app-config'
import { cn } from '@/lib/utils'

type SiteLogoProps = {
  className?: string
}

export function SiteLogo({ className }: SiteLogoProps) {
  const site = getSiteConfig()
  const logo = site.logo || site.favicon

  if (logo) {
    return (
      <img
        src={logo}
        alt={site.name}
        className={cn('size-6 shrink-0 object-contain', className)}
      />
    )
  }

  return <Logo aria-label={site.name} className={className} />
}
