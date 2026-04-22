import { useStore } from 'zustand'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { getStoreValueByPath } from '@/lib/store'
import {
  buildRemoteSearchPatch,
  getRemoteSearchKey,
  normalizeRemoteSearchValue,
} from '@/lib/remote-search'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ActionConfig } from '@/lib/schema'
import type { NodeItemProps } from '../../nodes'

type TabMetaItem = {
  label: string
  action?: string
  value?: string
  targetValue?: unknown
  searchValue?: unknown
  disabled?: boolean
}

type TabMeta = {
  target?: string
  variant?: 'pill' | 'line' | 'sidebar'
  remoteSearch?: boolean
  searchLayoutId?: string
  queryKey?: string
  tabs?: TabMetaItem[]
}

type OptionTabItem = Record<string, unknown>

type TabVariant = NonNullable<TabMeta['variant']>

const tabsListClassName: Record<TabVariant, string> = {
  pill: 'h-10 rounded-full bg-muted/70 p-1',
  line: 'h-auto w-full justify-start gap-8 rounded-none border-b bg-transparent p-0 text-foreground',
  sidebar:
    'h-auto w-full flex-col items-stretch justify-start gap-1 rounded-none bg-transparent p-0 text-foreground',
}

const tabsTriggerClassName: Record<TabVariant, string> = {
  pill:
    'rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
  line:
    'h-11 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-0 pb-3 pt-2 text-base font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent',
  sidebar:
    'h-11 w-full justify-start rounded-md px-3 text-base font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-muted/60',
}

function getActionValue(actionName: string, action?: ActionConfig) {
  if (!action || action.value === undefined) {
    return actionName
  }
  return String(action.value)
}

function getActionCurrentValue(
  store: NodeItemProps['store'],
  targetPath: string
) {
  return getStoreValueByPath(store, targetPath)
}

function getTabValue(tab: TabMetaItem, action?: ActionConfig) {
  if (tab.value != null) {
    return String(tab.value)
  }

  if (tab.action) {
    return getActionValue(tab.action, action)
  }

  return tab.label
}

function getTabTargetValue(tab: TabMetaItem, tabValue: string) {
  if (Object.prototype.hasOwnProperty.call(tab, 'targetValue')) {
    return tab.targetValue
  }

  return tab.value != null ? tab.value : tabValue
}

function findTabByTargetValue(
  tabs: TabMetaItem[],
  currentValue: unknown,
  actions: Record<string, ActionConfig>
) {
  const normalizedCurrent = normalizeComparableTabValue(currentValue)

  return tabs.find((tab) => {
    const action = tab.action ? actions[tab.action] : undefined
    const tabValue = getTabValue(tab, action)
    return normalizeComparableTabValue(getTabTargetValue(tab, tabValue)) === normalizedCurrent
  })
}

function normalizeComparableTabValue(value: unknown) {
  if (value == null) {
    return ''
  }
  return String(value)
}

function buildOptionTabs(options?: OptionTabItem[]) {
  return (options || [])
    .map((option) => {
      const optionValue = option.id ?? option.value
      if (optionValue == null) {
        return null
      }

      return {
        label: String(option.label ?? option.value ?? option.name ?? optionValue),
        value: String(optionValue),
      } satisfies TabMetaItem
    })
    .filter((tab): tab is TabMetaItem => !!tab)
}

function mergeTabs(staticTabs: TabMetaItem[], optionTabs: TabMetaItem[]) {
  const seen = new Set<string>()
  const merged: TabMetaItem[] = []

  for (const tab of [...staticTabs, ...optionTabs]) {
    const key = String(tab.value ?? tab.action ?? tab.label)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(tab)
  }

  return merged
}

export function NavTab({ item, option, runAction, store }: NodeItemProps) {
  const navigate = useNavigate()
  const meta = (item.meta ?? {}) as TabMeta
  const tabs = mergeTabs((meta.tabs ?? []) as TabMetaItem[], buildOptionTabs(option))
  const targetPath = String(meta.target || 'state.currentTab').trim()
  const variant =
    meta.variant === 'line' || meta.variant === 'sidebar'
      ? meta.variant
      : 'pill'

  const currentValue = useStore(store, (s) => {
    if (targetPath) {
      const current = getActionCurrentValue(store, targetPath)
      const matchedTab = findTabByTargetValue(tabs, current, s.action)
      if (matchedTab) {
        const actionConfig = matchedTab.action ? s.action[matchedTab.action] : undefined
        return getTabValue(matchedTab, actionConfig)
      }

      if (current != null && String(current).trim() !== '') {
        return String(current)
      }
    }

    for (const tab of tabs) {
      if (!tab.action) {
        continue
      }

      const actionConfig = s.action[tab.action]
      if (!actionConfig?.target) {
        continue
      }

      const current = getActionCurrentValue(store, actionConfig.target)
      const matchedTab = findTabByTargetValue(tabs, current, s.action)
      if (matchedTab) {
        const matchedActionConfig = matchedTab.action ? s.action[matchedTab.action] : undefined
        return getTabValue(matchedTab, matchedActionConfig)
      }

      return String(current ?? getActionValue(tab.action, actionConfig))
    }

    return tabs[0]
      ? getTabValue(tabs[0], tabs[0].action ? s.action[tabs[0].action] : undefined)
      : ''
  })

  const handleValueChange = async (nextValue: string) => {
    const targetTab = tabs.find((tab) => {
      const actionConfig = tab.action
        ? store.getState().action[tab.action]
        : undefined
      return getTabValue(tab, actionConfig) === nextValue
    })

    if (targetTab?.action) {
      await runAction(targetTab.action)
      return
    }

    const nextTargetValue = targetTab
      ? getTabTargetValue(targetTab, nextValue)
      : nextValue

    if (targetPath) {
      store.getState().setValueByPath(targetPath, nextTargetValue)
    }

    if (meta.remoteSearch === true) {
      const searchLayoutId = String(meta.searchLayoutId || '').trim()
      const queryKey = String(
        meta.queryKey || getRemoteSearchKey(targetPath || item.value)
      ).trim()
      const searchValue =
        targetTab && Object.prototype.hasOwnProperty.call(targetTab, 'searchValue')
          ? targetTab.searchValue
          : nextTargetValue

      navigate({
        to: window.location.pathname,
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...buildRemoteSearchPatch(store.getState(), searchLayoutId),
          ...(queryKey
            ? { [queryKey]: normalizeRemoteSearchValue(searchValue) }
            : {}),
        }),
      })
    }
  }

  if (!tabs.length) {
    return null
  }

  return (
    <Tabs
      value={String(currentValue)}
      onValueChange={handleValueChange}
      className={cn(variant === 'sidebar' && 'w-full')}
    >
      <TabsList className={cn(tabsListClassName[variant])}>
        {tabs.map((tab) => {
          const actionConfig = tab.action
            ? store.getState().action[tab.action]
            : undefined
          const value = getTabValue(tab, actionConfig)

          return (
            <TabsTrigger
              key={value}
              value={value}
              disabled={tab.disabled}
              className={cn(tabsTriggerClassName[variant])}
            >
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
