# Danh mục điểm đi / điểm đến

## Nguồn và API

`GET /api/v1/locations` là endpoint public dùng chung cho Admin/Customer, không truy vấn dữ liệu nhà xe.
Nguồn: https://provinces.open-api.vn/ — v2 `?depth=1` cho tỉnh/thành hiện hành, v1 `?depth=2` cho tỉnh/thành trước 07/2025 và thành phố/thị xã cũ (Đà Lạt, Nha Trang, Vũng Tàu…). Không gọi depth=3. Quan hệ tỉnh cũ → mới lấy từ `https://www.tinhthanhpho.com/api/v1/new-provinces?limit=100`, trường `merged_from`. Attribution: tinhthanhpho.com, dữ liệu mở CC BY 4.0; tài liệu: https://www.tinhthanhpho.com/api-docs.

Response: `{ data: LocationOption[], meta: { updatedAt: ISO8601, stale: boolean } }`.
Mỗi option có `id`, `name`, `value`, `aliases`, `versions: ['current' | 'legacy']`, `kind: 'province' | 'city'`, `province`, `legacyNames`.
`id` phân biệt đơn vị trong danh mục. UI chỉ hiển thị tỉnh hiện hành làm dòng chính, các tỉnh tiền thân khác tên ở dòng phụ nhỏ/màu nhạt, ví dụ **Tây Ninh** / **Long An - cũ**. Không tạo lựa chọn tỉnh cũ độc lập, không lặp Tây Ninh - cũ dưới chính Tây Ninh. Tên cũ nằm trong `aliases` để tìm không dấu. Thành phố/điểm vận tải vẫn có mục riêng. Suffix không gửi làm tên điểm đi/đến.

Danh mục được cache trong bộ nhớ API 24 giờ, gộp các request đồng thời và timeout upstream 8 giây. Refresh lỗi giữ bản hợp lệ cuối cùng với `stale: true`, backoff 30 giây. Chưa có cache thì trả 503 `LOCATION_CATALOG_UNAVAILABLE`; không dùng danh sách mock hoặc một nửa danh mục thay cho kết quả hợp lệ. Cache không bền qua restart.

## Ngữ nghĩa dữ liệu tuyến

Tuyến hiện lưu điểm đi/đến dưới dạng chuỗi. Tích hợp này giữ contract đó, không migration/ghi lại dữ liệu cũ. ID và phiên bản của danh mục chưa được lưu trên tuyến; UI dùng tên tỉnh hiện hành và tên tiền thân theo mapping. Dòng phụ ` - cũ` là thông tin tra cứu, không phải phiên bản địa giới được lưu trên tuyến.

Khi chọn tên tỉnh hiện hành, tìm chuyến bao gồm các tên tỉnh tiền thân được API mapping xác nhận, ví dụ Tây Ninh tìm cả tuyến còn lưu Long An. Query cũ chỉ gửi Long An vẫn giữ phạm vi tên đó; không suy ngược thành toàn tỉnh mới. Không tự gộp thành phố/điểm vận tải như Đà Lạt thành Lâm Đồng. Đây là tìm theo các tên tỉnh trong dữ liệu tuyến, chưa phải truy vấn không gian theo ranh giới/điểm đón địa lý.

## Kiểm kê consumer

| Vị trí | Áp dụng |
| --- | --- |
| Admin `/routes`: tạo và sửa tuyến | LocationPicker, primitive SearchableCombobox theo Base UI và token shadcn hiện có |
| Web `/`: Đặt vé và Gửi hàng | LocationPicker dùng chung |
| Web `/trips`: banner tìm chuyến | Dùng HeroSection nên nhận thay đổi cùng trang chủ |
| Web `/posts`: tìm vé và tìm nhà xe gửi hàng | LocationPicker dùng chung, bỏ datalist cố định |
| Web `/send-freight`, `/shipments/new` | LocationPicker dùng chung; giữ địa điểm từ URL, mặc định ngày hiện tại, không tự chọn tuyến mẫu |
| TripSearchForm (component chưa có consumer hiện tại) | Dùng LocationPicker, chuyển địa điểm/ngày sang form gửi hàng |
| Bộ lọc từ khóa tuyến/chuyến | Giữ tìm kiếm văn bản nhiều tiêu chí, không thay bằng danh mục tỉnh |
| Chọn điểm đón/trả khi đặt vé, gửi hàng | Giữ nguồn điểm của chuyến/API nghiệp vụ; không thay bằng danh mục tỉnh tự do |
| Chi tiết vé/hoá đơn/đơn gửi hàng | Chỉ đọc thông tin lịch sử, không đưa picker vào |
| Hồ sơ tài khoản/khách hàng/nhân viên | Không có field chọn tỉnh/thành hiện hành để thay |
| PostFilterSidebar | `PROVINCES` là hằng không có consumer/render; không tạo bộ lọc địa phương mới từ dead code |

Giữ giá trị tuyến cũ khi mở sửa dù không nằm trong danh mục. Input tìm không dấu, Arrow/Enter/Escape qua Base UI; chọn option mới cập nhật giá trị form, có loading/error/retry. Thay đổi không thêm hệ primitive khác.

Web còn bổ sung tên điểm thực tế từ các tuyến hoạt động qua `routesApi.listRoutes`, đọc đủ các trang thay vì chỉ 100 tuyến đầu. Điểm riêng chưa có trong danh mục vẫn chọn được. Nếu một nguồn lỗi, chỉ hiển thị dữ liệu thật từ nguồn còn lại kèm cảnh báo/retry; không dùng danh sách mẫu. Các điểm từ tuyến không có thông tin phiên bản không được tự gắn nhãn cũ.

## Kiểm chứng

Ngày 25-10-2026: 3 file unit test backend, **58 tests PASS** (`location-catalog.spec.ts`, `locations.service.spec.ts`, `trips.service.spec.ts`). Đã đọc trực tiếp nguồn v1 bên ngoài và xác nhận có 63 tỉnh/thành cùng các thành phố cũ; đây không phải kiểm chứng runtime API VexGo.

- Unit: parse danh mục, giữ hai phiên bản, thành phố cũ, alias tên, payload lỗi, cache/coalescing/backoff/stale/503 và query tìm chuyến dùng alias tên; mapping thiếu/trùng bị từ chối, Long An được gộp đúng dưới Tây Ninh.
- Không chạy integration/E2E/UI/component tests. Typecheck/lint/build/diff check không chạy theo yêu cầu trước đó của người dùng.
- Chưa xác nhận browser/API/DB runtime của VexGo. Người dùng smoke form tuyến, trang chủ/tìm chuyến, hai tab tìm kiếm `/posts`, `/send-freight` và `/shipments/new`; thử gõ không dấu, chọn ` - cũ`, đổi chiều, xóa địa điểm, lỗi mạng và giá trị cũ khi sửa tuyến.
