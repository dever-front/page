import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getByPath } from '@/lib/path'
import { request } from '@/lib/request'
import type { OptionItem } from '@/lib/schema'
import { useStorePathValue } from '@/lib/store'
import { sanitizeRouteOptionURL, withRouteOptionContext } from '@/page/option'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import type { NodeItemProps } from '../../nodes'

type ComboRow = {
  values: Record<string, string>
  native_value: string
}

type ParamLabelMap = Record<string, string>
type ParamOptionMap = Record<string, OptionItem[]>

export function FormComboMapping({
  item,
  value,
  setValue,
  store,
}: NodeItemProps) {
  const mainParamPath = String(
    item.meta?.mainParamPath || 'form.param_id'
  ).trim()
  const extraParamsPath = String(
    item.meta?.extraParamsPath || 'form.combo_params'
  ).trim()
  const optionSource = String(item.meta?.optionSource || '').trim()
  const paramSource = String(item.meta?.paramSource || '').trim()
  const optionSourceKey = String(
    item.meta?.optionSourceKey || 'combo.optionSource'
  ).trim()
  const paramSourceKey = String(
    item.meta?.paramSourceKey || 'combo.paramSource'
  ).trim()
  const addText = String(item.meta?.addText || '添加字段值')
  const addAllText = String(item.meta?.addAllText || '添加全部字段值')
  const clearText = String(item.meta?.clearText || '清空')
  const maxAutoRows = Number(item.meta?.maxAutoRows ?? 200)
  const mainParamValue = useStorePathValue(store, mainParamPath)
  const extraParamsValue = useStorePathValue(store, extraParamsPath)
  const paramIDs = useMemo(
    () => normalizeComboParamIDs(mainParamValue, extraParamsValue, value),
    [extraParamsValue, mainParamValue, value]
  )
  const rows = useMemo(() => normalizeComboRows(value), [value])
  const [paramLabels, setParamLabels] = useState<ParamLabelMap>({})
  const [paramOptions, setParamOptions] = useState<ParamOptionMap>({})
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadParamLabels() {
      if (!paramIDs.length || !paramSource) {
        setParamLabels({})
        return
      }
      const result = await request(
        sanitizeRouteOptionURL(paramSource),
        'get',
        withRouteOptionContext(
          paramSource,
          {
            selected: JSON.stringify(paramIDs),
            pageSize: Math.max(paramIDs.length, 20),
          },
          {
            item: {
              id: paramSourceKey,
              key: paramSourceKey,
              meta: {},
              value: paramSourceKey,
            },
            store,
          }
        )
      )
      if (cancelled || result.code !== 0 || !Array.isArray(result.data)) {
        return
      }

      const nextLabels: ParamLabelMap = {}
      for (const option of result.data) {
        const id = String(option?.id ?? '').trim()
        if (id) {
          nextLabels[id] = String(option?.value ?? id)
        }
      }
      setParamLabels(nextLabels)
    }

    void loadParamLabels()
    return () => {
      cancelled = true
    }
  }, [paramIDs, paramSource, paramSourceKey, store])

  useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      if (!optionSource) {
        return
      }
      const missingParamIDs = paramIDs.filter(
        (paramID) => !paramOptions[paramID]
      )
      if (!missingParamIDs.length) {
        return
      }

      const loadedEntries = await Promise.all(
        missingParamIDs.map(async (paramID) => {
          const result = await request(
            sanitizeRouteOptionURL(optionSource),
            'get',
            withRouteOptionContext(
              optionSource,
              {
                parentId: paramID,
              },
              {
                item: {
                  id: optionSourceKey,
                  key: optionSourceKey,
                  meta: {},
                  value: optionSourceKey,
                },
                store,
              }
            )
          )
          const options =
            result.code === 0 && Array.isArray(result.data)
              ? (result.data as OptionItem[])
              : []
          return [paramID, options] as const
        })
      )
      if (cancelled) {
        return
      }

      setParamOptions((current) => {
        const next = { ...current }
        for (const [paramID, options] of loadedEntries) {
          next[paramID] = options
        }
        return next
      })
    }

    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [optionSource, optionSourceKey, paramIDs, paramOptions, store])

  const commitRows = useCallback(
    (nextRows: ComboRow[]) => {
      const normalizedRows = normalizeRowsForParams(nextRows, paramIDs)
      setValue(
        JSON.stringify({
          params: paramIDs.map((paramID) => Number(paramID)),
          rows: normalizedRows,
        })
      )
    },
    [paramIDs, setValue]
  )

  const updateRow = useCallback(
    (index: number, updater: (row: ComboRow) => ComboRow) => {
      const nextRows = [...rows]
      nextRows[index] = updater(nextRows[index] || emptyComboRow())
      commitRows(nextRows)
    },
    [commitRows, rows]
  )

  const addRow = useCallback(() => {
    setNotice('')
    const optionGroups = paramIDs.map((paramID) => paramOptions[paramID] || [])
    if (optionGroups.some((options) => options.length === 0)) {
      setNotice('请等待参与参数选项加载完成。')
      return
    }

    const [nextRow] = findMissingComboRows(paramIDs, optionGroups, rows, 1)
    if (!nextRow) {
      setNotice('所有字段值组合已添加。')
      return
    }
    commitRows([...rows, nextRow])
  }, [commitRows, paramIDs, paramOptions, rows])

  const addAllRows = useCallback(() => {
    setNotice('')
    const optionGroups = paramIDs.map((paramID) => paramOptions[paramID] || [])
    if (optionGroups.some((options) => options.length === 0)) {
      setNotice('请等待参与参数选项加载完成。')
      return
    }

    const combinationCount = countComboCombinations(optionGroups)
    if (combinationCount > maxAutoRows) {
      setNotice(
        `组合数量 ${combinationCount} 条，超过上限 ${maxAutoRows} 条，请手动添加。`
      )
      return
    }

    const missingRows = findMissingComboRows(paramIDs, optionGroups, rows)

    if (!missingRows.length) {
      setNotice('所有字段值组合已添加。')
      return
    }
    commitRows([...rows, ...missingRows])
  }, [commitRows, maxAutoRows, paramIDs, paramOptions, rows])

  if (paramIDs.length < 2) {
    return (
      <p className='text-sm text-muted-foreground'>
        请先选择主参数，并至少添加 1 个参与参数。
      </p>
    )
  }

  if (!optionSource) {
    return (
      <p className='text-sm text-muted-foreground'>
        请配置组合映射的选项来源。
      </p>
    )
  }

  return (
    <div className='w-full min-w-0 space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='h-8 rounded-md border-dashed bg-background'
          onClick={addRow}
        >
          <Plus className='size-4' />
          {addText}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='h-8 rounded-md border-dashed bg-background'
          onClick={addAllRows}
        >
          <Plus className='size-4' />
          {addAllText}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='h-8 rounded-md bg-background'
          onClick={() => {
            setNotice('')
            commitRows([])
          }}
          disabled={rows.length === 0}
        >
          {clearText}
        </Button>
        <div className='ml-1 min-h-5 text-xs text-muted-foreground'>
          {notice || `共 ${rows.length} 个字段值`}
        </div>
      </div>

      <div className='w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-xs'>
        <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border/70 hover:bg-transparent'>
              {paramIDs.map((paramID) => (
                <TableHead
                  key={paramID}
                  className='h-10 px-4 text-xs font-semibold tracking-wide text-muted-foreground'
                >
                  {paramLabels[paramID] || `参数 ${paramID}`}
                </TableHead>
              ))}
              <TableHead className='h-10 px-4 text-xs font-semibold tracking-wide text-muted-foreground'>
                来源字段值
              </TableHead>
              <TableHead className='h-10 w-[88px] px-4 text-center text-xs font-semibold tracking-wide text-muted-foreground'>
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='bg-background'>
            {rows.length === 0 ? (
              <TableRow className='hover:bg-transparent'>
                <TableCell
                  colSpan={paramIDs.length + 2}
                  className='px-4 py-7 text-center text-sm text-muted-foreground'
                >
                  暂无字段值，请点击上方按钮添加。
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIndex) => (
                <TableRow
                  key={`combo-row-${rowIndex}`}
                  className='border-border/70 hover:bg-transparent'
                >
                  {paramIDs.map((paramID) => (
                    <TableCell
                      key={`${rowIndex}-${paramID}`}
                      className='px-4 py-3'
                    >
                      <SearchableOptionPicker
                        value={row.values?.[paramID] || undefined}
                        options={paramOptions[paramID] || []}
                        placeholder={`选择${paramLabels[paramID] || '参数'}选项`}
                        searchPlaceholder='输入关键词筛选...'
                        emptyText='暂无参数选项'
                        className='h-9 w-full min-w-[11rem] rounded-lg bg-background shadow-none'
                        onChange={(nextValue) => {
                          const selectedValue = Array.isArray(nextValue)
                            ? (nextValue[0] ?? '')
                            : nextValue
                          updateRow(rowIndex, (current) => ({
                            ...current,
                            values: {
                              ...(current.values || {}),
                              [paramID]: selectedValue,
                            },
                          }))
                        }}
                      />
                    </TableCell>
                  ))}
                  <TableCell className='px-4 py-3'>
                    <Input
                      value={row.native_value || ''}
                      placeholder='来源字段值'
                      className='h-9 min-w-[11rem] rounded-lg bg-background shadow-none'
                      onChange={(event) => {
                        updateRow(rowIndex, (current) => ({
                          ...current,
                          native_value: event.target.value,
                        }))
                      }}
                    />
                  </TableCell>
                  <TableCell className='px-4 py-3'>
                    <div className='flex justify-center'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='xs'
                        className='rounded-md border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive'
                        onClick={() =>
                          commitRows(
                            rows.filter((_, index) => index !== rowIndex)
                          )
                        }
                      >
                        <Trash2 className='size-3.5' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function normalizeComboParamIDs(
  mainParamValue: unknown,
  extraParamsValue: unknown,
  mappingValue: unknown
) {
  const result: string[] = []
  appendParamID(result, mainParamValue)
  const extraRows = normalizeExtraParamRows(extraParamsValue)
  const fallbackParamIDs =
    extraRows.length > 0 ? [] : normalizeMappingParamIDs(mappingValue)
  for (const item of extraRows.length > 0 ? extraRows : fallbackParamIDs) {
    if (item && typeof item === 'object') {
      appendParamID(result, (item as Record<string, any>).param_id)
      continue
    }
    appendParamID(result, item)
  }
  return Array.from(new Set(result))
}

function normalizeMappingParamIDs(value: unknown): unknown[] {
  const raw = decodeMappingObject(value)
  return Array.isArray(raw.params) ? raw.params : []
}

function normalizeExtraParamRows(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }
  const text = String(value ?? '').trim()
  if (!text.startsWith('[')) {
    return []
  }
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function appendParamID(result: string[], value: unknown) {
  const id = String(value ?? '').trim()
  if (id && id !== '0') {
    result.push(id)
  }
}

function normalizeComboRows(value: unknown): ComboRow[] {
  const raw = decodeMappingObject(value)
  const rows = Array.isArray(raw.rows) ? raw.rows : []
  return rows
    .filter(
      (row): row is Record<string, any> =>
        row != null && typeof row === 'object' && !Array.isArray(row)
    )
    .map((row) => {
      const values =
        row.values &&
        typeof row.values === 'object' &&
        !Array.isArray(row.values)
          ? (row.values as Record<string, any>)
          : {}
      return {
        values: Object.fromEntries(
          Object.entries(values)
            .map(([key, current]) => [
              String(key),
              String(current ?? '').trim(),
            ])
            .filter(([, current]) => current !== '')
        ),
        native_value: String(
          row.native_value ?? row.field_value ?? row.mapped_value ?? ''
        ).trim(),
      }
    })
}

function decodeMappingObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>
  }
  const text = String(value ?? '').trim()
  if (!text.startsWith('{')) {
    return {}
  }
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {}
  } catch {
    return {}
  }
}

