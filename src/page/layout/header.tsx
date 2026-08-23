/**
 * Header.tsx - 顶部栏布局
 * 页面级标题条，位于全局顶栏下方
 */
import { useStore } from 'zustand'
import { usePageStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { AssistantFormFillButton } from '@/components/assistant/form-actions'
import type { LayoutComponentProps } from './types'

export function Header({ config, children }: LayoutComponentProps) {
  const store = usePageStore()
  const isNestedPage = useStore(store, (state) => !!state.parentStore)

  if (isNestedPage && config.meta?.hideWhenNested === true) {
    return null
  }

  return (
    <section
      className={cn(
        'border-b border-border/60 bg-background px-4 py-3 sm:px-5',
        config.className
      )}
    >
      <div className='flex min-h-12 min-w-0 items-center gap-3'>
        {children}
        {!isNestedPage ? (
          <AssistantFormFillButton store={store} scope='page' />
        ) : null}
      </div>
    </section>
  )
}
