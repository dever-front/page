import { useSearch } from '@tanstack/react-router'
import { UserAuthForm } from '@/features/auth/sign-in/components/user-auth-form'
import type { NodeItemProps } from '../../nodes'

export function AppLoginForm({ item }: NodeItemProps) {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <UserAuthForm
      redirectTo={redirect}
      accountLabel={item.meta?.accountLabel}
      accountPlaceholder={item.meta?.accountPlaceholder}
      passwordLabel={item.meta?.passwordLabel}
      passwordPlaceholder={item.meta?.passwordPlaceholder}
      submitText={item.meta?.submitText}
      loadingText={item.meta?.loadingText}
    />
  )
}
