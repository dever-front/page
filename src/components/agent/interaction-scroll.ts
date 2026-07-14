import type { WheelEvent } from 'react'

const interactionScrollSelector = '[data-agent-interaction-scroll="true"]'

export function handleInteractionRootWheel(
  event: WheelEvent<HTMLDivElement>
) {
  const eventTarget = event.target
  if (
    eventTarget instanceof HTMLElement &&
    eventTarget.closest(interactionScrollSelector)
  ) {
    return
  }

  const scrollTarget = event.currentTarget.querySelector<HTMLDivElement>(
    interactionScrollSelector
  )
  if (!scrollTarget) {
    event.stopPropagation()
    return
  }

  scrollInteractionElement(event, scrollTarget)
}

export function handleInteractionWheel(event: WheelEvent<HTMLDivElement>) {
  scrollInteractionElement(event, event.currentTarget)
}

function scrollInteractionElement(
  event: WheelEvent<HTMLDivElement>,
  target: HTMLDivElement
) {
  const scrollDelta = interactionWheelDelta(event, target)
  if (scrollDelta === 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  target.scrollTop = Math.max(
    0,
    Math.min(
      target.scrollTop + scrollDelta,
      target.scrollHeight - target.clientHeight
    )
  )
}

function interactionWheelDelta(
  event: WheelEvent<HTMLDivElement>,
  target: HTMLDivElement
) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16
  }
  if (event.deltaMode === 2) {
    return event.deltaY * target.clientHeight
  }
  return event.deltaY
}
