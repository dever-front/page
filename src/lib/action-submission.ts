import { getByPath, resolvePath } from './path'
import type { ActionConfig } from './schema'
import type { PageStore } from './store'

const submissionOwner = Symbol('action submission owner')

export type SubmissionContext = Record<string, unknown> & {
  modalStore?: PageStore
  row?: Record<string, unknown>
  item?: Record<string, unknown>
  [submissionOwner]?: symbol
}
export type SubmissionAction = string | ActionConfig
export type SubmissionScope = { store: PageStore; key: string }
export const FORM_SUBMISSION_KEY = JSON.stringify(['form', 'data', 'form'])

export function actionSubmissionScopes(
  store: PageStore,
  actions: SubmissionAction | SubmissionAction[] | undefined,
  context: SubmissionContext = {},
  fallbackKey?: string
): SubmissionScope[] {
  const scopes: SubmissionScope[] = []
  const visited = new Set<string>()
  const visit = (invocation: SubmissionAction) => {
    if (typeof invocation === 'string' && visited.has(invocation)) return
    if (typeof invocation === 'string') visited.add(invocation)
    const original =
      typeof invocation === 'string'
        ? store.getState().action[invocation]
        : invocation
    if (!original) return
    const config =
      typeof invocation === 'string' && !original.key
        ? { ...original, key: invocation }
        : original
    if (isWritingAction(config)) {
      const resource = submissionResource(store, config, context)
      if (resource) {
        const rowKey = String(context.rowKey || 'id')
        const key = context.row
          ? JSON.stringify([
              'row',
              rowKey,
              getByPath(context.row, rowKey) ?? context.rowIndex,
              config.path || store.getState().pagePath,
              config.key || config.api || config.type,
              context.field || '',
            ])
          : JSON.stringify(['form', resource.scope, resource.key])
        scopes.push({ store: resource.store, key })
      }
      // 弹窗本身的提交生命周期与实际参数所属页面同时受保护。
      if (context.modalStore)
        scopes.push({ store: context.modalStore, key: FORM_SUBMISSION_KEY })
    }
    const nextActions = config.then
      ? Array.isArray(config.then)
        ? config.then
        : [config.then]
      : []
    for (const next of nextActions) visit(next)
  }
  for (const action of actions
    ? Array.isArray(actions)
      ? actions
      : [actions]
    : [])
    visit(action)
  if (!scopes.length && fallbackKey)
    scopes.push({ store: context.modalStore ?? store, key: fallbackKey })
  return scopes
}

function submissionResource(
  store: PageStore,
  config: ActionConfig,
  context: SubmissionContext
) {
  const params = typeof config.params === 'string' ? config.params : 'form'
  if (params.startsWith('$')) {
    const [reference, ...rest] = params.slice(1).split('.')
    const modalPaths: Record<string, { scope: string; key: string }> = {
      modalForm: { scope: 'data', key: ['form', ...rest].join('.') },
      modalData: { scope: 'data', key: rest.join('.') },
      modalState: { scope: 'state', key: rest.join('.') },
    }
    const modalPath = modalPaths[reference]
    return modalPath
      ? { store: context.modalStore ?? store, ...modalPath }
      : { store, scope: 'data', key: 'form' }
  }

  const path = resolvePath(params)
  const ownerStore =
    path.owner === 'parent' ? store.getState().parentStore : store
  return ownerStore
    ? { store: ownerStore, scope: path.scope, key: path.key }
    : null
}

function isWritingAction(config: ActionConfig) {
  return (
    ['save', 'delete', 'import', 'export'].includes(config.type) ||
    (config.type === 'request' && isMutatingRequestMethod(config.method))
  )
}

function groupSubmissionScopes(scopes: SubmissionScope[]) {
  const groups = new Map<PageStore, Set<string>>()
  for (const { store, key } of scopes) {
    const keys = groups.get(store) ?? new Set<string>()
    keys.add(key)
    groups.set(store, keys)
  }
  return groups
}

// 整条动作链先同步抢占所有表单；嵌套 then 继承所有者，重复触发不能借用结果。
export function acquireActionSubmission(
  scopes: SubmissionScope[],
  context: SubmissionContext = {}
): { context: SubmissionContext; release: () => void } | null {
  const owner = context[submissionOwner] ?? Symbol('submission')
  const groups = groupSubmissionScopes(scopes)
  for (const [store, keys] of groups) {
    const pending = store.getState().pendingSubmissions
    if ([...keys].some((key) => pending.has(key) && pending.get(key) !== owner))
      return null
  }
  const acquired = new Map<PageStore, string[]>()
  for (const [store, keys] of groups) {
    const pending = store.getState().pendingSubmissions
    const newKeys = [...keys].filter((key) => !pending.has(key))
    if (!newKeys.length) continue
    const next = new Map(pending)
    for (const key of newKeys) next.set(key, owner)
    acquired.set(store, newKeys)
    store.setState({ pendingSubmissions: next })
  }
  return {
    context: { ...context, [submissionOwner]: owner },
    release: () => {
      for (const [store, keys] of acquired) {
        const next = new Map(store.getState().pendingSubmissions)
        for (const key of keys) {
          if (next.get(key) === owner) next.delete(key)
        }
        store.setState({ pendingSubmissions: next })
      }
      acquired.clear()
    },
  }
}

export function isMutatingRequestMethod(method?: string) {
  return ['post', 'put', 'patch', 'delete'].includes(
    String(method || 'get')
      .trim()
      .toLowerCase()
  )
}
