import { getRuntimeConfig, getSiteConfig } from '@/config/app-config'
import { hasInitialBootScreen } from '@/lib/initial-boot'

export function FrontBootFallback() {
  return hasInitialBootScreen() ? null : <FrontBootScreen />
}

export function FrontBootScreen() {
  const site = getSiteConfig()
  const siteKey = getRuntimeConfig().siteKey
  const initials = site.name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className='front-boot-screen'
      role='status'
      aria-live='polite'
      aria-label={`正在加载${site.name}`}
      data-site-key={siteKey}
    >
      <div className='front-boot-panel'>
        <div className='front-boot-logo' aria-hidden='true'>
          {site.logo ? (
            <img src={site.logo} alt={site.name} />
          ) : (
            <span className='front-boot-initials'>{initials}</span>
          )}
        </div>
        <div>
          <h1 className='front-boot-title'>{site.name}</h1>
          <p className='front-boot-text'>正在加载，请稍后</p>
        </div>
        <div className='front-boot-progress' aria-hidden='true'>
          <div className='front-boot-progress-bar' />
        </div>
      </div>
    </div>
  )
}
