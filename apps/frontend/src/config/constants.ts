// /src/config/constants.ts
import { NeedType, PropertyType, PostStatus } from './enums';

export const APP_CONFIG = {
  NAME: 'BusWay',
  SHORT_NAME: 'BusWay',
  SLOGAN: 'Chọn chuyến · Chọn ghế · Di chuyển an tâm',
  HOTLINE: '1900 6789',
  EMAIL: 'support@busway.vn',
  ADDRESS: 'Tầng 8, Tòa nhà Landmark, TP. Hồ Chí Minh',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'busway_access_token',
  REFRESH_TOKEN: 'busway_refresh_token',
  USER_INFO: 'busway_user_info',
  SAVED_SEARCHES: 'busway_saved_searches',
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  [PropertyType.RESIDENTIAL_LAND]: 'Đất thổ cư / Đất nền',
  [PropertyType.TOWNHOUSE]: 'Nhà phố / Nhà riêng',
  [PropertyType.VILLA]: 'Biệt thự / Liền kề',
  [PropertyType.APARTMENT]: 'Căn hộ / Chung cư',
  [PropertyType.COMMERCIAL]: 'Mặt bằng kinh doanh',
  [PropertyType.WAREHOUSE]: 'Kho xưởng / Bến bãi',
  [PropertyType.AGRICULTURAL_LAND]: 'Đất nông nghiệp / Vườn',
  [PropertyType.OTHER]: 'Bất động sản khác',
};

export const NEED_TYPE_LABELS: Record<NeedType, string> = {
  [NeedType.BUY]: 'Đặt vé',
  [NeedType.RENT]: 'Gửi hàng',
};

export const POST_STATUS_CONFIG: Record<
  PostStatus,
  { label: string; badgeClass: string; iconName: string }
> = {
  [PostStatus.APPROVED]: {
    label: 'Đang hiển thị',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    iconName: 'CheckCircle2',
  },
  [PostStatus.PENDING]: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    iconName: 'Clock',
  },
  [PostStatus.REJECTED]: {
    label: 'Bị từ chối',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    iconName: 'XCircle',
  },
  [PostStatus.DRAFT]: {
    label: 'Bản nháp',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    iconName: 'FileEdit',
  },
  [PostStatus.HIDDEN]: {
    label: 'Tạm ẩn',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    iconName: 'EyeOff',
  },
  [PostStatus.EXPIRED]: {
    label: 'Hết hạn',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    iconName: 'AlertTriangle',
  },
  [PostStatus.COMPLETED]: {
    label: 'Đã hoàn tất',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    iconName: 'CheckCheck',
  },
};

export const DEFAULT_DONATION_ACCOUNTS = [
  {
    id: 'bank-1',
    bankName: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
    shortBank: 'Vietcombank',
    accountNumber: '1029384756',
    accountHolder: 'NGUYEN TAN DONG - HOI KING CONNECT LAND',
    branch: 'Chi nhánh TP. Hồ Chí Minh',
    qrCodeUrl: '/images/qr-vcb.png',
  },
  {
    id: 'bank-2',
    bankName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
    shortBank: 'MB Bank',
    accountNumber: '888899998888',
    accountHolder: 'HOI BAT DONG SAN KING CONNECT LAND',
    branch: 'Hội sở chính',
    qrCodeUrl: '/images/qr-mbbank.png',
  },
];
