import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { hideInitialBootScreen } from '@/lib/initial-boot'
import { loadMainInfo } from '@/lib/request'
import { stripRouterBasePath } from '@/lib/router-path'
import { resolveFirstRemoteMenuUrl } from '@/components/layout/menu'

export const Route = createFileRoute('/_authenticated/')({
  component: AuthenticatedIndex,
})

function AuthenticatedIndex() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function loadEntry() {
      const { entry, menu } = await loadMainInfo()
      if (cancelled) return

      const target = entry
        ? stripRouterBasePath(`/${entry.replace(/^\/+/, '')}`)
        : resolveFirstRemoteMenuUrl(menu)
      if (!target) {
        hideInitialBootScreen()
        return
      }
      navigate({ to: target, replace: true })
    }

    void loadEntry()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return null
}
