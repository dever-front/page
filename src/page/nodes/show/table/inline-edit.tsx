import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Column } from '@/lib/schema'
import type { PageStore, PageStoreState } from '@/lib/store'
import { getByPath, setByPath } from '@/lib/path'
import { runActionsWithResult } from '@/lib/action'
import { toastActionResult } from '@/lib/action-toast'
import { cn } from '@/lib/utils'
import { FormInput } from '../../form/input'
import { FormSelect } from '../../form/select'
import { FormNumber } from '../../form/number'
import { FormSwitch } from '../../form/switch'
import { resolveColumnOptionList } from './options'

type InlineCellProps = {
  column: Column
  value: any
  row: Record<string, any>
  rowIndex: number
  rowKey: string
  store: PageStore
  onAction: (name: string) => Promise<void>
  onValueSaved?: (nextValue: any) => void
  inlineAction: any
  canEdit: boolean
}

export function EditableFormCell({
  column,
  value,
  row,
  rowIndex,
  rowKey,
  store,
  onAction,
  onValueSaved,
  inlineAction,
  canEdit,
}: InlineCellProps) {
  const field = column.value || ''
  const [draftValue, setDraftValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const optionList = resolveColumnOptionList(store, column)

  useEffect(() => {
    setDraftValue(value ?? '')
  }, [value])

  const commit = useCallback(
    async (nextValue: any = draftValue) => {
      if (!canEdit || !field || saving || !inlineAction) {
        return
      }

      if (isSameEditableValue(value, nextValue)) {
        return
      }

      setSaving(true)
      try {
        const result = await runActionsWithResult(store, inlineAction, {
          row,
          rowIndex,
          value: nextValue,
          field,
        })
        if (result.success) {
          onValueSaved?.(nextValue)
        }
        if (shouldToastInlineAction(result, inlineAction, store.getState().action)) {
          toastActionResult(result, buildInlineToastOptions(column))
        }
      } finally {
        setSaving(false)
      }
    },
    [canEdit, column, draftValue, field, inlineAction, onValueSaved, row, rowIndex, saving, store, value]
  )

  const formItem = {
    id: `table-cell-${row[rowKey] ?? 'row'}-${field}`,
    type: column.type || 'form-input',
    name: column.name,
    placeholder: column.meta?.placeholder,
    value: field,
    mode: 'table',
    meta: {
      ...column.meta,
      disabled: saving || column.meta?.disabled,
      controlClassName: cn('h-8 bg-background', column.meta?.controlClassName),
    },
  }

  if (column.type === 'form-select') {
    return (
      <div className={cn('min-w-[9rem]', saving && 'opacity-70')}>
        <FormSelect
          item={formItem}
          value={draftValue}
          setValue={(nextValue) => {
            setDraftValue(nextValue)
            void commit(nextValue)
          }}
          option={optionList}
          runAction={onAction}
          store={store}
          layoutId=""
          error=""
        />
      </div>
    )
  }

  if (column.type === 'form-switch') {
    return (
      <div className={cn('flex min-w-[4rem] items-center justify-center', saving && 'opacity-70')}>
        <FormSwitch
          item={formItem}
          value={draftValue}
          setValue={(nextValue) => {
            setDraftValue(nextValue)
            void commit(nextValue)
          }}
          option={optionList}
          runAction={onAction}
          store={store}
          layoutId=""
          error=""
        />
      </div>
    )
  }

  const FieldComponent = column.type === 'form-number' ? FormNumber : FormInput

  return (
    <div
      className={cn('min-w-[8rem]', saving && 'opacity-70')}
      onBlurCapture={(event) => {
        const relatedTarget = event.relatedTarget as Node | null
        if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
          return
        }
        void commit()
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          setDraftValue(value ?? '')
        }
      }}
    >
      <FieldComponent
        item={formItem}
        value={draftValue}
        setValue={setDraftValue}
        option={optionList}
        runAction={onAction}
        store={store}
        layoutId=""
        error=""
      />
    </div>
  )
}

