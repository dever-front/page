import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import LoadingBar, { type LoadingBarRef } from 'react-top-loading-bar'
import { PAGE_PROGRESS_EVENT, type PageProgressDetail } from '@/lib/page-progress'

const START_DELAY = 0

export function NavigationProgress() {
  const ref = useRef<LoadingBarRef>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(false)
  const pageLoadingKeysRef = useRef(new Set<string>())

  useEffect(() => {
    const handlePageProgress = (event: Event) => {
      const detail = (event as CustomEvent<PageProgressDetail>).detail
      const key = String(detail?.key || '').trim()
      if (!key) {
        return
      }

      if (detail.type === 'start') {
        pageLoadingKeysRef.current.add(key)
      } else {
        pageLoadingKeysRef.current.delete(key)
      }

      updateLoadingBar(
        ref,
        timerRef,
        activeRef,
        pageLoadingKeysRef.current.size > 0
      )
    }

    window.addEventListener(PAGE_PROGRESS_EVENT, handlePageProgress)
    return () => {
      window.removeEventListener(PAGE_PROGRESS_EVENT, handlePageProgress)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return (
    <LoadingBar
      color='var(--muted-foreground)'
      ref={ref}
      shadow={true}
      height={2}
    />
  )
}

function updateLoadingBar(
  ref: RefObject<LoadingBarRef | null>,
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  activeRef: MutableRefObject<boolean>,
  loading: boolean
) {
  if (loading) {
    if (!timerRef.current && !activeRef.current) {
      if (START_DELAY <= 0) {
        activeRef.current = true
        ref.current?.continuousStart()
        return
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        activeRef.current = true
        ref.current?.continuousStart()
      }, START_DELAY)
    }
    return
  }

  if (timerRef.current) {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  if (activeRef.current) {
    activeRef.current = false
    ref.current?.complete()
  }
}
