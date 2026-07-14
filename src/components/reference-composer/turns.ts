import type { ReferenceOption } from './types'

export type ReferenceTurn = {
  key: string
  assistant?: ReferenceOption
  user?: ReferenceOption
  materials: ReferenceOption[]
}

export type ReferencePickerRow =
  | { type: 'item'; key: string; item: ReferenceOption }
  | { type: 'turn'; key: string; turn: ReferenceTurn }

export function groupReferenceRows(
  items: ReferenceOption[]
): ReferencePickerRow[] {
  const rows: ReferencePickerRow[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item?.messageRole) {
      if (item) {
        rows.push({ type: 'item', key: item.key, item })
      }
      continue
    }

    const next = items[index + 1]
    if (item.messageRole === 'assistant' && next?.messageRole === 'user') {
      rows.push(createTurnRow(item, next))
      index += 1
      continue
    }

    rows.push(
      item.messageRole === 'assistant'
        ? createTurnRow(item, undefined)
        : createTurnRow(undefined, item)
    )
  }

  return rows
}

function createTurnRow(
  assistant?: ReferenceOption,
  user?: ReferenceOption
): ReferencePickerRow {
  const options = [assistant, user].filter(
    (item): item is ReferenceOption => Boolean(item)
  )
  const key = `turn:${options.map((item) => item.key).join(':')}`
  const turn: ReferenceTurn = {
    key,
    materials: mergeMaterials(options),
  }
  if (assistant) {
    turn.assistant = assistant
  }
  if (user) {
    turn.user = user
  }
  return {
    type: 'turn',
    key,
    turn,
  }
}

function mergeMaterials(items: ReferenceOption[]) {
  const materials = items.flatMap((item) => item.materials || [])
  const keys = new Set<string>()
  return materials.filter((material) => {
    if (keys.has(material.key)) {
      return false
    }
    keys.add(material.key)
    return true
  })
}
