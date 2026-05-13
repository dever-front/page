import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SelectTriggerShell } from '@/components/select-trigger-shell'
import { findFloatingLayerContainer } from '@/lib/floating-layer'
import { resolveSelectedOptionLabels } from '@/lib/option-labels'
import { cn } from '@/lib/utils'

export type OptionPickerItem = {
  id: string | number
  value: string
}

type SearchableOptionPickerProps = {
  value: string | string[] | undefined
  options: OptionPickerItem[]
  multiple?: boolean
  placeholder?: string
  fallbackLabel?: string | string[]
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  error?: boolean
  loading?: boolean
  clearable?: boolean
  remoteSearch?: boolean
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSearchChange?: (query: string) => void
  onClear?: () => void
  onChange: (nextValue: string | string[]) => void
  createAction?: {
    label: string
    disabled?: boolean
    onSelect: () => void
  }
}

export function SearchableOptionPicker({
  value,
  options,
  multiple = false,
  placeholder,
  fallbackLabel,
  searchPlaceholder,
  emptyText,
  disabled,
  error,
  loading = false,
  clearable = true,
  remoteSearch = false,
  className,
  open,
  onOpenChange,
  onSearchChange,
  onClear,
  onChange,
  createAction,
}: SearchableOptionPickerProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const currentOpen = open ?? innerOpen

  const selectedValues = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((current) => String(current))
    }
    if (value == null || value === '') {
      return []
    }
    return [String(value)]
  }, [value])

  const selectedLabels = useMemo(
    () => resolveSelectedOptionLabels(options, selectedValues),
    [options, selectedValues]
  )
  const fallbackText = Array.isArray(fallbackLabel)
    ? fallbackLabel.filter(Boolean).join(' / ')
    : String(fallbackLabel || '').trim()

  const buttonText =
    selectedLabels.length > 0
      ? selectedLabels.join(' / ')
      : fallbackText || selectedValues.join(' / ') || placeholder || '请选择'
  const filteredOptions = useMemo(
    () => (remoteSearch ? options : filterOptionItemsByLabel(options, query)),
    [options, query, remoteSearch]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPortalContainer(findFloatingLayerContainer(triggerRef.current))
    } else {
      setQuery('')
    }
    if (open === undefined) {
      setInnerOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <Popover open={currentOpen} onOpenChange={handleOpenChange}>
      <SelectTriggerShell
        className={className}
        clearable={clearable}
        hasValue={selectedValues.length > 0}
        disabled={disabled}
        onClear={onClear}
      >
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={!!error}
            className={cn(
              'relative grid w-full grid-cols-[minmax(0,1fr)_2.25rem] justify-normal gap-0 overflow-hidden border-input bg-background px-0 py-0 pl-3 font-normal shadow-xs',
              selectedLabels.length === 0 && !fallbackText && 'text-muted-foreground',
              error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30',
              className
            )}
          >
            <span className="min-w-0 truncate text-left">{buttonText}</span>
            <span className="select-trigger-chevron flex h-full self-stretch items-center justify-center text-muted-foreground/70 transition-colors">
              <ChevronDown className="size-4 shrink-0" />
            </span>
          </Button>
        </PopoverTrigger>
      </SelectTriggerShell>
      <PopoverContent
        align="start"
        container={portalContainer}
        className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={(nextQuery) => {
              setQuery(nextQuery)
              onSearchChange?.(nextQuery)
            }}
            placeholder={searchPlaceholder || '输入关键词筛选...'}
          />
          <CommandList>
            <CommandEmpty>{loading ? '正在加载...' : emptyText || '未找到匹配选项'}</CommandEmpty>
            {createAction ? (
              <CommandGroup className="border-b">
                <CommandItem
                  value="__create_option__"
                  disabled={createAction.disabled}
                  className="gap-2 font-medium text-primary"
                  onSelect={() => {
                    handleOpenChange(false)
                    createAction.onSelect()
                  }}
                >
                  <Plus className="size-4" />
                  <span className="flex-1 truncate text-left">{createAction.label}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const optionId = String(opt.id)
                const checked = selectedValues.includes(optionId)

                return (
                  <CommandItem
                    key={optionId}
                    value={optionId}
                    className="gap-2"
                    onSelect={() => {
                      if (multiple) {
                        const nextValues = checked
                          ? selectedValues.filter((current) => current !== optionId)
                          : Array.from(new Set([...selectedValues, optionId]))
                        onChange(nextValues)
                        return
                      }

                      onChange(optionId)
                      handleOpenChange(false)
                    }}
                  >
                    <span className="flex-1 truncate text-left">{opt.value}</span>
                    <Check
                      className={cn(
                        'ml-auto size-4 shrink-0',
                        checked ? 'opacity-100 text-primary' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function filterOptionItemsByLabel(options: OptionPickerItem[], query: string) {
  const normalizedQuery = normalizeOptionSearchText(query)
  if (!normalizedQuery) {
    return options
  }

  return options.filter((option) =>
    normalizeOptionSearchText(option.value).includes(normalizedQuery)
  )
}

function normalizeOptionSearchText(value: string | number) {
  return String(value || '').trim().toLowerCase()
}
