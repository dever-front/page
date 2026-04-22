import { useEffect, useRef, useState } from 'react'

type UseElementInViewOptions = {
  rootMargin?: string
  threshold?: number
}

export function useElementInView<T extends Element>({
  rootMargin = '200px',
  threshold = 0.01,
}: UseElementInViewOptions = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const target = ref.current
    if (!target || inView) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }
        setInView(true)
        observer.disconnect()
      },
      {
        rootMargin,
        threshold,
      }
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [inView, rootMargin, threshold])

  return [ref, inView] as const
}
