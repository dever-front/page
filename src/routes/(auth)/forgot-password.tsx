import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const ForgotPassword = lazyRouteComponent(() =>
  import('@/features/auth/forgot-password').then((mod) => ({
    default: mod.ForgotPassword,
  }))
)

export const Route = createFileRoute('/(auth)/forgot-password')({
  component: ForgotPassword,
})
