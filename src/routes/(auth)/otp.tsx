import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const Otp = lazyRouteComponent(() =>
  import('@/features/auth/otp').then((mod) => ({ default: mod.Otp }))
)

export const Route = createFileRoute('/(auth)/otp')({
  component: Otp,
})
