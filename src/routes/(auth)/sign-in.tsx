import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { lazyRouteComponent } from '@/lib/lazy-route'
import { FrontBootScreen } from '@/components/layout/front-boot-screen'

const SignIn = lazyRouteComponent(
  () =>
    import('@/features/auth/sign-in').then((mod) => ({ default: mod.SignIn })),
  <FrontBootScreen />
)

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
})
