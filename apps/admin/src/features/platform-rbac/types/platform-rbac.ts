export type AdminRbacScope = 'platform' | 'tenant';

export const ADMIN_RBAC_ROLE_SCOPES = {
  SUPER_ADMIN: 'platform',
  NHA_XE_ADMIN: 'tenant',
  NHAN_VIEN_DIEU_HANH: 'tenant',
  NHAN_VIEN_BAN_VE: 'tenant',
  NHAN_VIEN_CSKH: 'tenant',
  NHAN_VIEN_PHU_XE: 'tenant',
  NHAN_VIEN_KINH_DOANH: 'tenant',
} as const satisfies Record<string, AdminRbacScope>;

export type AdminRbacRoleName = keyof typeof ADMIN_RBAC_ROLE_SCOPES;

export type AdminRbacPermission = {
  key: string;
  scope: AdminRbacScope;
  description: string;
};

export type AdminRbacRole = {
  roleName: AdminRbacRoleName;
  description: string | null;
  scope: AdminRbacScope;
  isProtected: boolean;
  permissionKeys: string[];
};

export type DefaultAdminRbacConfig = {
  permissions: AdminRbacPermission[];
  roles: AdminRbacRole[];
};
