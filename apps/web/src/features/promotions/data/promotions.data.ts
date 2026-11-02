export interface Promotion {
  id: string;
  slug?: string;
  code: string;
  title: string;
  subtitle: string;
  discountBadge: string;
  discountValue: string;
  category: 'ALL' | 'NEW' | 'LIMOUSINE' | 'TOURISM';
  img: string;
  alt: string;
  startDate: string;
  endDate: string;
  summary: string;
  description: string[];
  conditions: string[];
  guide: string[];
  applicableRoutes: {
    origin: string;
    destination: string;
    label: string;
    price: string;
  }[];
}

export const PROMOTIONS: Promotion[] = [
  {
    id: '1',
    slug: 'futa10',
    code: 'FUTA10',
    title: 'Ưu đãi khách hàng mới - Giảm 10% giá vé',
    subtitle: 'Chuyến xe an toàn, hành trình trọn vẹn cùng VexGo',
    discountBadge: 'GIẢM 10%',
    discountValue: 'Giảm 10% (Tối đa 50.000đ)',
    category: 'NEW',
    img: '/images/promo2.jpg',
    alt: 'Khuyến mãi đặt vé xe khách giảm 10%',
    startDate: '01/09/2026',
    endDate: '31/12/2026',
    summary:
      'Chương trình ưu đãi dành riêng cho hành khách lần đầu đặt vé xe khách trực tuyến trên nền tảng VexGo. Nhập mã để nhận ngay mức giảm 10% giá vé.',
    description: [
      'VexGo hân hạnh đồng hành cùng hàng triệu hành khách trên khắp cả nước với chương trình khuyến mãi đặc quyền dành cho khách hàng mới.',
      'Chỉ cần tạo tài khoản hoặc đặt vé lần đầu bằng số điện thoại của bạn, hệ thống sẽ tự động xác thực và áp dụng mức giảm 10% (tối đa 50.000đ) vào tổng hóa đơn đặt vé.',
      'Ưu đãi áp dụng trên mọi tuyến xe liên tỉnh do các đối tác nhà xe uy tín vận hành, không giới hạn khung giờ hay loại xe.',
    ],
    conditions: [
      'Áp dụng cho đơn hàng đặt vé xe khách đầu tiên gắn với số điện thoại đặt vé.',
      'Mỗi số điện thoại hoặc tài khoản được sử dụng mã tối đa 01 lần.',
      'Mức giảm tối đa là 50.000 VNĐ trên tổng tiền vé ban đầu.',
      'Không áp dụng đồng thời với các chương trình khuyến mãi mã giảm khác.',
      'Không có giá trị quy đổi thành tiền mặt hoặc chuyển nhượng.',
    ],
    guide: [
      'Bước 1: Tìm chuyến xe phù hợp tại trang chủ hoặc trang Chuyến xe.',
      'Bước 2: Chọn vị trí ghế ngồi ưng ý trên sơ đồ xe thực tế và nhập thông tin hành khách.',
      'Bước 3: Tại màn hình thanh toán, nhập mã "FUTA10" vào ô Mã giảm giá và nhấn "Áp dụng".',
      'Bước 4: Kiểm tra số tiền được giảm trừ và tiến hành thanh toán an toàn.',
    ],
    applicableRoutes: [
      { origin: 'TP.HCM', destination: 'Đà Lạt', label: 'TP.HCM đi Đà Lạt', price: 'từ 180.000đ' },
      { origin: 'TP.HCM', destination: 'Nha Trang', label: 'TP.HCM đi Nha Trang', price: 'từ 290.000đ' },
      { origin: 'Đà Nẵng', destination: 'Đà Lạt', label: 'Đà Nẵng đi Đà Lạt', price: 'từ 350.000đ' },
      { origin: 'TP.HCM', destination: 'Vũng Tàu', label: 'TP.HCM đi Vũng Tàu', price: 'từ 200.000đ' },
    ],
  },
  {
    id: '2',
    slug: 'futa-fix-30k',
    code: 'FUTAFIX30K',
    title: 'Giảm thẳng 30.000đ vé Limousine & Vé khứ hồi',
    subtitle: 'Nâng tầm trải nghiệm xe phòng nằm VIP với chi phí tiết kiệm nhất',
    discountBadge: 'GIẢM 30.000Đ',
    discountValue: 'Giảm trực tiếp 30.000đ/vé',
    category: 'LIMOUSINE',
    img: '/images/promo1.jpg',
    alt: 'Ưu đãi xe Limousine và vé khứ hồi',
    startDate: '01/09/2026',
    endDate: '31/12/2026',
    summary:
      'Trải nghiệm dòng xe Limousine giường phòng đôi và phòng đơn cao cấp hoặc đặt vé khứ hồi 2 chiều để được trừ ngay 30.000đ trên mỗi vé.',
    description: [
      'Dòng xe Limousine phòng VIP mang lại không gian nghỉ ngơi riêng tư tuyệt đối với rèm che độc lập, nệm massage thư giãn, cổng sạc điện thoại và wifi tốc độ cao.',
      'Với mã FUTAFIX30K, VexGo tài trợ ngay 30.000đ cho mỗi lượt vé xe Limousine hoặc khi khách hàng chọn mua vé cả 2 chiều (đi và về) cùng lúc.',
      'Chương trình áp dụng linh hoạt cho cả các chuyến xe ngày và chuyến xe đêm trên các tuyến đường du lịch, công tác trọng điểm.',
    ],
    conditions: [
      'Áp dụng khi đặt loại xe Limousine giường phòng hoặc đơn hàng vé khứ hồi.',
      'Giảm thẳng 30.000 VNĐ vào hóa đơn cho mỗi lượt di chuyển hợp lệ.',
      'Áp dụng cho cả khách hàng mới và khách hàng thân thiết.',
      'Chương trình có thể kết thúc sớm khi hết lượt ngân sách phân bổ mỗi ngày.',
    ],
    guide: [
      'Bước 1: Chọn điểm đi, điểm đến và tích chọn "Khứ hồi" hoặc chọn xe Limousine.',
      'Bước 2: Chọn ghế lượt đi và lượt về theo sơ đồ phòng nằm.',
      'Bước 3: Nhập mã "FUTAFIX30K" tại bước thanh toán để nhận giảm giá 30.000đ.',
      'Bước 4: Hoàn tất thanh toán và nhận vé điện tử kèm mã QR tức thì.',
    ],
    applicableRoutes: [
      { origin: 'TP.HCM', destination: 'Đà Lạt', label: 'TP.HCM đi Đà Lạt (Limousine)', price: 'từ 320.000đ' },
      { origin: 'Đà Lạt', destination: 'TP.HCM', label: 'Đà Lạt về TP.HCM (Khứ hồi)', price: 'từ 320.000đ' },
      { origin: 'TP.HCM', destination: 'Nha Trang', label: 'TP.HCM đi Nha Trang (VIP)', price: 'từ 350.000đ' },
    ],
  },
  {
    id: '3',
    slug: 'vexgo2026',
    code: 'VEXGO2026',
    title: 'Đồng hành mùa du lịch - Vé xe chất lượng cao từ 180K',
    subtitle: 'Khám phá các điểm đến hot nhất với mạng lưới chuyến xe đa dạng',
    discountBadge: 'HOT DEAL',
    discountValue: 'Giá tốt nhất từ 180.000đ',
    category: 'TOURISM',
    img: '/images/promo3.jpg',
    alt: 'Khuyến mãi mùa du lịch',
    startDate: '01/10/2026',
    endDate: '31/12/2026',
    summary:
      'Gói ưu đãi liên kết giữa VexGo và các nhà xe đối tác lớn: giá vé niêm yết cạnh tranh, giữ đúng chỗ ngồi đã chọn 100% và hỗ trợ hoàn hủy linh hoạt.',
    description: [
      'Mùa du lịch cuối năm, nhu cầu di chuyển giữa các thành phố lớn và các điểm nghỉ dưỡng như Đà Lạt, Nha Trang, Vũng Tàu, Quy Nhơn tăng cao.',
      'VexGo hợp tác độc quyền cùng các nhà xe uy tín cam kết không tăng giá bất hợp lý, niêm yết vé giường nằm tiêu chuẩn chỉ từ 180.000đ/lượt.',
      'Hành khách được bảo đảm giữ chỗ chắc chắn, đón trả đúng giờ và hỗ trợ trực tuyến 24/7 qua cổng chăm sóc khách hàng.',
    ],
    conditions: [
      'Áp dụng cho các tuyến du lịch trọng điểm mở bán trên hệ thống.',
      'Khách hàng nên đặt vé trước ngày khởi hành từ 3 - 5 ngày để giữ vị trí đẹp.',
      'Mã áp dụng được cho mọi số lượng vé trong cùng một đơn đặt chỗ.',
      'Hỗ trợ đổi trả vé theo quy định tiêu chuẩn trước 2 giờ 30 phút.',
    ],
    guide: [
      'Bước 1: Tra cứu tuyến du lịch bạn muốn đi tại thanh tìm kiếm trang chủ.',
      'Bước 2: Lọc theo giờ khởi hành (sáng, trưa, tối) hoặc loại xe mong muốn.',
      'Bước 3: Chọn chỗ ngồi thuận tiện và điền thông tin người đi.',
      'Bước 4: Nhập mã "VEXGO2026" nếu có chương trình áp mã phụ trợ và thanh toán.',
    ],
    applicableRoutes: [
      { origin: 'TP.HCM', destination: 'Đà Lạt', label: 'Sài Gòn - Đà Lạt', price: 'từ 180.000đ' },
      { origin: 'TP.HCM', destination: 'Phan Thiết', label: 'Sài Gòn - Phan Thiết', price: 'từ 190.000đ' },
      { origin: 'TP.HCM', destination: 'Vũng Tàu', label: 'Sài Gòn - Vũng Tàu', price: 'từ 200.000đ' },
      { origin: 'Đà Nẵng', destination: 'Nha Trang', label: 'Đà Nẵng - Nha Trang', price: 'từ 300.000đ' },
    ],
  },
];

export function getPromotionById(idOrSlug: string): Promotion | undefined {
  const query = idOrSlug.toLowerCase();
  return PROMOTIONS.find(
    (p) =>
      p.id === idOrSlug ||
      p.code.toLowerCase() === query ||
      (p.slug && p.slug.toLowerCase() === query)
  );
}
