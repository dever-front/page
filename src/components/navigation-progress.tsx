import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { useLocation } from '@tanstack/react-router'
import { PAGE_PROGRESS_EVENT, type PageProgressDetail } from '@/lib/page-progress'
import {
  buildRouteNavigationKey,
  setActiveRouteNavigationKey,
} from '@/lib/route-key'

const START_PROGRESS = 12
const ACTIVE_PROGRESS = 72
const FINISH_PROGRESS = 100
const HIDE_DELAY = 260

type ProgressState = {
  key: string
  visible: boolean
  value: number
  version: number
}

export function NavigationProgress() {
  const routeNavigationKey = useLocation({
    select: (location) => buildRouteNavigationKey(location.href, location.state),
  })
  const currentKeyRef = useRef('')
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number | null>(null)
  const [progress, setProgress] = useState<ProgressState>({
    key: '',
    visible: false,
    value: 0,
    version: 0,
  })

  useLayoutEffect(() => {
    setActiveRouteNavigationKey(routeNavigationKey)
  }, [routeNavigationKey])

  useEffect(() => {
    const handlePageProgress = (event: Event) => {
      const detail = (event as CustomEvent<PageProgressDetail>).detail
      const key = String(detail?.key || '').trim()
      if (!key) {
        return
      }

      if (detail.type === 'start') {
        currentKeyRef.current = key
        startLoadingBar(key, hideTimerRef, frameRef, setProgress)
        return
      }

      if (key !== currentKeyRef.current) {
        return
      }

      currentKeyRef.current = ''
      finishLoadingBar(key, hideTimerRef, frameRef, setProgress)
    }

    window.addEventListener(PAGE_PROGRESS_EVENT, handlePageProgress)
    return () => {
      window.removeEventListener(PAGE_PROGRESS_EVENT, handlePageProgress)
      clearProgressTimers(hideTimerRef, frameRef)
    }
  }, [])

  return (
    <div
      className='pointer-events-none fixed inset-x-0 top-0 z-[99999999999] h-0.5 bg-transparent'
      aria-hidden='true'
    >
      {progress.visible ? (
        <div
          key={progress.version}
          className='h-full bg-muted-foreground shadow-[0_0_10px_var(--muted-foreground)] transition-[width,opacity] duration-300 ease-out'
          style={{
            width: `${progress.value}%`,
            opacity: progress.value > 0 ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  )
}

function startLoadingBar(
  key: string,
  hideTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  frameRef: MutableRefObject<number | null>,
  setProgress: Dispatch<SetStateAction<ProgressState>>
) {
  clearProgressTimers(hideTimerRef, frameRef)

  setProgress((current) => ({
    key,
    visible: true,
    value: START_PROGRESS,
    version: current.version + 1,
  }))

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    setProgress((current) =>
      current.key === key
        ? {
            ...current,
            value: ACTIVE_PROGRESS,
          }
        : current
    )
  })
}

function finishLoadingBar(
  key: string,
  hideTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  frameRef: MutableRefObject<number | null>,
  setProgress: Dispatch<SetStateAction<ProgressState>>
) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }

  setProgress((current) =>
    current.key === key
      ? {
          ...current,
          value: FINISH_PROGRESS,
        }
      : current
  )

  if (hideTimerRef.current) {
    clearTimeout(hideTimerRef.current)
  }

  hideTimerRef.current = setTimeout(() => {
    hideTimerRef.current = null
    setProgress((current) =>
      current.key === key
        ? {
            ...current,
            key: '',
            visible: false,
            value: 0,
          }
        : current
    )
  }, HIDE_DELAY)
}

function clearProgressTimers(
  hideTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  frameRef: MutableRefObject<number | null>
) {
  if (hideTimerRef.current) {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }

  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }
}
