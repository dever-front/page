export function findFloatingLayerContainer(element: HTMLElement | null) {
  return (
    element?.closest<HTMLElement>(
      '[data-slot="dialog-layer"], [data-slot="sheet-layer"]'
    ) ||
    element?.closest<HTMLElement>(
      '[data-slot="dialog-content"], [data-slot="sheet-content"]'
    ) ||
    null
  )
}

export function isAssistantLayerEvent(event: Event) {
  return assistantLayerEventTargets(event).some(
    (target) => target.closest('[data-assistant-layer="true"]') != null
  )
}

export function isAssistantLayerProp(props: Record<string, unknown>) {
  return (
    props['data-assistant-layer'] === true ||
    props['data-assistant-layer'] === 'true'
  )
}

export function preventCloseFromExternalAssistantLayer(
  event: Event,
  currentContentIsAssistantLayer: boolean
) {
  if (!currentContentIsAssistantLayer && isAssistantLayerEvent(event)) {
    event.preventDefault()
  }
}

function assistantLayerEventTargets(event: Event) {
  const targets: Element[] = []
  appendEventTarget(targets, event.target)
  event.composedPath().forEach((target) => appendEventTarget(targets, target))

  const originalEvent = originalEventFromCustomEvent(event)
  if (originalEvent) {
    appendEventTarget(targets, originalEvent.target)
    originalEvent
      .composedPath()
      .forEach((target) => appendEventTarget(targets, target))
  }

  return targets
}

function appendEventTarget(targets: Element[], target: EventTarget | null) {
  if (target instanceof Element && !targets.includes(target)) {
    targets.push(target)
  }
}

function originalEventFromCustomEvent(event: Event) {
  const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail
  return detail?.originalEvent instanceof Event ? detail.originalEvent : null
}
