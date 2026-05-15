/**
 * Form/Input.tsx - 文本输入
 */
import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import { useNavigate } from '@tanstack/react-router'
import {
  getRemoteSearchLayoutItems,
  resolveRemoteSearchMode,
} from '@/lib/remote-search'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { AssistantFieldGenerateButton } from '@/components/assistant/form-actions'
import type { NodeItemProps } from '../../nodes'

export function FormInput({
  item,
  value,
  setValue,
  error,
  store,
  layoutId,
  assistantAdornment,
}: NodeItemProps) {
  const navigate = useNavigate()
  const isRemoteSearch = item.mode === 'search' && item.meta?.remote === true
  const searchKey = item.value?.split('.').pop()
  const layoutItems = useStore(store, (state) =>
    isRemoteSearch ? getRemoteSearchLayoutItems(state.schema, layoutId) : undefined
  )
  const remoteSearchMode = resolveRemoteSearchMode(layoutItems)
  const shouldAutoRemoteSearch = isRemoteSearch && remoteSearchMode === 'auto'
  const debounceRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
      }
    },
    []
  )

  const input = (
    <Input
      id={item.id}
      name={item.id}
      placeholder={item.placeholder}
      value={value ?? ''}
      disabled={!!item.meta?.disabled}
      autoFocus={!!item.meta?.autoFocus}
      onChange={(e) => {
        const nextValue = e.target.value
        setValue(nextValue)

        if (shouldAutoRemoteSearch && searchKey) {
          if (debounceRef.current != null) {
            window.clearTimeout(debounceRef.current)
          }

          debounceRef.current = window.setTimeout(() => {
            navigate({
              to: window.location.pathname,
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                page: undefined,
                [searchKey]: nextValue || undefined,
              }),
            })
          }, 400)
        }
      }}
      autoComplete={item.meta?.autoComplete ?? 'off'}
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      aria-invalid={!!error}
      className={cn(
        'w-full',
        item.mode === 'form' && 'pr-10',
        error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
        item.meta?.controlClassName
      )}
    />
  )

  const assistantButton =
    item.mode !== 'form'
      ? null
      : assistantAdornment !== undefined
        ? assistantAdornment
        : (
            <AssistantFieldGenerateButton
              item={item}
              store={store}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            />
          )

  if (!assistantButton) {
    return input
  }

  return (
    <div className="relative w-full">
      {input}
      {assistantButton}
    </div>
  )
}
