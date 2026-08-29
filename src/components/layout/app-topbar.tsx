import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { PluginSlot } from '@/components/plugin-slot'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { TopUserNav } from './top-user-nav'

type AppTopbarProps = {
  className?: string
}

export function AppTopbar({ className }: AppTopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/88',
        className
      )}
    >
      <div className='flex min-h-14 items-center gap-3 px-4 py-2.5 sm:px-5'>
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <SidebarTrigger variant='outline' className='shrink-0' />
          <Separator orientation='vertical' className='h-5 shrink-0' />
          <Search
            placeholder='搜索'
            className='max-w-[17rem] md:max-w-[19rem] lg:max-w-[22rem]'
          />
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <PluginSlot name='app-topbar-actions' />
          <ThemeSwitch />
          <TopUserNav />
        </div>
      </div>
    </header>
  )
}