function emptyComboRow(): ComboRow {
  return { values: {}, native_value: '' }
}

function normalizeRowsForParams(rows: ComboRow[], paramIDs: string[]) {
  return rows.map((row) => ({
    values: Object.fromEntries(
      paramIDs
        .map((paramID) => [paramID, String(row.values?.[paramID] ?? '').trim()])
        .filter(([, optionID]) => optionID !== '')
    ),
    native_value: String(row.native_value ?? '').trim(),
  }))
}

function countComboCombinations(optionGroups: OptionItem[][]) {
  return optionGroups.reduce((total, group) => total * group.length, 1)
}

function findMissingComboRows(
  paramIDs: string[],
  optionGroups: OptionItem[][],
  rows: ComboRow[],
  limit = 0
) {
  const missingRows: ComboRow[] = []
  const existing = new Set(
    rows.map((row) => comboRowSignature(row, paramIDs)).filter(Boolean)
  )
  const pickedOptions: OptionItem[] = []
  const maxRows = Math.max(0, limit)
  const shouldStop = () => maxRows > 0 && missingRows.length >= maxRows

  function walk(groupIndex: number) {
    if (shouldStop()) {
      return
    }
    if (groupIndex >= optionGroups.length) {
      const row = buildComboRow(paramIDs, pickedOptions)
      const signature = comboRowSignature(row, paramIDs)
      if (signature && !existing.has(signature)) {
        existing.add(signature)
        missingRows.push(row)
      }
      return
    }

    for (const option of optionGroups[groupIndex] || []) {
      pickedOptions[groupIndex] = option
      walk(groupIndex + 1)
      if (shouldStop()) {
        return
      }
    }
    pickedOptions.length = groupIndex
  }

  walk(0)
  return missingRows
}

function buildComboRow(
  paramIDs: string[],
  combination: OptionItem[]
): ComboRow {
  return {
    values: Object.fromEntries(
      paramIDs.map((paramID, index) => [
        paramID,
        String(combination[index]?.id ?? ''),
      ])
    ),
    native_value: '',
  }
}

function comboRowSignature(row: ComboRow, paramIDs: string[]) {
  const values = paramIDs.map((paramID) =>
    String(getByPath(row.values, paramID) ?? '').trim()
  )
  return values.every(Boolean) ? values.join('|') : ''
}
