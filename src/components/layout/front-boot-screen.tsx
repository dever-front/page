import { getSiteConfig } from '@/config/app-config'

export function FrontBootScreen() {
  const site = getSiteConfig()
  const initials = site.name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className='relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#e9f1ff_0%,transparent_34%),linear-gradient(180deg,#fcfdff_0%,#f6f8fc_100%)] px-6'>
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.72)_18%,transparent_40%)] opacity-70' />
      <div className='relative flex w-full max-w-sm flex-col items-center gap-5 text-center'>
        <div className='front-boot-logo relative flex size-20 items-center justify-center rounded-[2rem] border border-slate-200/80 bg-white/92 shadow-[0_28px_70px_-24px_rgba(15,23,42,0.28)] backdrop-blur'>
          {site.favicon ? (
            <img
              src={site.favicon}
              alt={site.name}
              className='size-10 object-contain'
            />
          ) : (
            <span className='text-2xl font-semibold tracking-tight text-slate-900'>
              {initials}
            </span>
          )}
        </div>
        <div className='space-y-2'>
          <h1 className='text-[1.65rem] font-semibold tracking-tight text-slate-950'>
            {site.name}
          </h1>
          <p className='text-sm leading-6 text-slate-500'>
            正在加载，请稍后
          </p>
        </div>
        <div className='front-boot-progress h-1.5 w-44 overflow-hidden rounded-full bg-slate-200/80'>
          <div className='front-boot-progress-bar h-full w-24 rounded-full bg-slate-900' />
        </div>
      </div>
    </div>
  )
}
