export type MasterLocation = {
  id: string;
  name: string;
  value: string;
  aliases: string[];
  kind: 'province' | 'district' | 'station';
  province: string | null;
  popular?: boolean;
  address?: string;
};

export const POPULAR_LOCATIONS: MasterLocation[] = [
  {
    id: 'province:79',
    name: 'TP. Hồ Chí Minh',
    value: 'TP.HCM',
    aliases: ['Thành phố Hồ Chí Minh', 'Hồ Chí Minh', 'TP.HCM', 'TP HCM', 'Sài Gòn', 'Sai Gon', 'SG'],
    kind: 'province',
    province: null,
    popular: true,
  },
  {
    id: 'province:01',
    name: 'Hà Nội',
    value: 'Hà Nội',
    aliases: ['Thành phố Hà Nội', 'Hà Nội', 'Ha Noi', 'HN', 'Thủ đô'],
    kind: 'province',
    province: null,
    popular: true,
  },
  {
    id: 'district:672',
    name: 'TP. Đà Lạt',
    value: 'Đà Lạt (Lâm Đồng)',
    aliases: ['Đà Lạt', 'Da Lat', 'Thành phố Đà Lạt', 'DL', 'Lâm Đồng'],
    kind: 'district',
    province: 'Lâm Đồng',
    popular: true,
  },
  {
    id: 'province:48',
    name: 'Đà Nẵng',
    value: 'Đà Nẵng',
    aliases: ['Thành phố Đà Nẵng', 'Đà Nẵng', 'Da Nang', 'DN'],
    kind: 'province',
    province: null,
    popular: true,
  },
  {
    id: 'district:568',
    name: 'TP. Nha Trang',
    value: 'Nha Trang (Khánh Hòa)',
    aliases: ['Nha Trang', 'Thành phố Nha Trang', 'NT', 'Khánh Hòa'],
    kind: 'district',
    province: 'Khánh Hòa',
    popular: true,
  },
  {
    id: 'district:747',
    name: 'TP. Vũng Tàu',
    value: 'Vũng Tàu (Bà Rịa - Vũng Tàu)',
    aliases: ['Vũng Tàu', 'Vung Tau', 'Thành phố Vũng Tàu', 'VT', 'Bà Rịa - Vũng Tàu'],
    kind: 'district',
    province: 'Bà Rịa - Vũng Tàu',
    popular: true,
  },
  {
    id: 'province:92',
    name: 'Cần Thơ',
    value: 'Cần Thơ',
    aliases: ['Thành phố Cần Thơ', 'Cần Thơ', 'Can Tho', 'CT', 'Tây Đô'],
    kind: 'province',
    province: null,
    popular: true,
  },
  {
    id: 'district:593',
    name: 'TP. Phan Thiết',
    value: 'Phan Thiết (Bình Thuận)',
    aliases: ['Phan Thiết', 'Phan Thiet', 'Thành phố Phan Thiết', 'Mũi Né', 'Bình Thuận'],
    kind: 'district',
    province: 'Bình Thuận',
    popular: true,
  },
  {
    id: 'station:bx-mien-dong',
    name: 'Bến xe Miền Đông',
    value: 'Bến xe Miền Đông (TP.HCM)',
    aliases: ['Bến xe Miền Đông', 'Bx Miền Đông', 'BX Mien Dong', 'Bến xe Miền Đông Mới', 'TP.HCM', 'Hồ Chí Minh'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    popular: true,
    address: '292 Đinh Bộ Lĩnh, P. 26, Q. Bình Thạnh & TP. Thủ Đức',
  },
  {
    id: 'station:bx-mien-tay',
    name: 'Bến xe Miền Tây',
    value: 'Bến xe Miền Tây (TP.HCM)',
    aliases: ['Bến xe Miền Tây', 'Bx Miền Tây', 'BX Mien Tay', 'TP.HCM', 'Hồ Chí Minh'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    popular: true,
    address: '395 Kinh Dương Vương, An Lạc, Bình Tân',
  },
];

export const VIETNAM_PROVINCES: MasterLocation[] = [
  { id: 'province:01', name: 'Hà Nội', value: 'Hà Nội', aliases: ['Hà Nội', 'Ha Noi', 'HN'], kind: 'province', province: null },
  { id: 'province:79', name: 'TP. Hồ Chí Minh', value: 'TP.HCM', aliases: ['TP. Hồ Chí Minh', 'Hồ Chí Minh', 'TP.HCM', 'TP HCM', 'Sài Gòn', 'SG'], kind: 'province', province: null },
  { id: 'province:31', name: 'Hải Phòng', value: 'Hải Phòng', aliases: ['Hải Phòng', 'Hai Phong', 'HP'], kind: 'province', province: null },
  { id: 'province:48', name: 'Đà Nẵng', value: 'Đà Nẵng', aliases: ['Đà Nẵng', 'Da Nang', 'DN'], kind: 'province', province: null },
  { id: 'province:92', name: 'Cần Thơ', value: 'Cần Thơ', aliases: ['Cần Thơ', 'Can Tho', 'CT'], kind: 'province', province: null },
  { id: 'province:89', name: 'An Giang', value: 'An Giang', aliases: ['An Giang'], kind: 'province', province: null },
  { id: 'province:77', name: 'Bà Rịa - Vũng Tàu', value: 'Bà Rịa - Vũng Tàu', aliases: ['Bà Rịa - Vũng Tàu', 'Bà Rịa Vũng Tàu', 'Vũng Tàu', 'BRVT'], kind: 'province', province: null },
  { id: 'province:24', name: 'Bắc Giang', value: 'Bắc Giang', aliases: ['Bắc Giang'], kind: 'province', province: null },
  { id: 'province:06', name: 'Bắc Kạn', value: 'Bắc Kạn', aliases: ['Bắc Kạn'], kind: 'province', province: null },
  { id: 'province:95', name: 'Bạc Liêu', value: 'Bạc Liêu', aliases: ['Bạc Liêu'], kind: 'province', province: null },
  { id: 'province:27', name: 'Bắc Ninh', value: 'Bắc Ninh', aliases: ['Bắc Ninh'], kind: 'province', province: null },
  { id: 'province:83', name: 'Bến Tre', value: 'Bến Tre', aliases: ['Bến Tre'], kind: 'province', province: null },
  { id: 'province:52', name: 'Bình Định', value: 'Bình Định', aliases: ['Bình Định', 'Quy Nhơn'], kind: 'province', province: null },
  { id: 'province:74', name: 'Bình Dương', value: 'Bình Dương', aliases: ['Bình Dương', 'Thủ Dầu Một'], kind: 'province', province: null },
  { id: 'province:70', name: 'Bình Phước', value: 'Bình Phước', aliases: ['Bình Phước', 'Đồng Xoài'], kind: 'province', province: null },
  { id: 'province:60', name: 'Bình Thuận', value: 'Bình Thuận', aliases: ['Bình Thuận', 'Phan Thiết'], kind: 'province', province: null },
  { id: 'province:96', name: 'Cà Mau', value: 'Cà Mau', aliases: ['Cà Mau'], kind: 'province', province: null },
  { id: 'province:04', name: 'Cao Bằng', value: 'Cao Bằng', aliases: ['Cao Bằng'], kind: 'province', province: null },
  { id: 'province:66', name: 'Đắk Lắk', value: 'Đắk Lắk', aliases: ['Đắk Lắk', 'Dak Lak', 'Buôn Ma Thuột'], kind: 'province', province: null },
  { id: 'province:67', name: 'Đắk Nông', value: 'Đắk Nông', aliases: ['Đắk Nông', 'Dak Nong', 'Gia Nghĩa'], kind: 'province', province: null },
  { id: 'province:11', name: 'Điện Biên', value: 'Điện Biên', aliases: ['Điện Biên'], kind: 'province', province: null },
  { id: 'province:75', name: 'Đồng Nai', value: 'Đồng Nai', aliases: ['Đồng Nai', 'Biên Hòa'], kind: 'province', province: null },
  { id: 'province:87', name: 'Đồng Tháp', value: 'Đồng Tháp', aliases: ['Đồng Tháp', 'Cao Lãnh', 'Sa Đéc'], kind: 'province', province: null },
  { id: 'province:64', name: 'Gia Lai', value: 'Gia Lai', aliases: ['Gia Lai', 'Pleiku'], kind: 'province', province: null },
  { id: 'province:02', name: 'Hà Giang', value: 'Hà Giang', aliases: ['Hà Giang'], kind: 'province', province: null },
  { id: 'province:35', name: 'Hà Nam', value: 'Hà Nam', aliases: ['Hà Nam', 'Phủ Lý'], kind: 'province', province: null },
  { id: 'province:42', name: 'Hà Tĩnh', value: 'Hà Tĩnh', aliases: ['Hà Tĩnh'], kind: 'province', province: null },
  { id: 'province:30', name: 'Hải Dương', value: 'Hải Dương', aliases: ['Hải Dương'], kind: 'province', province: null },
  { id: 'province:93', name: 'Hậu Giang', value: 'Hậu Giang', aliases: ['Hậu Giang', 'Vị Thanh'], kind: 'province', province: null },
  { id: 'province:17', name: 'Hòa Bình', value: 'Hòa Bình', aliases: ['Hòa Bình'], kind: 'province', province: null },
  { id: 'province:33', name: 'Hưng Yên', value: 'Hưng Yên', aliases: ['Hưng Yên'], kind: 'province', province: null },
  { id: 'province:56', name: 'Khánh Hòa', value: 'Khánh Hòa', aliases: ['Khánh Hòa', 'Nha Trang', 'Cam Ranh'], kind: 'province', province: null },
  { id: 'province:91', name: 'Kiên Giang', value: 'Kiên Giang', aliases: ['Kiên Giang', 'Rạch Giá', 'Phú Quốc', 'Hà Tiên'], kind: 'province', province: null },
  { id: 'province:62', name: 'Kon Tum', value: 'Kon Tum', aliases: ['Kon Tum'], kind: 'province', province: null },
  { id: 'province:12', name: 'Lai Châu', value: 'Lai Châu', aliases: ['Lai Châu'], kind: 'province', province: null },
  { id: 'province:68', name: 'Lâm Đồng', value: 'Lâm Đồng', aliases: ['Lâm Đồng', 'Đà Lạt', 'Bảo Lộc'], kind: 'province', province: null },
  { id: 'province:20', name: 'Lạng Sơn', value: 'Lạng Sơn', aliases: ['Lạng Sơn'], kind: 'province', province: null },
  { id: 'province:10', name: 'Lào Cai', value: 'Lào Cai', aliases: ['Lào Cai', 'Sa Pa', 'Sapa'], kind: 'province', province: null },
  { id: 'province:80', name: 'Long An', value: 'Long An', aliases: ['Long An', 'Tân An'], kind: 'province', province: null },
  { id: 'province:36', name: 'Nam Định', value: 'Nam Định', aliases: ['Nam Định'], kind: 'province', province: null },
  { id: 'province:40', name: 'Nghệ An', value: 'Nghệ An', aliases: ['Nghệ An', 'Vinh'], kind: 'province', province: null },
  { id: 'province:37', name: 'Ninh Bình', value: 'Ninh Bình', aliases: ['Ninh Bình'], kind: 'province', province: null },
  { id: 'province:58', name: 'Ninh Thuận', value: 'Ninh Thuận', aliases: ['Ninh Thuận', 'Phan Rang'], kind: 'province', province: null },
  { id: 'province:25', name: 'Phú Thọ', value: 'Phú Thọ', aliases: ['Phú Thọ', 'Việt Trì'], kind: 'province', province: null },
  { id: 'province:54', name: 'Phú Yên', value: 'Phú Yên', aliases: ['Phú Yên', 'Tuy Hòa'], kind: 'province', province: null },
  { id: 'province:44', name: 'Quảng Bình', value: 'Quảng Bình', aliases: ['Quảng Bình', 'Đồng Hới'], kind: 'province', province: null },
  { id: 'province:45', name: 'Quảng Trị', value: 'Quảng Trị', aliases: ['Quảng Trị', 'Đông Hà'], kind: 'province', province: null },
  { id: 'province:49', name: 'Quảng Nam', value: 'Quảng Nam', aliases: ['Quảng Nam', 'Tam Kỳ', 'Hội An'], kind: 'province', province: null },
  { id: 'province:51', name: 'Quảng Ngãi', value: 'Quảng Ngãi', aliases: ['Quảng Ngãi'], kind: 'province', province: null },
  { id: 'province:22', name: 'Quảng Ninh', value: 'Quảng Ninh', aliases: ['Quảng Ninh', 'Hạ Long', 'Cẩm Phả'], kind: 'province', province: null },
  { id: 'province:94', name: 'Sóc Trăng', value: 'Sóc Trăng', aliases: ['Sóc Trăng'], kind: 'province', province: null },
  { id: 'province:14', name: 'Sơn La', value: 'Sơn La', aliases: ['Sơn La'], kind: 'province', province: null },
  { id: 'province:72', name: 'Tây Ninh', value: 'Tây Ninh', aliases: ['Tây Ninh'], kind: 'province', province: null },
  { id: 'province:34', name: 'Thái Bình', value: 'Thái Bình', aliases: ['Thái Bình'], kind: 'province', province: null },
  { id: 'province:19', name: 'Thái Nguyên', value: 'Thái Nguyên', aliases: ['Thái Nguyên'], kind: 'province', province: null },
  { id: 'province:38', name: 'Thanh Hóa', value: 'Thanh Hóa', aliases: ['Thanh Hóa'], kind: 'province', province: null },
  { id: 'province:46', name: 'Thừa Thiên Huế', value: 'Thừa Thiên Huế', aliases: ['Thừa Thiên Huế', 'Huế', 'Hue'], kind: 'province', province: null },
  { id: 'province:82', name: 'Tiền Giang', value: 'Tiền Giang', aliases: ['Tiền Giang', 'Mỹ Tho'], kind: 'province', province: null },
  { id: 'province:84', name: 'Trà Vinh', value: 'Trà Vinh', aliases: ['Trà Vinh'], kind: 'province', province: null },
  { id: 'province:08', name: 'Tuyên Quang', value: 'Tuyên Quang', aliases: ['Tuyên Quang'], kind: 'province', province: null },
  { id: 'province:86', name: 'Vĩnh Long', value: 'Vĩnh Long', aliases: ['Vĩnh Long'], kind: 'province', province: null },
  { id: 'province:26', name: 'Vĩnh Phúc', value: 'Vĩnh Phúc', aliases: ['Vĩnh Phúc', 'Vĩnh Yên'], kind: 'province', province: null },
  { id: 'province:15', name: 'Yên Bái', value: 'Yên Bái', aliases: ['Yên Bái'], kind: 'province', province: null },
];

export const KEY_DISTRICTS: MasterLocation[] = [
  // TP. Hồ Chí Minh
  { id: 'district:769', name: 'TP. Thủ Đức', value: 'TP. Thủ Đức (TP.HCM)', aliases: ['TP. Thủ Đức', 'Thủ Đức', 'Thu Duc', 'Quận 2', 'Quận 9'], kind: 'district', province: 'TP. Hồ Chí Minh' },
  { id: 'district:760', name: 'Quận 1', value: 'Quận 1 (TP.HCM)', aliases: ['Quận 1', 'Q1', 'Quan 1'], kind: 'district', province: 'TP. Hồ Chí Minh' },
  { id: 'district:765', name: 'Quận Bình Thạnh', value: 'Quận Bình Thạnh (TP.HCM)', aliases: ['Bình Thạnh', 'Binh Thanh'], kind: 'district', province: 'TP. Hồ Chí Minh' },
  { id: 'district:764', name: 'Quận Gò Vấp', value: 'Quận Gò Vấp (TP.HCM)', aliases: ['Gò Vấp', 'Go Vap'], kind: 'district', province: 'TP. Hồ Chí Minh' },
  { id: 'district:783', name: 'Huyện Củ Chi', value: 'Huyện Củ Chi (TP.HCM)', aliases: ['Củ Chi', 'Cu Chi'], kind: 'district', province: 'TP. Hồ Chí Minh' },

  // Lâm Đồng
  { id: 'district:672', name: 'TP. Đà Lạt', value: 'Đà Lạt (Lâm Đồng)', aliases: ['Đà Lạt', 'Da Lat', 'Thành phố Đà Lạt', 'DL'], kind: 'district', province: 'Lâm Đồng' },
  { id: 'district:673', name: 'TP. Bảo Lộc', value: 'Bảo Lộc (Lâm Đồng)', aliases: ['Bảo Lộc', 'Bao Loc'], kind: 'district', province: 'Lâm Đồng' },
  { id: 'district:675', name: 'Huyện Đức Trọng', value: 'Đức Trọng (Lâm Đồng)', aliases: ['Đức Trọng', 'Duc Trong', 'Liên Nghĩa'], kind: 'district', province: 'Lâm Đồng' },

  // Khánh Hòa
  { id: 'district:568', name: 'TP. Nha Trang', value: 'Nha Trang (Khánh Hòa)', aliases: ['Nha Trang', 'NT'], kind: 'district', province: 'Khánh Hòa' },
  { id: 'district:569', name: 'TP. Cam Ranh', value: 'Cam Ranh (Khánh Hòa)', aliases: ['Cam Ranh'], kind: 'district', province: 'Khánh Hòa' },

  // Bà Rịa - Vũng Tàu
  { id: 'district:747', name: 'TP. Vũng Tàu', value: 'Vũng Tàu (Bà Rịa - Vũng Tàu)', aliases: ['Vũng Tàu', 'VT'], kind: 'district', province: 'Bà Rịa - Vũng Tàu' },
  { id: 'district:748', name: 'TP. Bà Rịa', value: 'Bà Rịa (Bà Rịa - Vũng Tàu)', aliases: ['Bà Rịa', 'Ba Ria'], kind: 'district', province: 'Bà Rịa - Vũng Tàu' },
  { id: 'district:754', name: 'Thị xã Phú Mỹ', value: 'Phú Mỹ (Bà Rịa - Vũng Tàu)', aliases: ['Phú Mỹ', 'Phu My'], kind: 'district', province: 'Bà Rịa - Vũng Tàu' },

  // Bình Thuận
  { id: 'district:593', name: 'TP. Phan Thiết', value: 'Phan Thiết (Bình Thuận)', aliases: ['Phan Thiết', 'Mũi Né'], kind: 'district', province: 'Bình Thuận' },
  { id: 'district:594', name: 'Thị xã La Gi', value: 'La Gi (Bình Thuận)', aliases: ['La Gi', 'Lagi'], kind: 'district', province: 'Bình Thuận' },

  // Bình Định
  { id: 'district:540', name: 'TP. Quy Nhơn', value: 'Quy Nhơn (Bình Định)', aliases: ['Quy Nhơn', 'Quy Nhon'], kind: 'district', province: 'Bình Định' },

  // Đắk Lắk
  { id: 'district:643', name: 'TP. Buôn Ma Thuột', value: 'Buôn Ma Thuột (Đắk Lắk)', aliases: ['Buôn Ma Thuột', 'BMT'], kind: 'district', province: 'Đắk Lắk' },

  // Kiên Giang
  { id: 'district:899', name: 'TP. Phú Quốc', value: 'Phú Quốc (Kiên Giang)', aliases: ['Phú Quốc', 'Phu Quoc', 'Đảo Ngọc'], kind: 'district', province: 'Kiên Giang' },
  { id: 'district:898', name: 'TP. Rạch Giá', value: 'Rạch Giá (Kiên Giang)', aliases: ['Rạch Giá', 'Rach Gia'], kind: 'district', province: 'Kiên Giang' },
  { id: 'district:900', name: 'TP. Hà Tiên', value: 'Hà Tiên (Kiên Giang)', aliases: ['Hà Tiên', 'Ha Tien'], kind: 'district', province: 'Kiên Giang' },

  // Lào Cai
  { id: 'district:088', name: 'Thị xã Sa Pa', value: 'Sa Pa (Lào Cai)', aliases: ['Sa Pa', 'Sapa'], kind: 'district', province: 'Lào Cai' },

  // Quảng Ninh
  { id: 'district:193', name: 'TP. Hạ Long', value: 'Hạ Long (Quảng Ninh)', aliases: ['Hạ Long', 'Ha Long', 'Bãi Cháy'], kind: 'district', province: 'Quảng Ninh' },
];

export const MAJOR_STATIONS: MasterLocation[] = [
  // TP.HCM
  {
    id: 'station:bx-mien-dong',
    name: 'Bến xe Miền Đông',
    value: 'Bến xe Miền Đông (TP.HCM)',
    aliases: ['Bến xe Miền Đông', 'Bx Miền Đông', 'BX Mien Dong', 'Bến xe Miền Đông Cũ', 'Miền Đông', 'TP.HCM'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    address: '292 Đinh Bộ Lĩnh, P. 26, Q. Bình Thạnh, TP.HCM',
  },
  {
    id: 'station:bx-mien-dong-moi',
    name: 'Bến xe Miền Đông Mới',
    value: 'Bến xe Miền Đông Mới (TP.HCM)',
    aliases: ['Bến xe Miền Đông Mới', 'Bx Miền Đông Mới', 'Miền Đông Mới', 'TP. Thủ Đức', 'TP.HCM'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    address: '501 Hoàng Hữu Nam, Long Bình, TP. Thủ Đức, TP.HCM',
  },
  {
    id: 'station:bx-mien-tay',
    name: 'Bến xe Miền Tây',
    value: 'Bến xe Miền Tây (TP.HCM)',
    aliases: ['Bến xe Miền Tây', 'Bx Miền Tây', 'BX Mien Tay', 'Miền Tây', 'TP.HCM'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM',
  },
  {
    id: 'station:bx-an-suong',
    name: 'Bến xe An Sương',
    value: 'Bến xe An Sương (TP.HCM)',
    aliases: ['Bến xe An Sương', 'Bx An Sương', 'An Sương', 'An Suong', 'TP.HCM'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    address: 'QL22, Bà Điểm, Hóc Môn, TP.HCM',
  },
  {
    id: 'station:bx-nga-tu-ga',
    name: 'Bến xe Ngã Tư Ga',
    value: 'Bến xe Ngã Tư Ga (TP.HCM)',
    aliases: ['Bến xe Ngã Tư Ga', 'Bx Ngã Tư Ga', 'Ngã Tư Ga', 'TP.HCM'],
    kind: 'station',
    province: 'TP. Hồ Chí Minh',
    address: '720 QL1A, Thạnh Lộc, Quận 12, TP.HCM',
  },

  // Hà Nội
  {
    id: 'station:bx-my-dinh',
    name: 'Bến xe Mỹ Đình',
    value: 'Bến xe Mỹ Đình (Hà Nội)',
    aliases: ['Bến xe Mỹ Đình', 'Bx Mỹ Đình', 'Mỹ Đình', 'My Dinh', 'Hà Nội'],
    kind: 'station',
    province: 'Hà Nội',
    address: '20 Phạm Hùng, Mỹ Đình, Nam Từ Liêm, Hà Nội',
  },
  {
    id: 'station:bx-giap-bat',
    name: 'Bến xe Giáp Bát',
    value: 'Bến xe Giáp Bát (Hà Nội)',
    aliases: ['Bến xe Giáp Bát', 'Bx Giáp Bát', 'Giáp Bát', 'Giap Bat', 'Hà Nội'],
    kind: 'station',
    province: 'Hà Nội',
    address: 'Km6 đường Giải Phóng, Hoàng Mai, Hà Nội',
  },
  {
    id: 'station:bx-nuoc-ngam',
    name: 'Bến xe Nước Ngầm',
    value: 'Bến xe Nước Ngầm (Hà Nội)',
    aliases: ['Bến xe Nước Ngầm', 'Bx Nước Ngầm', 'Nước Ngầm', 'Nuoc Ngam', 'Hà Nội'],
    kind: 'station',
    province: 'Hà Nội',
    address: 'Số 1 Ngọc Hồi, Hoàng Liệt, Hoàng Mai, Hà Nội',
  },
  {
    id: 'station:bx-gia-lam',
    name: 'Bến xe Gia Lâm',
    value: 'Bến xe Gia Lâm (Hà Nội)',
    aliases: ['Bến xe Gia Lâm', 'Bx Gia Lâm', 'Gia Lâm', 'Gia Lam', 'Hà Nội'],
    kind: 'station',
    province: 'Hà Nội',
    address: 'Số 9 Ngô Gia Khảm, Long Biên, Hà Nội',
  },

  // Lâm Đồng
  {
    id: 'station:bx-da-lat',
    name: 'Bến xe Đà Lạt',
    value: 'Bến xe Đà Lạt (Lâm Đồng)',
    aliases: ['Bến xe Đà Lạt', 'Bx Đà Lạt', 'BX Da Lat', 'Bến xe Liên tỉnh Đà Lạt', 'Đà Lạt', 'Lâm Đồng'],
    kind: 'station',
    province: 'Lâm Đồng',
    address: '01 Tô Hiến Thành, Phường 3, TP. Đà Lạt, Lâm Đồng',
  },
  {
    id: 'station:bx-duc-trong',
    name: 'Bến xe Đức Trọng',
    value: 'Bến xe Đức Trọng (Lâm Đồng)',
    aliases: ['Bến xe Đức Trọng', 'Bx Đức Trọng', 'Đức Trọng', 'Lâm Đồng'],
    kind: 'station',
    province: 'Lâm Đồng',
    address: '735 QL20, TT. Liên Nghĩa, Đức Trọng, Lâm Đồng',
  },

  // Đà Nẵng
  {
    id: 'station:bx-da-nang',
    name: 'Bến xe Trung tâm Đà Nẵng',
    value: 'Bến xe Đà Nẵng (Đà Nẵng)',
    aliases: ['Bến xe Trung tâm Đà Nẵng', 'Bến xe Đà Nẵng', 'Bx Đà Nẵng', 'Đà Nẵng'],
    kind: 'station',
    province: 'Đà Nẵng',
    address: '185 Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng',
  },

  // Khánh Hòa
  {
    id: 'station:bx-phia-nam-nha-trang',
    name: 'Bến xe Phía Nam Nha Trang',
    value: 'Bến xe Nha Trang (Khánh Hòa)',
    aliases: ['Bến xe Phía Nam Nha Trang', 'Bến xe Nha Trang', 'Bx Nha Trang', 'Nha Trang'],
    kind: 'station',
    province: 'Khánh Hòa',
    address: 'Km 6 đường 23/10, Vĩnh Trung, TP. Nha Trang, Khánh Hòa',
  },

  // Bà Rịa - Vũng Tàu
  {
    id: 'station:bx-vung-tau',
    name: 'Bến xe Vũng Tàu',
    value: 'Bến xe Vũng Tàu (Bà Rịa - Vũng Tàu)',
    aliases: ['Bến xe Vũng Tàu', 'Bx Vũng Tàu', 'Vũng Tàu', 'Bà Rịa - Vũng Tàu'],
    kind: 'station',
    province: 'Bà Rịa - Vũng Tàu',
    address: '192 Nam Kỳ Khởi Nghĩa, Phường 3, TP. Vũng Tàu',
  },

  // Cần Thơ
  {
    id: 'station:bx-can-tho',
    name: 'Bến xe Trung tâm Cần Thơ',
    value: 'Bến xe Cần Thơ (Cần Thơ)',
    aliases: ['Bến xe Trung tâm Cần Thơ', 'Bến xe Cần Thơ', 'Bx Cần Thơ', 'Cần Thơ'],
    kind: 'station',
    province: 'Cần Thơ',
    address: 'Khu Đô Thị Nam Cần Thơ, QL1A, Hưng Thạnh, Cái Răng, Cần Thơ',
  },
];
