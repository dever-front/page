type InitialBootWindow = Window & {
  __deverHideInitialBoot?: () => void
}

export function hasInitialBootScreen() {
  return (
    typeof document !== 'undefined' &&
    Boolean(document.getElementById('front-initial-boot'))
  )
}

export function hideInitialBootScreen() {
  if (typeof window === 'undefined') {
    return
  }

  const win = window as InitialBootWindow
  if (typeof win.__deverHideInitialBoot === 'function') {
    win.__deverHideInitialBoot()
    return
  }

  document.getElementById('front-initial-boot')?.remove()
}
