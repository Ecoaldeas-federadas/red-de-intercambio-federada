import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [superAdminEnabled, setSuperAdminEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await api.get<{ user_id: string; permissions: string[]; is_super_admin?: boolean; super_admin_enabled?: boolean }>('/users/me/permissions')
        setPermissions(res.permissions || [])
        setIsSuperAdmin(res.is_super_admin || false)
        setSuperAdminEnabled(res.super_admin_enabled || false)
      } catch {
        setPermissions([])
        setIsSuperAdmin(false)
        setSuperAdminEnabled(false)
      } finally {
        setLoading(false)
      }
    }
    fetchPermissions()
  }, [])

  const hasPermission = useCallback(
    (perm: string) => {
      // Super admin habilitado tiene todos los permisos
      if (isSuperAdmin && superAdminEnabled) return true
      return permissions.includes(perm)
    },
    [permissions, isSuperAdmin, superAdminEnabled]
  )

  const hasAnyPermission = useCallback(
    (perms: string[]) => {
      if (isSuperAdmin && superAdminEnabled) return true
      return perms.some((p) => permissions.includes(p))
    },
    [permissions, isSuperAdmin, superAdminEnabled]
  )

  const hasAllPermissions = useCallback(
    (perms: string[]) => {
      if (isSuperAdmin && superAdminEnabled) return true
      return perms.every((p) => permissions.includes(p))
    },
    [permissions, isSuperAdmin, superAdminEnabled]
  )

  return {
    permissions,
    isSuperAdmin,
    superAdminEnabled,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
