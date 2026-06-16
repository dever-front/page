import { useState } from 'react'
import { getSiteConfig } from '@/config/app-config'
import { Logo } from '@/assets/logo'
import { cn } from '@/lib/utils'

type SiteLogoProps = {
  className?: string
}

export function SiteLogo({ className }: SiteLogoProps) {
  const site = getSiteConfig()
  const logo = site.logo || site.favicon
  const [failedLogo, setFailedLogo] = useState('')

  if (logo && logo !== failedLogo) {
    return (
      <img
        src={logo}
        alt={site.name}
        className={cn('size-6 shrink-0 object-contain object-center', className)}
        onError={() => setFailedLogo(logo)}
      />
    )
  }

  return <Logo aria-label={site.name} className={className} />
}
