import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  acquireActionSubmission,
  actionSubmissionScopes,
  type SubmissionAction,
  type SubmissionContext,
} from '@/lib/action-submission'
import type { PageStore } from '@/lib/store'

export function useActionSubmission(
  store: PageStore | null,
  actions?: SubmissionAction | SubmissionAction[],
  context: SubmissionContext = {},
  fallbackKey?: string
) {
  const scopes = store
    ? actionSubmissionScopes(store, actions, context, fallbackKey)
    : []
  const isSubmitting = () =>
    scopes.some(({ store, key }) =>
      store.getState().pendingSubmissions.has(key)
    )
  const parentStore = store?.getState().parentStore
  const modalStore = context.modalStore
  const modalParentStore = modalStore?.getState().parentStore
  const observedStores = useMemo(
    () =>
      [...new Set([store, parentStore, modalStore, modalParentStore])].filter(
        (value): value is PageStore => !!value
      ),
    [store, parentStore, modalStore, modalParentStore]
  )
  const subscribe = useCallback(
    (notify: () => void) => {
      const unsubscribe = observedStores.map((store) => store.subscribe(notify))
      return () => unsubscribe.forEach((stop) => stop())
    },
    [observedStores]
  )
  const submitting = useSyncExternalStore(subscribe, isSubmitting, isSubmitting)
  const run = async <T>(
    perform: (execution: SubmissionContext) => Promise<T>
  ): Promise<T | undefined> => {
    if (!store) return undefined
    const submission = acquireActionSubmission(scopes, context)
    if (!submission) return undefined
    try {
      return await perform(submission.context)
    } finally {
      submission.release()
    }
  }
  return { submitting, isSubmitting, run }
}
