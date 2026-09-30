export const ADMIN_PERMISSION_CATALOG = [
  {
    key: 'vehicle-type:read',
    description: 'Xem danh sách và chi tiết loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle-type:create',
    description: 'Tạo loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle-type:update',
    description: 'Cập nhật loại xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:read',
    description: 'Xem danh sách và chi tiết xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:create',
    description: 'Tạo xe trong phạm vi nhà xe.',
  },
  {
    key: 'vehicle:update',
    description: 'Cập nhật xe và trạng thái xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:read',
    description: 'Xem cấu hình ghế của xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:create',
    description: 'Thêm ghế vào xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:update',
    description: 'Cập nhật ghế của xe trong phạm vi nhà xe.',
  },
  {
    key: 'seat:delete',
    description: 'Xóa ghế khỏi xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:read',
    description: 'Xem danh sách và chi tiết tuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:create',
    description: 'Tạo tuyến xe trong phạm vi nhà xe.',
  },
  {
    key: 'route:update',
    description: 'Cập nhật tuyến xe và trạng thái tuyến trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:read',
    description: 'Xem và tra cứu bảng giá vé trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:create',
    description: 'Tạo bảng giá vé trong phạm vi nhà xe.',
  },
  {
    key: 'fare-price:update',
    description:
      'Cập nhật bảng giá vé và trạng thái bảng giá trong phạm vi nhà xe.',
  },
  {
    key: 'bus-company:read',
    description: 'Xem danh sách và chi tiết nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:create',
    description: 'Tạo nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:update',
    description: 'Cập nhật nhà xe và trạng thái nhà xe trên nền tảng.',
  },
  {
    key: 'admin-account:read',
    description: 'Xem danh sách và chi tiết tài khoản quản trị trên nền tảng.',
  },
  {
    key: 'admin-account:create',
    description: 'Tạo tài khoản quản trị nhà xe trên nền tảng.',
  },
  {
    key: 'admin-account:update',
    description: 'Cập nhật và thay đổi trạng thái tài khoản quản trị nhà xe.',
  },
] as const;

export type AdminPermissionKey =
  (typeof ADMIN_PERMISSION_CATALOG)[number]['key'];

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
  ],
  NHAN_VIEN_BAN_VE: [],
  NHAN_VIEN_CSKH: [],
  NHAN_VIEN_PHU_XE: [],
  NHAN_VIEN_KINH_DOANH: [],
  KHACH_HANG: [],
} as const satisfies Record<string, readonly AdminPermissionKey[]>;
