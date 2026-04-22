export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items]
  }

  const nextItems = [...items]
  const [moved] = nextItems.splice(fromIndex, 1)
  if (typeof moved === 'undefined') {
    return nextItems
  }
  nextItems.splice(toIndex, 0, moved)
  return nextItems
}
