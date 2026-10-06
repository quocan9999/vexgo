export type AdminPermissionScope = 'platform' | 'tenant';

export const ADMIN_PERMISSION_CATALOG = [
  {
    key: 'vehicle-type:read',
    scope: 'tenant',
    description: 'Xem danh sách và chi tiết loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle-type:create',
    scope: 'tenant',
    description: 'Tạo loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle-type:update',
    scope: 'tenant',
    description: 'Cập nhật loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:read',
    scope: 'tenant',
    description: 'Xem danh sách và chi tiết xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:create',
    scope: 'tenant',
    description: 'Tạo xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:update',
    scope: 'tenant',
    description: 'Cập nhật xe và trạng thái xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:read',
    scope: 'tenant',
    description: 'Xem cấu hình ghế của xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:create',
    scope: 'tenant',
    description: 'Thêm ghế vào xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:update',
    scope: 'tenant',
    description: 'Cập nhật ghế của xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:delete',
    scope: 'tenant',
    description: 'Xóa ghế khỏi xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:read',
    scope: 'tenant',
    description: 'Xem danh sách và chi tiết tuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:create',
    scope: 'tenant',
    description: 'Tạo tuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:update',
    scope: 'tenant',
    description: 'Cập nhật tuyến xe và trạng thái tuyến trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:read',
    scope: 'tenant',
    description: 'Xem và tra cứu bảng giá vé trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:create',
    scope: 'tenant',
    description: 'Tạo bảng giá vé trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:update',
    scope: 'tenant',
    description:
      'Cập nhật bảng giá vé và trạng thái bảng giá trong phạm vi nhà xe.',
  },
  {
    key: 'trip:read',
    scope: 'tenant',
    description: 'Xem danh sách và chi tiết chuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'trip:create',
    scope: 'tenant',
    description: 'Tạo chuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'trip:update',
    scope: 'tenant',
    description:
      'Cập nhật chuyến xe và trạng thái chuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'trip:cancel',
    scope: 'tenant',
    description: 'Hủy chuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'role:read',
    scope: 'tenant',
    description: 'Xem cấu hình quyền vai trò trong phạm vi nhà xe.',
  },
  {
    key: 'permission:assign',
    scope: 'tenant',
    description: 'Gán quyền cho vai trò trong phạm vi nhà xe.',
  },
  {
    key: 'customer:read',
    scope: 'tenant',
    description:
      'Xem danh sách, chi tiết và lịch sử khách hàng có giao dịch trong phạm vi nhà xe.',
  },
  {
    key: 'bus-company:read',
    scope: 'platform',
    description: 'Xem danh sách và chi tiết nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:create',
    scope: 'platform',
    description: 'Tạo nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:update',
    scope: 'platform',
    description: 'Cập nhật nhà xe và trạng thái nhà xe trên nền tảng.',
  },
  {
    key: 'admin-account:read',
    scope: 'platform',
    description: 'Xem danh sách và chi tiết tài khoản quản trị trên nền tảng.',
  },
  {
    key: 'admin-account:create',
    scope: 'platform',
    description: 'Tạo tài khoản quản trị nhà xe trên nền tảng.',
  },
  {
    key: 'admin-account:update',
    scope: 'platform',
    description: 'Cập nhật và thay đổi trạng thái tài khoản quản trị nhà xe.',
  },
] as const;

export type AdminPermissionKey =
  (typeof ADMIN_PERMISSION_CATALOG)[number]['key'];

export const ADMIN_PERMISSION_SCOPE_BY_KEY: ReadonlyMap<
  string,
  AdminPermissionScope
> = new Map(
  ADMIN_PERMISSION_CATALOG.map(({ key, scope }) => [key, scope] as const),
);

export const ADMIN_ROLE_DEFAULT_PERMISSION_KEYS = {
  SUPER_ADMIN: [
    'bus-company:read',
    'bus-company:create',
    'bus-company:update',
    'admin-account:read',
    'admin-account:create',
    'admin-account:update',
  ],
  NHA_XE_ADMIN: [
    'vehicle-type:read',
    'vehicle-type:create',
    'vehicle-type:update',
    'vehicle:read',
    'vehicle:create',
    'vehicle:update',
    'seat:read',
    'seat:create',
    'seat:update',
    'seat:delete',
    'route:read',
    'route:create',
    'route:update',
    'fare-price:read',
    'fare-price:create',
    'fare-price:update',
    'trip:read',
    'trip:create',
    'trip:update',
    'trip:cancel',
    'role:read',
    'permission:assign',
    'customer:read',
  ],
  NHAN_VIEN_DIEU_HANH: [
    'vehicle-type:read',
    'vehicle-type:create',
    'vehicle-type:update',
    'vehicle:read',
    'vehicle:create',
    'vehicle:update',
    'seat:read',
    'seat:create',
    'seat:update',
    'seat:delete',
    'route:read',
    'route:create',
    'route:update',
    'fare-price:read',
    'fare-price:create',
    'fare-price:update',
    'trip:read',
    'trip:create',
    'trip:update',
    'trip:cancel',
  ],
  NHAN_VIEN_BAN_VE: [],
  NHAN_VIEN_CSKH: [],
  NHAN_VIEN_PHU_XE: [],
  NHAN_VIEN_KINH_DOANH: [],
  KHACH_HANG: [],
} as const satisfies Record<string, readonly AdminPermissionKey[]>;

export const ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME = {
  SUPER_ADMIN: 'platform',
  NHA_XE_ADMIN: 'tenant',
  NHAN_VIEN_DIEU_HANH: 'tenant',
  NHAN_VIEN_BAN_VE: 'tenant',
  NHAN_VIEN_CSKH: 'tenant',
  NHAN_VIEN_PHU_XE: 'tenant',
  NHAN_VIEN_KINH_DOANH: 'tenant',
} as const satisfies Record<string, AdminPermissionScope>;

export type AdminManagedRoleName =
  keyof typeof ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME;

export function isPermissionAllowedForRole(
  roleName: string,
  permissionKey: string,
): boolean {
  const roleScope =
    ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME[roleName as AdminManagedRoleName];
  return (
    roleScope !== undefined &&
    ADMIN_PERMISSION_SCOPE_BY_KEY.get(permissionKey) === roleScope
  );
}