export function EditableShowCell({
  column,
  value,
  displayValue,
  row,
  rowIndex,
  rowKey,
  store,
  onAction,
  onValueSaved,
  inlineAction,
  canEdit,
}: InlineCellProps & { displayValue: any }) {
  const editorType = resolveEditorType(column)
  const trigger = String(
    column.trigger ||
      column.meta?.editor?.trigger ||
      (editorType && editorType !== 'form-input' ? 'click' : 'doubleClick')
  )
  const field = column.value || ''
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const optionList = resolveColumnOptionList(store, column)
  const editorStyle = useMemo(
    () => buildInlineEditorStyle(displayValue ?? value, editorType),
    [displayValue, editorType, value]
  )

  useEffect(() => {
    setDraftValue(value ?? '')
  }, [value])

  const commit = useCallback(
    async (nextValue: any = draftValue) => {
      if (!canEdit || !field || saving || !inlineAction) {
        return
      }

      if (isSameEditableValue(value, nextValue)) {
        setEditing(false)
        return
      }

      setSaving(true)
      try {
        const result = await runActionsWithResult(store, inlineAction, {
          row,
          rowIndex,
          value: nextValue,
          field,
        })
        if (result.success) {
          onValueSaved?.(nextValue)
          setEditing(false)
        }
        if (shouldToastInlineAction(result, inlineAction, store.getState().action)) {
          toastActionResult(result, buildInlineToastOptions(column))
        }
      } finally {
        setSaving(false)
      }
    },
    [canEdit, column, draftValue, field, inlineAction, onValueSaved, row, rowIndex, saving, store, value]
  )

  const cancel = useCallback(() => {
    setDraftValue(value ?? '')
    setEditing(false)
  }, [value])

  const formItem = {
    id: `table-display-cell-${row[rowKey] ?? 'row'}-${field}`,
    type: editorType,
    name: column.name,
    placeholder: column.meta?.placeholder,
    value: field,
    mode: 'table',
    meta: {
      ...column.meta,
      disabled: saving || column.meta?.disabled,
      controlClassName: cn(
        'h-8 w-full bg-background px-2',
        editorType === 'form-select' && 'min-w-0',
        column.meta?.controlClassName
      ),
      autoFocus: true,
    },
  }
  const canStartEdit = canEdit && !!inlineAction

  if (!editing) {
    return (
      <div
        className={cn(
          'min-h-8 rounded-md px-2 py-1 text-sm transition-colors',
          canStartEdit && trigger === 'doubleClick' && 'cursor-text hover:bg-muted/60',
          canStartEdit && trigger === 'click' && 'cursor-pointer hover:bg-muted/60'
        )}
        onClick={() => {
          if (canStartEdit && trigger === 'click') {
            setEditing(true)
          }
        }}
        onDoubleClick={() => {
          if (canStartEdit && trigger === 'doubleClick') {
            setEditing(true)
          }
        }}
      >
        {String(displayValue ?? '')}
      </div>
    )
  }

  if (editorType === 'form-select') {
    return (
      <div className={cn('max-w-full', saving && 'opacity-70')} style={editorStyle}>
        <FormSelect
          item={formItem}
          value={draftValue}
          setValue={(nextValue) => {
            setDraftValue(nextValue)
            void commit(nextValue)
          }}
          option={optionList}
          runAction={onAction}
          store={store}
          layoutId=""
          error=""
        />
      </div>
    )
  }

  const FieldComponent = editorType === 'form-number' ? FormNumber : FormInput

  return (
    <div
      className={cn('max-w-full', saving && 'opacity-70')}
      style={editorStyle}
      onBlurCapture={(event) => {
        const relatedTarget = event.relatedTarget as Node | null
        if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
          return
        }
        void commit()
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      }}
    >
      <FieldComponent
        item={formItem}
        value={draftValue}
        setValue={setDraftValue}
        option={optionList}
        runAction={onAction}
        store={store}
        layoutId=""
        error=""
      />
    </div>
  )
}

export function buildInlineChangeAction(
  store: PageStore,
  tableMeta: Record<string, any> | undefined,
  column: Column,
  rowKey: string
) {
  if (column.meta?.inlineEditable === false) {
    return null
  }

  if (column.action?.change) {
    return column.action.change
  }

  if (tableMeta?.inlineEditable === false) {
    return null
  }

  if (!column.value) {
    return null
  }

  const currentPagePath = String(
    store.getState().pagePath || store.getState().schema.page?.route || ''
  )
  const savePath = resolveInlineSavePath(tableMeta?.savePath, currentPagePath)
  if (!savePath) {
    return null
  }

  return {
    type: 'save' as const,
    path: savePath,
    params: {
      _partial: true,
      [rowKey]: `$row.${rowKey}`,
      [column.value]: '$value',
    },
  }
}

// 行内编辑始终按“当前行更新”判断，避免 create 权限误放行已有记录。
export function canUseInlineEdit(
  state: PageStoreState,
  row: Record<string, any>,
  rowKey: string,
  inlineAction: any
) {
  if (!inlineAction) {
    return false
  }

  const path = resolveInlineActionPath(state, inlineAction)
  if (!path) {
    return true
  }

  const rowID = resolveInlineRowID(row, rowKey)
  if (isEmptyInlineRowID(rowID)) {
    return false
  }

  return true
}

export function applyInlineRowPatch(
  store: PageStore,
  tableValuePath: string,
  rowKey: string,
  row: Record<string, any>,
  patch: Record<string, any>
) {
  const targetPath = String(tableValuePath || '').trim()
  if (!targetPath || !rowKey || !row || typeof row !== 'object') {
    return
  }

  const currentRows = store.getState().getValueByPath(targetPath)
  if (!Array.isArray(currentRows)) {
    return
  }

  const currentRowID = row[rowKey]
  const patchEntries = Object.entries(patch).filter(([field]) => String(field).trim())
  if (patchEntries.length === 0) {
    return
  }

  const nextRows = currentRows.map((currentRow) => {
    if (String(currentRow?.[rowKey] ?? '') !== String(currentRowID ?? '')) {
      return currentRow
    }

    return patchEntries.reduce(
      (resultRow, [field, value]) => setByPath(resultRow, field, value),
      currentRow
    )
  })

  store.getState().setValueByPath(targetPath, nextRows)
}

