export const TENANT_RBAC_ROLE_NAMES = [
  'NHA_XE_ADMIN',
  'NHAN_VIEN_DIEU_HANH',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
] as const;

export type TenantRbacRoleName = (typeof TENANT_RBAC_ROLE_NAMES)[number];

export type TenantRbacPermission = {
  key: string;
  scope: 'tenant';
  description: string;
};

export type TenantRbacRole = {
  roleName: TenantRbacRoleName;
  description: string | null;
  scope: 'tenant';
  isProtected: false;
  defaultPermissionKeys: string[];
  overridePermissionKeys: string[] | null;
  effectivePermissionKeys: string[];
  source: 'global' | 'override';
};

export type TenantRbacConfig = {
  permissions: TenantRbacPermission[];
  roles: TenantRbacRole[];
};
