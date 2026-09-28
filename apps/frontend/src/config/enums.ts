// /src/config/enums.ts

export enum UserRole {
  GUEST = 'GUEST',
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
}

export enum PostStatus {
  DRAFT = 'DRAFT',           // Bản nháp
  PENDING = 'PENDING',       // Chờ duyệt
  APPROVED = 'APPROVED',     // Đã duyệt (hiển thị công khai)
  REJECTED = 'REJECTED',     // Bị từ chối
  HIDDEN = 'HIDDEN',         // Tạm ẩn
  EXPIRED = 'EXPIRED',       // Hết hạn
  COMPLETED = 'COMPLETED',   // Đã hoàn tất nhu cầu
}

export enum NeedType {
  BUY = 'BUY',               // Cần mua
  RENT = 'RENT',             // Cần thuê
}

export enum PropertyType {
  RESIDENTIAL_LAND = 'RESIDENTIAL_LAND', // Đất thổ cư / Đất nền
  TOWNHOUSE = 'TOWNHOUSE',               // Nhà phố / Nhà riêng
  VILLA = 'VILLA',                       // Biệt thự / Liền kề
  APARTMENT = 'APARTMENT',               // Căn hộ / Chung cư
  COMMERCIAL = 'COMMERCIAL',             // Mặt bằng kinh doanh / Shophouse
  WAREHOUSE = 'WAREHOUSE',               // Kho / Nhà xưởng
  AGRICULTURAL_LAND = 'AGRICULTURAL_LAND',// Đất nông nghiệp / Đất vườn
  OTHER = 'OTHER',                       // Khác
}

export enum ContactStatus {
  PENDING = 'PENDING',       // Chưa xử lý
  IN_PROGRESS = 'IN_PROGRESS',// Đang xử lý
  RESOLVED = 'RESOLVED',     // Đã xử lý
}

export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING',
}

