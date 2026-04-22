export function findFloatingLayerContainer(element: HTMLElement | null) {
  return (
    element?.closest<HTMLElement>('[data-slot="dialog-content"], [data-slot="sheet-content"]') ||
    null
  )
}
