import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { loadMainInfo } from '@/lib/request'
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
        ? `/${entry.replace(/^\/+/, '')}`
        : resolveFirstRemoteMenuUrl(menu)
      if (!target) {
        return
      }
      navigate({ to: target, replace: true })
    }

    loadEntry()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return null
}
