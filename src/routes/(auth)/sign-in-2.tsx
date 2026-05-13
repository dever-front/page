import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'

const SignIn2 = lazyRouteComponent(() =>
  import('@/features/auth/sign-in/sign-in-2').then((mod) => ({
    default: mod.SignIn2,
  }))
)

export const Route = createFileRoute('/(auth)/sign-in-2')({
  component: SignIn2,
})
