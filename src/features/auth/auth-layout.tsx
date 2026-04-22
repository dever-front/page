import { getSiteConfig } from '@/config/app-config'
import { SiteLogo } from '@/components/layout/site-logo'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const site = getSiteConfig()

  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
        <div className='mb-4 flex items-center justify-center'>
          <SiteLogo className='me-2' />
          <h1 className='text-xl font-medium'>{site.name}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
