export interface SeedKnowledgeDocument {
  documentCode: string;
  title: string;
  category:
    | 'CHINH_SACH_HOAN_HUY'
    | 'QUY_DINH_HANH_LY'
    | 'THANH_TOAN_GIU_CHO'
    | 'VAN_CHUYEN_HANG_HOA'
    | 'KHUYEN_MAI_LOYALTY'
    | 'FAQ_CHUNG';
  scope: 'GLOBAL' | 'TENANT';
  hierarchyPath: string;
  rawContent: string;
}

export const DEFAULT_KNOWLEDGE_DOCUMENTS: SeedKnowledgeDocument[] = [
  {
    documentCode: 'DOC-CANCEL-POLICY',
    title: 'Chính sách Hủy vé và Hoàn tiền VexGo',
    category: 'CHINH_SACH_HOAN_HUY',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương II: Đổi trả và Hủy vé] > [Điều 1: Biểu phí & Điều kiện]',
    rawContent: `1. Thời gian và mức phí hủy vé xe trực tuyến:
- Hủy vé trước giờ khởi hành trên 24 tiếng: Mức phí hủy vé là 10% giá vé thực tế. Hành khách được hoàn lại 90% số tiền đã thanh toán.
- Hủy vé trong khoảng từ 2.5 tiếng (2 giờ 30 phút) đến 24 tiếng trước giờ khởi hành: Mức phí hủy vé áp dụng là 20% giá vé. Hành khách được hoàn lại 80% số tiền.
- Thời gian dưới 2.5 tiếng trước giờ khởi hành hoặc khi chuyến xe đã xuất bến: Hệ thống trực tuyến không hỗ trợ hủy vé tự động. Hành khách cần liên hệ trực tiếp với tổng đài nhà xe hoặc quầy vé tại bến xe để được xem xét theo quy chế đặc thù.

2. Điều kiện ràng buộc khi hủy vé:
- Đối với đơn đặt vé combo có kèm dịch vụ ký gửi hàng hóa hoặc bưu kiện: Hành khách không thể hủy vé trực tuyến nếu bưu kiện đang trong trạng thái xử lý hoặc chưa được hủy. Vui lòng hủy bưu kiện trước hoặc liên hệ bộ phận hỗ trợ.
- VexGo không hoàn tiền trực tuyến. Sau khi hủy vé, khách hàng cần liên hệ hỗ trợ hoặc nhà xe để được xác minh và hướng dẫn hoàn tiền. Điều kiện, phí hủy và số tiền dự kiến phải xem tại báo giá hủy của vé cụ thể; AI không tự xác nhận việc hoàn tiền.

3. Hướng dẫn thao tác hủy vé trên website:
- Hành khách truy cập mục "Hủy vé" trên thanh điều hướng đầu trang (hoặc từ trang "Tra cứu vé xe" / "Vé của tôi", chọn vé cần hủy và bấm "Yêu cầu hủy vé").
- Bước 1: Điền Mã vé và Số điện thoại đặt vé rồi bấm nút "Tra cứu vé".
- Bước 2: Xem mức phí hủy và số tiền hoàn dự kiến, tích chọn ghế cần hủy và tick đồng ý điều khoản chính sách.
- Bước 3: Bấm nút "Xác nhận hủy vé" để hoàn tất yêu cầu và nhận mã giao dịch hủy vé. Hành khách không cần gửi mã vé hoặc số điện thoại vào khung chat này.`,
  },
  {
    documentCode: 'DOC-BAGGAGE-POLICY',
    title: 'Quy định Hành lý Xách tay và Ký gửi',
    category: 'QUY_DINH_HANH_LY',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương III: Hành lý và Hàng gửi kèm] > [Điều 2: Tiêu chuẩn miễn cước]',
    rawContent: `1. Tiêu chuẩn hành lý xách tay và ký gửi miễn cước:
- Mỗi hành khách có vé hợp lệ được mang theo tối đa 20kg hành lý ký gửi (được cất giữ tại hầm xe) và 01 kiện hành lý xách tay nhỏ gọn (đặt tại vị trí ghế ngồi không làm ảnh hưởng đến hành khách khác).
- Kích thước tối đa của kiện hành lý ký gửi tiêu chuẩn không vượt quá kích thước vali size 28 (dài x rộng x cao không quá 158cm tổng ba chiều).

2. Phụ phí hành lý quá tải và hàng hóa cấm vận chuyển:
- Hành lý vượt quá trọng lượng 20kg sẽ bị tính phụ phí theo bảng giá cước hàng hóa quá khổ của nhà xe tại thời điểm xuất bến (thông thường từ 10.000 VNĐ - 25.000 VNĐ/kg vượt mức).
- Tuyệt đối nghiêm cấm mang lên xe các chất dễ cháy nổ (xăng dầu, pháo hoa, bình gas mini), hóa chất độc hại, vũ khí thô sơ, gia súc gia cầm chưa qua kiểm dịch hoặc các mặt hàng thuộc danh mục hàng cấm theo quy định của pháp luật Việt Nam.`,
  },
  {
    documentCode: 'DOC-PAYMENT-HOLD',
    title: 'Quy định Đặt chỗ, Giữ vé và Thanh toán',
    category: 'THANH_TOAN_GIU_CHO',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương I: Đặt chỗ và Thanh toán] > [Điều 3: Thời hạn giữ chỗ]',
    rawContent: `1. Thời gian giữ chỗ thanh toán (Payment Deadline):
- Sau khi hành khách chọn chuyến, chọn ghế và hoàn tất bước xác nhận thông tin đặt vé, hệ thống VexGo sẽ tự động khóa và giữ ghế trong thời gian tối đa 10 phút (600 giây).
- Trong thời gian 10 phút này, ghế được đảm bảo độc quyền cho quý khách và không thể bị người khác đặt trùng.
- Sau 10 phút, nếu giao dịch thanh toán chưa được hệ thống ghi nhận thành công, mã giữ chỗ sẽ tự động hết hạn, ghế sẽ được giải phóng về trạng thái ghế trống (TRONG) cho hành khách khác đặt vé.

2. Phương thức thanh toán được hỗ trợ:
- Chuyển khoản ngân hàng tức thời qua VietQR (tự động khớp giao dịch qua cổng SePay trong vòng 3-10 giây).
- Cổng thanh toán trực tuyến hỗ trợ thẻ ATM nội địa, Internet Banking và ví điện tử.
- Lưu ý: Quý khách cần chuyển đúng chính xác nội dung chuyển khoản (mã đơn hàng / mã thanh toán) hiển thị trên màn hình để hệ thống tự động xác nhận vé ngay lập tức.`,
  },
  {
    documentCode: 'DOC-CARGO-SHIPPING',
    title: 'Quy định Vận chuyển Hàng hóa và Bưu kiện',
    category: 'VAN_CHUYEN_HANG_HOA',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương IV: Dịch vụ Vận chuyển Hàng hóa] > [Điều 4: Phân loại & Tiếp nhận]',
    rawContent: `1. Phân loại hàng hóa gửi theo xe khách:
- Hàng nhẹ (Bưu phẩm, giấy tờ, bưu kiện dưới 5kg): Được bảo quản trong ngăn riêng chống ẩm và va đập.
- Hàng tiêu chuẩn & cồng kềnh: Thùng carton, bao tải hàng gia dụng, thiết bị máy móc đóng thùng gỗ.
- Xe máy & phương tiện cá nhân: Xe số, xe tay ga, xe điện (yêu cầu rút cạn xăng trước khi đưa lên xe và bọc chống trầy xước khung vỏ).

2. Quy trình giao nhận và theo dõi vận đơn:
- Người gửi mang hàng đến điểm giao dịch/văn phòng nhà xe trước giờ xe chạy ít nhất 30 phút để nhân viên kiểm tra, cân đo thực tế và in phiếu gửi hàng (mã vận đơn WB...).
- Người gửi hoặc người nhận có thể tra cứu hành trình bưu kiện theo thời gian thực trên trang web VexGo bằng mã vận đơn và số điện thoại người nhận/người gửi.
- Người nhận khi đến bến xe/điểm nhận hàng xuất trình tin nhắn xác nhận hoặc CCCD/CMND khớp với thông tin trên phiếu gửi hàng.`,
  },
  {
    documentCode: 'DOC-PROMOTIONS-LOYALTY',
    title: 'Chương trình Khuyến mãi và Điểm Tích lũy VexGo',
    category: 'KHUYEN_MAI_LOYALTY',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương V: Ưu đãi & Khách hàng thân thiết] > [Điều 5: Mã giảm giá]',
    rawContent: `1. Áp dụng mã khuyến mãi khi đặt vé:
- Khách hàng có thể nhập mã giảm giá tại bước thanh toán đặt vé để được khấu trừ trực tiếp vào giá vé (giảm theo % hoặc giảm số tiền cố định theo điều kiện từng chương trình).
- Mỗi mã khuyến mãi có điều kiện riêng về giá trị đơn hàng tối thiểu, mức giảm tối đa, thời hạn hiệu lực và số lượt áp dụng còn lại trong hạn mức ngân sách của nhà xe.
- Mã khuyến mãi chỉ có hiệu lực khi đơn hàng đáp ứng đủ các điều kiện và chương trình còn lượt sử dụng.

2. Tích lũy điểm thưởng thành viên:
- Khách hàng đăng ký tài khoản VexGo sẽ được tự động tích lũy điểm thưởng sau khi mỗi chuyến đi kết thúc thành công.
- Điểm tích lũy có thể quy đổi thành mã ưu đãi giảm giá hoặc chiết khấu cho các lượt đặt vé và dịch vụ gửi hàng tiếp theo trên nền tảng.`,
  },
  {
    documentCode: 'DOC-PICKUP-DROPOFF',
    title: 'Quy định Điểm Đón Trả Khách và Xe Trung Chuyển',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương I: Đặt chỗ và Hành trình] > [Điều 6: Đón trả & Trung chuyển]',
    rawContent: `1. Thời gian có mặt tại điểm đón:
- Hành khách cần có mặt tại bến xe, trạm dừng hoặc văn phòng đón khách trước giờ khởi hành dự kiến ít nhất 15 phút để nhân viên nhà xe sắp xếp hành lý và soát vé lên xe.
- Đối với trường hợp đón dọc đường trên lộ trình được cấp phép, tài xế hoặc phụ xe sẽ chủ động liên hệ trước 15-30 phút qua số điện thoại đặt vé. Hành khách vui lòng giữ máy liên lạc thông suốt.

2. Dịch vụ xe trung chuyển:
- Một số nhà xe hỗ trợ xe trung chuyển đón trả tận nơi trong nội thành (ví dụ nội ô TP. Đà Lạt, TP. Nha Trang, TP. Cần Thơ).
- Khi đặt vé, hành khách cần chọn đúng điểm đón/trả trung chuyển hoặc điền rõ địa chỉ để nhà xe bố trí phương tiện trung chuyển kịp thời.`,
  },
  {
    documentCode: 'DOC-CHILDREN-TICKETS',
    title: 'Quy định Vé Trẻ em và Đối tượng Ưu tiên',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương I: Đặt chỗ và Hành trình] > [Điều 7: Trẻ em & Đối tượng chính sách]',
    rawContent: `1. Quy định vé dành cho trẻ em:
- Trẻ em dưới 6 tuổi hoặc chiều cao dưới 100cm đi cùng người lớn được miễn phí vé nếu ngồi chung ghế/giường với người lớn đi kèm (mỗi người lớn được kèm tối đa 01 trẻ em).
- Trẻ em từ 6 tuổi trở lên hoặc chiều cao từ 100cm trở lên bắt buộc phải mua vé riêng để đảm bảo an toàn và tiêu chuẩn chỗ ngồi suốt hành trình.

2. Chính sách hỗ trợ đối tượng đặc biệt:
- Người cao tuổi (từ 65 tuổi trở lên), phụ nữ mang thai và người khuyết tật được ưu tiên xếp các vị trí ghế/giường ở tầng dưới (tầng 1) gần cửa xe để thuận tiện di chuyển. Quý khách vui lòng ghi chú khi đặt vé hoặc nhờ tổng đài hỗ trợ.`,
  },
  {
    documentCode: 'DOC-PET-POLICY',
    title: 'Quy định Vận chuyển Thú cưng và Vật nuôi',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương III: Hành lý và Hàng gửi kèm] > [Điều 8: Thú cưng & Động vật sống]',
    rawContent: `1. Điều kiện tiếp nhận vận chuyển thú cưng (chó, mèo cảnh):
- Vì lý do vệ sinh chung và tránh gây dị ứng hoặc ảnh hưởng đến các hành khách khác, thú cưng tuyệt đối KHÔNG được mang lên khoang hành khách ngồi chung.
- Thú cưng bắt buộc phải được nhốt trong lồng/chuồng chuyên dụng có khóa chắc chắn, có khay hứng chất thải và có giấy chứng nhận tiêm phòng dại hợp lệ.

2. Vận chuyển dưới khoang hầm xe:
- Thú cưng sẽ được vận chuyển dưới khoang hầm hàng hóa có khe thông gió thoáng mát theo sự đồng ý của lái xe và chính sách riêng của từng nhà xe.
- Chủ thú cưng cần chịu trách nhiệm chuẩn bị thức ăn, nước uống và ký cam kết miễn trừ trách nhiệm về sức khỏe của vật nuôi trong suốt hành trình di chuyển đường dài.`,
  },
  {
    documentCode: 'DOC-INVOICE-VAT',
    title: 'Quy định Xuất Hóa đơn Điện tử VAT',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương VI: Hóa đơn & Chứng từ] > [Điều 9: Hóa đơn GTGT]',
    rawContent: `1. Thời hạn và quy trình yêu cầu xuất hóa đơn VAT:
- Giá vé xe và cước vận chuyển niêm yết trên VexGo đã bao gồm thuế giá trị gia tăng (VAT) theo quy định hiện hành.
- Khách hàng có nhu cầu xuất hóa đơn điện tử cho cơ quan, doanh nghiệp cần cung cấp thông tin xuất hóa đơn (Tên công ty, Mã số thuế, Địa chỉ, Email nhận hóa đơn) trong quá trình đặt vé hoặc trong vòng 24 giờ sau khi chuyến xe khởi hành.

2. Phương thức nhận hóa đơn:
- Hóa đơn điện tử hợp lệ (có mã của cơ quan thuế) sẽ được gửi tự động về địa chỉ email của khách hàng trong vòng 3-5 ngày làm việc sau khi chuyến đi hoàn tất.`,
  },
  {
    documentCode: 'DOC-LOST-AND-FOUND',
    title: 'Quy trình Xử lý Hành lý Thất lạc và Bỏ quên',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương VII: Hỗ trợ Khách hàng] > [Điều 10: Thất lạc hành lý]',
    rawContent: `1. Xử lý khi hành khách để quên đồ đạc trên xe:
- Ngay khi phát hiện để quên tài sản trên xe sau khi xuống xe, hành khách vui lòng liên hệ ngay với tổng đài CSKH của VexGo hoặc hotline nhà xe, cung cấp mã vé, số ghế, biển số xe và mô tả chi tiết tài sản.
- Đội ngũ điều hành sẽ lập tức liên lạc với tài xế và phụ xe để kiểm tra thực tế trên xe.

2. Quy trình nhận lại tài sản:
- Tài sản tìm thấy sẽ được bàn giao về văn phòng bến xe đại diện của nhà xe. Hành khách xuất trình giấy tờ tùy thân và mã vé để làm thủ tục nhận lại đồ.
- Nhà xe có trách nhiệm lưu trữ và bảo quản hành lý thất lạc trong thời gian tối đa 30 ngày kể từ ngày tiếp nhận.`,
  },
  {
    documentCode: 'DOC-ACCOUNT-SECURITY',
    title: 'Bảo mật Tài khoản và Xác thực Mã OTP',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương VIII: An toàn Thông tin] > [Điều 11: Tài khoản & OTP]',
    rawContent: `1. Đăng ký và bảo vệ tài khoản:
- Tài khoản khách hàng trên VexGo được định danh chính xác bằng số điện thoại di động chính chủ.
- Mọi yêu cầu đăng ký mới, đăng nhập lần đầu trên thiết bị lạ hoặc đổi mật khẩu đều bắt buộc phải vượt qua bước xác thực mã OTP gửi về số điện thoại.

2. Khuyến cáo an toàn:
- Quý khách tuyệt đối không chia sẻ mã xác thực OTP cho bất kỳ ai, kể cả nhân viên tự xưng là tổng đài viên VexGo. Nhân viên VexGo không bao giờ yêu cầu khách hàng cung cấp mã OTP hoặc mật khẩu đăng nhập.`,
  },
  {
    documentCode: 'DOC-GENERAL-FAQ',
    title: 'Các Câu hỏi Thường gặp khi Đặt vé tại VexGo',
    category: 'FAQ_CHUNG',
    scope: 'GLOBAL',
    hierarchyPath:
      '[Quy chế VexGo] > [Chương IX: Hướng dẫn Sử dụng] > [Điều 12: Câu hỏi thường gặp]',
    rawContent: `1. Tôi có cần in vé giấy ra không?
- Không cần. Sau khi thanh toán thành công, bạn sẽ nhận được tin nhắn SMS và email chứa mã vé và mã QR soát vé. Khi lên xe, bạn chỉ cần xuất trình mã QR trên màn hình điện thoại cho tài xế hoặc nhân viên soát vé.

2. Làm thế nào để kiểm tra vé đã đặt thành công chưa?
- Bạn vào mục "Tra cứu" trên thanh điều hướng đầu trang website VexGo, chọn "Tra cứu vé xe" (hoặc mục "Vé của tôi" nếu đã đăng nhập), điền Mã vé và Số điện thoại đặt vé rồi bấm nút "Tra cứu vé" để xem chi tiết vé, vị trí ghế và mã QR lên xe. Khách hàng không cần gửi mã vé hoặc số điện thoại vào khung chat này.

3. Tôi có thể đổi giờ đi sang chuyến khác được không?
- Bạn có thể liên hệ tổng đài nhà xe hoặc yêu cầu hủy vé cũ theo chính sách hoàn hủy của hệ thống rồi tiến hành đặt vé mới cho khung giờ phù hợp.`,
  },
];
