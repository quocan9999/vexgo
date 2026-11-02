export interface NewsArticle {
  id: string;
  slug?: string;
  title: string;
  date: string;
  author: string;
  readTime: string;
  category: 'TIN_TUC' | 'HUONG_DAN' | 'DU_LICH';
  categoryLabel: string;
  img: string;
  summary: string;
  content: {
    heading?: string;
    text: string[];
  }[];
  tags: string[];
  relatedRoute?: {
    origin: string;
    destination: string;
    label: string;
  };
}

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: '1',
    slug: 'limousine-vip-sai-gon-da-lat',
    title: 'Khai trương tuyến xe Limousine VIP TP.HCM - Đà Lạt phòng nằm đôi',
    date: '28/10/2026',
    author: 'Ban biên tập VexGo',
    readTime: '4 phút đọc',
    category: 'TIN_TUC',
    categoryLabel: 'Tin tức vận tải',
    img: '/images/promo2.jpg',
    summary:
      'VexGo cùng các đối tác nhà xe chính thức đưa vào khai thác dòng xe Limousine giường phòng cao cấp tuyến Sài Gòn - Đà Lạt với nhiều tiện ích vượt trội, nâng tầm trải nghiệm du lịch.',
    content: [
      {
        heading: 'Nâng cấp tiêu chuẩn chuyến đi Sài Gòn – Đà Lạt',
        text: [
          'Đà Lạt luôn là một trong những điểm đến du lịch được yêu thích hàng đầu của hành khách khởi hành từ TP. Hồ Chí Minh. Để đáp ứng nhu cầu ngày càng cao về sự riêng tư, tiện nghi và êm ái, VexGo hợp tác cùng các nhà xe uy tín chính thức ra mắt dàn xe Limousine phòng nằm đôi thế hệ mới.',
          'Dòng xe mới được thiết kế đặc thù cho cung đường đèo dốc với hệ thống giảm xóc khí nén hiện đại, giúp hạn chế rung lắc và mang đến giấc ngủ êm ái cho hành khách suốt hành trình đêm.',
        ],
      },
      {
        heading: 'Tiện nghi đẳng cấp chuẩn "khách sạn di động"',
        text: [
          'Mỗi phòng nằm trên xe đều được trang bị rèm che cách âm và cản sáng độc lập, tạo không gian hoàn toàn riêng tư cho cặp đôi hoặc gia đình nhỏ.',
          'Bên trong phòng tích hợp nệm bọc da cao cấp với cơ chế massage thư giãn đa vùng, màn hình LCD giải trí cảm ứng, cổng sạc nhanh USB/Type-C, đèn đọc sách và kết nối Wifi tốc độ cao xuyên suốt chuyến đi.',
          'Đội ngũ phục vụ chuyên nghiệp luôn sẵn sàng hỗ trợ nước uống, khăn lạnh và bánh ngọt miễn phí cho tất cả hành khách khi lên xe.',
        ],
      },
      {
        heading: 'Lịch trình linh hoạt và cách đặt vé',
        text: [
          'Tuyến xe Limousine TP.HCM – Đà Lạt được bố trí nhiều khung giờ xuất bến từ 06:00 sáng đến 23:30 đêm hàng ngày. Điểm đón trả đa dạng tại các bến xe trung tâm và văn phòng nhà xe tại Quận 1, Bình Thạnh, Thủ Đức cũng như trung tâm thành phố Đà Lạt.',
          'Hành khách có thể dễ dàng tra cứu giờ chạy chính xác, chọn đúng số phòng và đặt vé trực tuyến an toàn ngay trên nền tảng VexGo.',
        ],
      },
    ],
    tags: ['Limousine', 'Đà Lạt', 'Vé xe khách', 'VexGo', 'Du lịch'],
    relatedRoute: {
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      label: 'Tìm vé TP.HCM đi Đà Lạt',
    },
  },
  {
    id: '2',
    slug: 'dat-ve-xe-khach-truc-tuyen',
    title: 'Đặt vé xe khách trực tuyến dễ dàng & an toàn trên nền tảng VexGo',
    date: '18/10/2026',
    author: 'Bộ phận Hỗ trợ khách hàng',
    readTime: '3 phút đọc',
    category: 'HUONG_DAN',
    categoryLabel: 'Hướng dẫn đặt vé',
    img: '/images/promo1.jpg',
    summary:
      'Trải nghiệm quy trình đặt vé xe khách số hóa toàn diện: tra cứu lịch trình minh bạch, chọn vị trí ngồi thực tế trên xe, thanh toán bảo mật và nhận vé điện tử tức thì.',
    content: [
      {
        heading: 'Chuyển đổi số trong trải nghiệm di chuyển liên tỉnh',
        text: [
          'Thời điểm trước đây, hành khách thường phải mất nhiều thời gian đến tận bến xe để xếp hàng mua vé, đặc biệt vào các dịp lễ tết hay cuối tuần. Với nền tảng VexGo, toàn bộ quá trình tìm kiếm, đặt chỗ và xuất vé được rút ngắn chỉ trong chưa đầy 2 phút.',
          'Hệ thống kết nối trực tiếp với cơ sở dữ liệu của các hãng xe khách lớn, cung cấp thông tin cập nhật từng giây về số ghế trống, giá vé niêm yết minh bạch và điểm đón/trả chi tiết.',
        ],
      },
      {
        heading: 'Quy trình 3 bước đặt vé tiện lợi',
        text: [
          'Bước 1: Nhập điểm khởi hành, điểm đến và ngày đi mong muốn trên thanh tìm kiếm. Hệ thống sẽ liệt kê danh sách toàn bộ chuyến xe kèm đánh giá chất lượng từ các hành khách đi trước.',
          'Bước 2: Xem sơ đồ bố trí ghế thực tế của xe (tầng trên, tầng dưới, vị trí cửa sổ hoặc lối đi) và tự do chọn vị trí ưng ý nhất cho mình.',
          'Bước 3: Lựa chọn cổng thanh toán phù hợp qua VNPAY, MoMo, ZaloPay hoặc quét mã QR ngân hàng tự động.',
        ],
      },
      {
        heading: 'Vé điện tử thông minh và chính sách hủy vé',
        text: [
          'Sau khi thanh toán thành công, vé điện tử kèm mã QR sẽ được gửi về SMS và email đã đăng ký. Khi lên xe, hành khách chỉ cần mở điện thoại để nhân viên quét mã nhanh chóng.',
          'Đặc biệt, VexGo công khai chính sách hủy vé hoàn tiền rõ ràng: hành khách có thể thao tác hủy vé trực tuyến trước giờ khởi hành tối thiểu 2 giờ 30 phút mà không cần liên hệ tổng đài.',
        ],
      },
    ],
    tags: ['Hướng dẫn', 'Vé điện tử', 'Thanh toán online', 'VNPAY', 'MoMo'],
    relatedRoute: {
      origin: 'TP.HCM',
      destination: 'Nha Trang',
      label: 'Tìm vé TP.HCM đi Nha Trang',
    },
  },
  {
    id: '3',
    slug: 'gui-hang-lien-tinh-sieu-toc',
    title: 'Mở rộng mạng lưới gửi hàng liên tỉnh theo xe khách siêu tốc',
    date: '05/10/2026',
    author: 'Khối Dịch vụ Vận chuyển VexGo',
    readTime: '3 phút đọc',
    category: 'TIN_TUC',
    categoryLabel: 'Dịch vụ giao nhận',
    img: '/images/promo3.jpg',
    summary:
      'VexGo triển khai tính năng gửi hàng hóa liên tỉnh theo các tuyến xe khách chạy liên tục mỗi ngày, hỗ trợ tính cước tự động và giao nhận ngay trong ngày.',
    content: [
      {
        heading: 'Giải pháp gửi hàng hóa liên tỉnh tiện lợi trong ngày',
        text: [
          'Nhu cầu gửi tài liệu khẩn, bưu phẩm, đồ gia dụng, nông sản tươi sống hay xe máy giữa các tỉnh thành ngày càng tăng cao. Dịch vụ gửi hàng bưu chính truyền thống thường mất từ 2 đến 3 ngày.',
          'Tận dụng mạng lưới xe khách chạy liên tục với tần suất dày đặc mỗi ngày, VexGo mang tới giải pháp gửi hàng hóa siêu tốc: gửi buổi sáng là buổi chiều hoặc tối người nhận đã có thể nhận hàng tại văn phòng bến xe.',
        ],
      },
      {
        heading: 'Tính cước tự động & Theo dõi mã vận đơn',
        text: [
          'Khách hàng chỉ cần nhập loại hàng, kích thước/trọng lượng ước tính và tuyến xe cần gửi. Hệ thống sẽ tự động tính toán mức cước phí niêm yết rõ ràng, không phát sinh chi phí phụ.',
          'Mỗi kiện hàng được gán một mã vận đơn duy nhất (Tracking Code). Người gửi và người nhận có thể tra cứu trực tiếp tình trạng hàng đã xuất bến hay đã đến bến nhận qua tính năng Tra cứu trực tuyến.',
        ],
      },
      {
        heading: 'Quy trình gửi hàng an toàn',
        text: [
          'Hàng hóa được sắp xếp cẩn thận trong khoang chứa rộng rãi của xe khách, tránh va đập và hư hỏng trong suốt hành trình.',
          'Khi hàng đến nơi, hệ thống tự động gửi thông báo tin nhắn để người nhận đến văn phòng nhà xe nhận hàng thuận tiện.',
        ],
      },
    ],
    tags: ['Gửi hàng', 'Vận chuyển', 'Giao hàng trong ngày', 'Xe khách'],
  },
];

export function getNewsById(idOrSlug: string): NewsArticle | undefined {
  const query = idOrSlug.toLowerCase();
  return NEWS_ARTICLES.find(
    (n) => n.id === idOrSlug || (n.slug && n.slug.toLowerCase() === query)
  );
}
