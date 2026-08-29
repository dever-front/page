import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import { getRuntimeConfig } from '@/config/app-config'
import {
  ensurePluginsForNodes,
  getRuntimePluginNodes,
} from '@/lib/plugin/runtime'

type PluginSlotProps = {
  name: string
}

export function PluginSlot({ name }: PluginSlotProps) {
  const nodeTypes = useMemo(() => slotNodeTypes(name), [name])
  const [, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    void ensurePluginsForNodes(nodeTypes).then(() => {
      if (active) {
        setRevision((current) => current + 1)
      }
    })
    return () => {
      active = false
    }
  }, [nodeTypes])

  return (
    <>
      {nodeTypes.map((nodeType) => {
        const SlotComponent = getRuntimePluginNodes()[nodeType] as unknown as
          | ComponentType
          | undefined
        if (!SlotComponent) {
          return null
        }
        return (
          <Suspense key={nodeType} fallback={null}>
            <SlotComponent />
          </Suspense>
        )
      })}
    </>
  )
}

function slotNodeTypes(name: string) {
  const prefix = `slot-${name}-`
  const result: string[] = []
  const seen = new Set<string>()
  for (const plugin of getRuntimeConfig().plugins || []) {
    for (const nodeType of plugin.nodes || []) {
      if (nodeType.startsWith(prefix) && !seen.has(nodeType)) {
        seen.add(nodeType)
        result.push(nodeType)
      }
    }
  }
  return result
}
