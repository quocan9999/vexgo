'use client';

import { useAdminSession } from './use-admin-session';
import {
  hasAdminPermission,
  hasAllAdminPermissions,
  type AdminPermission,
} from '../services/admin-access';

export function useAdminPermissions() {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated'
    ? authState.session
    : null;

  return {
    can: (permission: AdminPermission) =>
      hasAdminPermission(session, permission),
    canAll: (permissions: readonly AdminPermission[]) =>
      hasAllAdminPermissions(session, permissions),
  };
}