export function applyInlineRowPatchByIndex(
  store: PageStore,
  tableValuePath: string,
  rowIndex: number,
  patch: Record<string, any>
) {
  const targetPath = String(tableValuePath || '').trim()
  if (!targetPath || !Number.isInteger(rowIndex) || rowIndex < 0) {
    return
  }

  const currentRows = store.getState().getValueByPath(targetPath)
  if (!Array.isArray(currentRows) || rowIndex >= currentRows.length) {
    return
  }

  const patchEntries = Object.entries(patch).filter(([field]) => String(field).trim())
  if (patchEntries.length === 0) {
    return
  }

  const nextRows = currentRows.map((currentRow, index) => {
    if (index !== rowIndex) {
      return currentRow
    }

    return patchEntries.reduce(
      (resultRow, [field, value]) => setByPath(resultRow, field, value),
      currentRow
    )
  })

  store.getState().setValueByPath(targetPath, nextRows)
}

function resolveEditorType(column: Column) {
  return (
    (column.editor === true ? 'form-input' : '') ||
    (typeof column.editor === 'string' ? column.editor : '') ||
    String(column.meta?.editor?.type || '') ||
    (column.trigger ? 'form-input' : '')
  )
}

function resolveInlineActionPath(state: PageStoreState, action: any): string {
  if (Array.isArray(action)) {
    for (const current of action) {
      const path = resolveInlineActionPath(state, current)
      if (path) {
        return path
      }
    }
    return ''
  }

  if (typeof action === 'string') {
    return resolveInlineActionPath(state, state.action[action])
  }

  if (!action || typeof action !== 'object') {
    return ''
  }

  const type = String(action.type || '').trim().toLowerCase()
  if (type !== 'save' && type !== 'delete') {
    return ''
  }

  const currentPagePath = String(state.pagePath || state.schema.page?.route || '')
  return resolveInlineSavePath(action.path, currentPagePath)
}

function resolveInlineSavePath(configuredPath: unknown, currentPagePath: string) {
  const explicitPath = normalizeInlineSavePath(configuredPath)
  if (explicitPath) {
    return explicitPath
  }

  const currentRoute = normalizeInlineSavePath(currentPagePath)
  if (!currentRoute) {
    return ''
  }

  if (currentRoute.endsWith('/list')) {
    return `${currentRoute.slice(0, -5)}/update`
  }

  return currentRoute
}

function normalizeInlineSavePath(path: unknown) {
  return String(path ?? '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
}

function resolveInlineRowID(row: Record<string, any>, rowKey: string) {
  const keyValue = rowKey ? getByPath(row, rowKey) : undefined
  return keyValue ?? row?.id
}

function isEmptyInlineRowID(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) {
    return true
  }

  const numberValue = Number(text)
  return Number.isFinite(numberValue) && numberValue <= 0
}

function isSameEditableValue(current: any, next: any) {
  if (Array.isArray(current) || Array.isArray(next)) {
    return JSON.stringify(current ?? []) === JSON.stringify(next ?? [])
  }
  return String(current ?? '') === String(next ?? '')
}

function buildInlineEditorStyle(source: unknown, editorType: string): CSSProperties {
  const text = String(source ?? '').trim()
  const length = text.length || 4

  if (editorType === 'form-select') {
    const width = Math.max(8, Math.min(14, length + 3))
    return {
      width: `${width}ch`,
      maxWidth: '100%',
    }
  }

  if (editorType === 'form-number') {
    const width = Math.max(8, Math.min(12, length + 3))
    return {
      width: `${width}ch`,
      maxWidth: '100%',
    }
  }

  const width = Math.max(6, Math.min(18, length + 2))
  return {
    width: `${width}ch`,
    maxWidth: '100%',
  }
}

function buildInlineToastOptions(column: Column) {
  const fieldName = resolveInlineToastFieldName(column)
  return {
    successMessage: column.meta?.successMessage,
    errorMessage: column.meta?.errorMessage,
    defaultSuccessMessage: fieldName ? `${fieldName}修改成功` : '操作成功',
    defaultErrorMessage: fieldName ? `${fieldName}修改失败` : '修改失败',
  }
}

function resolveInlineToastFieldName(column: Column) {
  return String(column.name || column.meta?.label || '').trim()
}

function shouldToastInlineAction(
  result: { success: boolean },
  action: any,
  actionMap: Record<string, any>
) {
  if (!result.success) {
    return true
  }

  return hasRemoteInlineAction(action, actionMap)
}

function hasRemoteInlineAction(
  action: any,
  actionMap: Record<string, any>,
  visited = new Set<string>()
): boolean {
  if (Array.isArray(action)) {
    return action.some((current) => hasRemoteInlineAction(current, actionMap, visited))
  }

  if (typeof action === 'string') {
    if (visited.has(action)) {
      return false
    }
    visited.add(action)
    return hasRemoteInlineAction(actionMap[action], actionMap, visited)
  }

  if (!action || typeof action !== 'object') {
    return false
  }

  return ['request', 'save', 'delete', 'export', 'import'].includes(
    String(action.type || '').trim().toLowerCase()
  )
}
