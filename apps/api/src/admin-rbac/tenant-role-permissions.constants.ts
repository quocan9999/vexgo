import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';

export const TENANT_RBAC_ROLE_NAMES = TENANT_PRINCIPAL_ROLES;
export type TenantRbacRoleName = (typeof TENANT_RBAC_ROLE_NAMES)[number];
