import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await api.get<{ user_id: string; permissions: string[] }>('/users/me/permissions')
        setPermissions(res.permissions || [])
      } catch {
        setPermissions([])
      } finally {
        setLoading(false)
      }
    }
    fetchPermissions()
  }, [])

  const hasPermission = useCallback(
    (perm: string) => permissions.includes(perm),
    [permissions]
  )

  const hasAnyPermission = useCallback(
    (perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions]
  )

  const hasAllPermissions = useCallback(
    (perms: string[]) => perms.every((p) => permissions.includes(p)),
    [permissions]
  )

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
