# Đề xuất sửa luồng gửi hàng độc lập VexGo

Ngày lập: 02-11-2026.

Trạng thái: **bản đề xuất để người dùng đọc, chỉnh và chốt; chưa phải lệnh triển khai**. Tài liệu này chưa thay đổi source, Prisma schema hay database. Tên trường và endpoint mới bên dưới là dự kiến, cần thống nhất contract trước khi viết code.

## 1. Mục tiêu và giới hạn

Giữ bố cục trang gửi hàng hiện tại. Khách chọn nơi gửi/nhận, tìm nhà xe, chọn bưu cục của nhà xe, khai báo hàng và tạo vận đơn. Khách không phải chọn chuyến hoặc hẹn giờ mang hàng đến.

Phương án kỹ thuật đang đề xuất: **tạo vận đơn trước, nhà xe phân chuyến sau**. Nhà xe chỉ xuất hiện trong kết quả khi có chuyến mở nhận hàng trên tuyến phù hợp. Điều kiện được nhận đơn và chuyến thực tế vận chuyển đơn là hai việc riêng.

Không làm backend/database riêng cho Customer hoặc Admin. Tất cả dùng chung NestJS, Prisma và MySQL. Hàng gửi kèm vé vẫn gắn chuyến của hành khách.

Chưa bao gồm giao tận nhà, vận chuyển qua nhiều chặng, ảnh/chữ ký giao hàng và quy trình hoàn hàng đầy đủ.

## 2. Nghiệp vụ cần thống nhất

### 2.1 Luồng khách hàng

1. Chọn nơi gửi, nơi nhận và ngày dự kiến mang hàng đến.
2. Tìm nhà xe có chuyến chưa khởi hành, bật nhận hàng, phục vụ tuyến phù hợp.
3. Chọn nhà xe; tải danh sách điểm gửi/nhận thuộc nhà xe và tuyến đó.
4. Chọn bưu cục, khai báo người gửi/nhận, hàng hóa và bên trả cước.
5. Backend báo cước dự tính; khách tạo vận đơn.
6. Đơn mới là `MOI_TAO`, hiển thị “Chờ mang hàng đến gửi”; chưa giữ sức chứa chuyến.
7. Khách mang hàng và mã vận đơn đến điểm gửi trong giờ mở cửa, trước hạn 48 giờ.

### 2.2 Tiếp nhận và vận chuyển

- Nhân viên nhập số cân/kích thước thực tế, xác nhận cước và thu tiền theo phương thức đã chọn.
- Tiếp nhận thành công chuyển sang `DA_TIEP_NHAN`.
- Nhân viên phân chuyến phù hợp. Backend kiểm tra tenant, tuyến/điểm, trạng thái chuyến, cờ nhận hàng và sức chứa tại thời điểm ghi dữ liệu.
- Không cho bắt đầu vận chuyển khi chưa phân chuyến.
- Luồng tiếp theo: `DANG_VAN_CHUYEN` → `DA_GIAO`; hủy trước vận chuyển phải có lý do.
- Phân/chuyển chuyến phải atomic, lưu lịch sử và giải phóng/chiếm sức chứa đúng một lần. Không giữ transaction khi chờ external call.

### 2.3 Cước

- Bảng cước theo cặp điểm gửi/nhận, loại hàng, khoảng khối lượng và ngày hiệu lực.
- Giữ cách cộng khối lượng theo từng loại hàng trước khi chọn bậc cước; xác nhận quy tắc này khi nghiệm thu.
- Khối lượng tính cước lấy mức lớn hơn giữa khối lượng thực và quy đổi kích thước theo công thức backend hiện có. Lưu số đo thực riêng, không thay bằng số quy đổi.
- Không thêm làm tròn lên mỗi 0,5 kg hoặc mỗi 1.000đ. Tiền dùng Decimal; quy tắc độ chính xác khối lượng phải đồng nhất ở báo giá và tiếp nhận.
- Khoảng cân phải khớp duy nhất. Đề xuất các bậc kế tiếp dùng `(cận dưới, cận trên]`, bậc đầu nhận giá trị dương đến cận trên; ví dụ đúng 5kg thuộc bậc đến 5kg, 5,01kg sang bậc tiếp theo. Phải kiểm tra dữ liệu hiện có trước khi đổi quy ước so sánh.
- Không có cước, có nhiều cước cùng khớp hoặc cước hết hiệu lực: trả lỗi nghiệp vụ; không tự lấy giá loại hàng/chặng khác hoặc giá mặc định.
- Giá trước tiếp nhận là dự tính. Khi cước đổi, giữ lịch sử, lý do, số đo và xác nhận của nhân viên; khách phải được thông báo khoản chênh lệch trước khi chốt.

### 2.4 Thanh toán và hết hạn

- Người gửi trả tại bến: nhân viên xác nhận thu tiền rõ ràng; không suy ra đã thu chỉ từ nút nhận hàng.
- Người nhận trả: được vận chuyển trước khi thu; xác nhận thu khi giao.
- Online: xác minh giao dịch qua luồng payment provider; tiếp nhận hàng không được tự biến giao dịch online đang chờ thành thành công.
- Lưu số tiền, thời điểm và người xác nhận thu tại bến. Giữ mã giao dịch provider unique và idempotency hiện có.
- Thiếu tiền sau cân đo: ghi nhận số còn phải thu và khoản thu bổ sung thực tế. Thừa tiền: mở hồ sơ xử lý thủ công, không sửa/xóa payment thành công.
- Hạn mang hàng đến là 48 giờ từ thời điểm tạo vận đơn, tách khỏi hạn thanh toán online. Chỉ tự hủy đơn còn `MOI_TAO`; đã tiếp nhận thì không áp dụng hạn này, kể cả người nhận chưa trả tiền.
- Đơn đã trả tiền nhưng hết hạn chưa mang hàng đến: hủy vận đơn, giữ nguyên lịch sử tiền và mở hồ sơ “Cần nhà xe xử lý”. Không tự hoàn và không mặc định khách mất tiền.
- Trước khi trả tiền phải hiển thị chính sách hết hạn, không tự hoàn và thông tin liên hệ nhà xe.
- Nhận hàng và job tự hủy chạy đồng thời phải được khóa/kiểm tra lại trạng thái trong cùng transaction.

## 3. Cần sửa trang nào

### 3.1 Customer: `/shipments/new`

File chính: `apps/web/src/features/shipments/components/send-freight-page.tsx`.

- Giữ thứ tự tìm tuyến → nhà xe → thông tin khách/bưu cục → hàng hóa → thanh toán.
- Thay tìm chuyến rồi gom nhà xe bằng API tìm lựa chọn nhận gửi; xử lý phân trang thật.
- Không tự gửi một `tripId` đại diện lúc tạo vận đơn.
- Bưu cục lấy theo nhà xe/tuyến; đổi lựa chọn cha phải reset lựa chọn con.
- Tách trạng thái chưa tìm kiếm, đang tải, lỗi tải và không có lựa chọn; có thử lại khi phù hợp.
- Giá lấy từ API báo giá. Không hiện giá mặc định như thể đã có bảng cước; chưa đủ dữ liệu thì chưa báo tổng chính thức.
- Khi tạo thành công: mã đơn, điểm gửi/nhận, trạng thái chờ gửi, hạn gửi cụ thể và cách liên hệ.
- Không yêu cầu giờ hẹn. Có thể hiển thị giờ mở cửa nếu nhà xe có dữ liệu; không suy diễn bưu cục mở 24/24.
- Không hứa “giao trong ngày/2–3 ngày” chỉ dựa vào thời lượng chuyến; dùng dự kiến được backend hỗ trợ hoặc không công bố cam kết chưa có căn cứ.
- Chặn gửi lặp, map lỗi backend về field, giữ dữ liệu form khi thất bại.

Service: `apps/web/src/features/shipments/services/shipments.api.ts`; cập nhật type/contract ở đây thay vì rải fetch trong component.

### 3.2 Customer: tra cứu trong trang gửi hàng và `/account/shipments`

File: `apps/web/src/features/account/components/customer-shipments-page.tsx`, service shipments dùng chung.

- Đơn chưa phân chuyến vẫn xem được; hiển thị nhà xe/tuyến/điểm từ dữ liệu vận đơn, không buộc đọc qua trip.
- Thông tin chuyến nullable, có nhãn “Chưa phân chuyến”; không dựng chuyến giả.
- Tách trạng thái hàng, trạng thái thanh toán, hạn mang hàng đến và hồ sơ cần nhà xe xử lý.
- Public lookup giữ giới hạn dữ liệu, xác minh mã + điện thoại, không lộ CCCD/thông tin thanh toán nhạy cảm.

### 3.3 Customer: `/payment` và các màn xác nhận/hóa đơn dùng đơn gửi

File liên quan: `apps/web/src/features/booking/services/payment-draft.ts`, các component payment/invoice đang dùng shipment.

- Draft và dữ liệu xác minh từ server không bắt buộc shipment có trip/departureTime.
- Tách nhà xe, tuyến và bưu cục ra khỏi object trip trong contract đích; cập nhật consumer đồng bộ.
- Phân biệt số tiền dự tính, cước đã chốt, số đã trả và số cần thu thêm.
- Hiển thị riêng hạn payment và hạn gửi hàng; payment phải xác minh trạng thái server.
- Không thay số tiền/nội dung payment attempt đang chờ đã phát hành; đối soát callback muộn và thu bổ sung theo giao dịch riêng.
- Rà các route invoice/bank-transfer để sửa nơi thật sự dùng shipment; không mặc định mọi trang hóa đơn đều phải đổi layout.

### 3.4 Admin: `/shipments`

Files: `apps/admin/src/features/shipments/components/shipments-management.tsx`, `shipment-details.tsx`; service/type/hook trong cùng feature.

- Danh sách/chi tiết hỗ trợ chưa phân chuyến; lọc được đơn chờ mang đến, đã nhận chưa phân chuyến và hồ sơ cần xử lý tiền.
- Thêm tiếp nhận/cân đo, xem chênh lệch và xác nhận cước.
- Thêm phân/chuyển chuyến với danh sách do backend giới hạn đúng tenant/tuyến và mở nhận hàng.
- Thao tác thu tiền rõ ràng; không gom nhận hàng với payment online thành công.
- Hiển thị lịch sử cân/cước, phân chuyến, thanh toán và hủy.
- Form tiền thủ công ghi lý do, khoản tiền, người xử lý và kết quả; đóng hồ sơ không đồng nghĩa đã có giao dịch hoàn tiền nếu chưa ghi nhận thực tế.
- Tái sử dụng shared Admin components và `apps/admin/DESIGN.md`; nghiệm thu desktop 1440×900 và mobile 375×667.

### 3.5 Admin: `/customers/[customerId]`

File: `apps/admin/src/features/customers/components/customer-shipments-tab.tsx` và API customers.

- Lịch sử đơn gửi hỗ trợ không có chuyến; cập nhật DTO/mapping và link chi tiết.
- Không mất thông tin nhà xe/chặng/điểm khi trip trống.

### 3.6 Các màn cần kiểm thử hồi quy

- Đặt vé + hàng đi kèm, lịch sử vé/booking và hủy vé: tiếp tục gắn chuyến của vé.
- Admin chuyến xe: sức chứa, đóng nhận hàng, hủy/xóa chuyến và chuyển vận đơn đã phân.
- Báo cáo doanh thu/hóa đơn: đối soát khoản thu bổ sung, hủy đơn đã trả tiền và hoàn thủ công; không cộng tiền hai lần hoặc xem hủy hàng là mất lịch sử thanh toán.
- Các danh mục nhà xe/bưu cục/loại hàng không cần thiết kế lại chỉ vì migration này.

## 4. Backend/API cần sửa

### 4.1 Modules/files chính

- `apps/api/src/shipments/`: controller/DTO/service, persistence, list/detail/lookup, tenant scope, tiếp nhận, phân chuyến.
- `apps/api/src/cargo-pricing/`: tái sử dụng một nguồn tính cước; tách yêu cầu ngày áp dụng và nhà xe/tuyến khỏi việc bắt buộc có chuyến đối với hàng độc lập.
- `apps/api/src/cargo-capacity/`: đơn chưa phân chuyến không chiếm sức chứa; khóa và tính lại khi phân/chuyển chuyến.
- `apps/api/src/payments/`: xác nhận thu tại bến, callback online, khoản chênh lệch, hết hạn và hồ sơ tiền thủ công.
- `apps/api/src/customers/`: mapping lịch sử đơn chưa phân chuyến.
- `apps/api/src/bookings/`, `tickets/`, `trips/`, `revenue-reports/`: sửa dependency thực sự bị ảnh hưởng và kiểm thử hồi quy.

### 4.2 Contract đích dự kiến

Đây là danh sách use case, chưa phải endpoint đã tồn tại. Trước khi triển khai phải rà controller để không tạo endpoint trùng.

- Tìm lựa chọn nhận hàng: đề xuất `GET /api/v1/shipments/options`; filter nơi gửi/nhận/ngày dự kiến, trả nhà xe + tuyến phục vụ, có pagination.
- Lấy bưu cục theo lựa chọn nhà xe/tuyến: endpoint chung không phụ thuộc `tripId`.
- Báo giá: đề xuất `POST /api/v1/shipments/quotes`; trả cước và chi tiết bậc cân. Tạo đơn vẫn tính/kiểm tra lại tại backend.
- Tạo đơn: sửa `POST /api/v1/shipments`; nhận lựa chọn nhà xe/tuyến, bưu cục, ngày dự kiến, người và hàng; dùng idempotency key; không yêu cầu chuyến cho đơn độc lập.
- List/detail/lookup hiện có: trip được nullable, carrier/route/points độc lập với trip, thêm hạn gửi và các số tiền phù hợp quyền truy cập.
- Thêm use case tiếp nhận/chốt cước, xác nhận thu tại bến, phân/chuyển chuyến và xử lý tiền thủ công; quyền và tenant kiểm tra tại backend.
- Tất cả giữ envelope `{ data }`, danh sách `{ data, meta }`, lỗi chuẩn; date-only mới là `DD-MM-YYYY`, timestamp ISO 8601. Endpoint trips search hiện dùng ngày legacy phải migration đồng bộ nếu bị thay đổi, không tự gửi format mới vào DTO cũ.

## 5. Database: thay đổi dự kiến trong `prisma/schema.prisma`

### 5.1 `PhieuGuiHang`

- `chuyenXeId Int` → `Int?`; relation `chuyenXe ChuyenXe` → `ChuyenXe?`, vẫn giữ foreign key.
- Thêm `tuyenXeId Int?` + relation/index để giữ tuyến phục vụ lúc chưa có chuyến. Đơn mới theo luồng này bắt buộc có tuyến ở service; backfill đơn cũ từ chuyến. Đây là bổ sung cần thiết nếu vẫn dùng tuyến hiện có để tìm nhà xe và phân chuyến, không đọc tuyến qua chuyến khi chuyến trống.
- `nhaXeId` không cần lặp lại: nguồn ownership là `DonGiaoDich.nhaXeId`; backend xác minh tuyến, hai bưu cục và chuyến nếu có cùng nhà xe.
- Thêm `hanMangHangDen DateTime? @db.DateTime(0)` và index `(trangThai, hanMangHangDen)` cho job hết hạn. Nullable phục vụ migration/đơn kèm vé; đơn độc lập mới luôn có hạn.
- Thêm `ngayDuKienGui DateTime? @db.Date` nếu giữ ô ngày gửi.
- Thêm `cuocDuTinh Decimal? @db.Decimal(18,2)`; giữ snapshot chi tiết dự tính trong lịch sử cước bên dưới. Không ghi đè báo giá ban đầu khi cân lại.
- Thêm `thoiDiemXacNhanCuoc DateTime?`, `taiKhoanXacNhanCuocId Int?` + relation tài khoản. Chưa xác nhận thì các cước hiện có là số tính ban đầu; sau xác nhận là cước hiện hành. API phải công bố trạng thái chốt cước, không suy ra chỉ từ số tiền.
- Giữ enum hiện tại; `MOI_TAO` đổi nhãn hiển thị, không cần đổi tên DB. Phân chuyến là thông tin riêng, không cần thêm trạng thái chỉ vì có/không có trip.

### 5.2 `HangHoa`: tách số đo, giữ tương thích dữ liệu cũ

Không đổi nghĩa hàng loạt các cột hiện có trong một bước: code hiện có thể lưu `khoiLuong` hiệu dụng đã xét quy đổi, không chắc là số cân gốc.

- Thêm `khoiLuongKhaiBao`, `chieuDaiKhaiBao`, `chieuRongKhaiBao`, `chieuCaoKhaiBao` kiểu `Decimal? @db.Decimal(10,2)`.
- Thêm `khoiLuongThucTe`, `chieuDaiThucTe`, `chieuRongThucTe`, `chieuCaoThucTe` cùng kiểu, để trống trước cân đo.
- Giữ các cột `khoiLuong/chieuDai/chieuRong/chieuCao` hiện có trong giai đoạn tương thích; xác định rõ mapping số đo hiện hành và sửa tất cả consumer trước khi cân nhắc bỏ cột cũ ở migration khác.
- Đơn mới lưu ngay số khai báo. Không suy đoán số cân thực hoặc số khai báo cho lịch sử không đủ bằng chứng.
- Số đo phải dương, hữu hạn, chiều dài/rộng/cao đủ bộ hoặc cùng trống; validation backend áp dụng cả khi gọi API trực tiếp.

### 5.3 `BangCuocGuiHang` và `ChiTietCuocGuiHang`

- Giữ model cước theo cặp điểm/loại hàng hiện có; không tạo bảng cước riêng cho Admin/Customer.
- Rà dữ liệu khoảng cân, khoảng ngày và dữ liệu chồng lấn trước khi đổi điều kiện cận. Quy tắc khoảng là sửa validator/query; không chỉ thêm unique là giải quyết được overlap.
- `ChiTietCuocGuiHang` giữ chi tiết cước hiện hành; khi xác nhận lại phải cập nhật cùng tổng cước/đơn trong transaction và giữ snapshot trước đó trong lịch sử.
- Ngày áp dụng cước đề xuất: ngày dự kiến gửi; đến nhận khác ngày phải báo lại nếu bảng giá thay đổi. Chính sách này cần người dùng chốt ở mục 9.

### 5.4 Bảng mới `LichSuDieuChinhCuocGuiHang`

Các trường dự kiến:

- Khóa chính; `phieuGuiHangId` FK; `taiKhoanId` nullable (hệ thống hoặc nhân viên).
- `loaiThaoTac`: báo giá lúc tạo/chốt cước/điều chỉnh.
- Cước trước/sau kiểu `Decimal(18,2)`, lý do, thời điểm.
- Snapshot trước/sau kiểu JSON: số đo, loại hàng, bậc cước/ID bảng cước, phụ phí và giảm giá để tái dựng phép tính. JSON chỉ là snapshot audit, không thay thế bảng nghiệp vụ hiện hành.
- Index theo `(phieuGuiHangId, thoiGian)`; không cho sửa/xóa lịch sử qua thao tác thông thường.

### 5.5 `ThanhToan` và hồ sơ tiền thủ công

- Tái sử dụng `soTien`, `phuongThuc`, `loaiGiaoDich`, `thoiDiemHoanTat`, mã SePay unique và cờ quyết toán hiện có.
- Thêm `taiKhoanXacNhanId Int?` + FK, dùng khi thu tại bến. Payment provider không cần giả lập nhân viên xác nhận.
- Thêm bảng `XuLyTienGuiHang`: FK vận đơn, lý do (hủy đã trả tiền/chênh lệch), số tiền cần xử lý Decimal, trạng thái chờ/đang xử lý/đã xử lý, người và thời gian xử lý, kết quả/tham chiếu chứng từ.
- Các khoản thu thêm/hoàn thực tế phải được ghi nhận qua giao dịch tương ứng với quy ước payment hiện có, không chỉ đổi một cờ trong hồ sơ. Hồ sơ liên kết giao dịch khi có để báo cáo đối soát được.
- Thêm khóa nghiệp vụ unique phù hợp để job retry không tạo nhiều hồ sơ cho cùng một sự kiện hết hạn/điều chỉnh.
- Hủy vận đơn không xóa hoặc biến payment thành công thành thất bại. Chỉ hủy attempt đang chờ khi phù hợp.
- `DonGiaoDich.tongTien` là nghĩa vụ cước hiện hành; tổng tiền đã thu lấy từ giao dịch hợp lệ. Với đơn có vé + hàng phải tính lại tổng toàn đơn, không ghi đè tổng bằng riêng cước hàng.

### 5.6 Chống tạo đơn trùng

Đề xuất bảng `YeuCauTaoPhieuGuiHang`:

- Idempotency key có unique theo phạm vi thao tác/identity được thiết kế cho cả guest và đăng nhập.
- Hash payload chuẩn hóa; trạng thái xử lý và FK tới đơn/vận đơn đã tạo.
- Cùng key + cùng nội dung trả lại cùng kết quả; cùng key + khác nội dung trả conflict.
- Không lưu raw payload chứa CCCD/thông tin cá nhân chỉ để chống trùng.
- Thời điểm tạo/hết thời gian lưu. Key không phải quyền truy cập đơn; response vẫn tuân thủ auth/lookup.

### 5.7 Lịch sử phân/chuyển chuyến

Đề xuất bảng `LichSuPhanChuyenGuiHang`: FK vận đơn, chuyến trước/sau nullable phù hợp thao tác, người thực hiện, thời điểm và lý do. `PhieuGuiHang.chuyenXeId` là chuyến hiện tại; lịch sử giúp đối chiếu khi đổi chuyến.

Giữ `LichSuTrangThaiPhieuGuiHang` cho sự kiện trạng thái hiện có; không nhét toàn bộ cước, payment và phân chuyến vào `ghiChu`.

## 6. Migration giữ dữ liệu cũ

1. Kiểm kê consumer và dữ liệu thật; sao lưu, thử migration trên bản sao trước. Không reset database, không sửa migration team đã dùng.
2. Thêm bảng/cột mới ở dạng tương thích; giữ tên model/field tiếng Việt và cột cũ. Chỉ cho phép trip nullable sau khi đã xác định kế hoạch rollout.
3. Backfill tuyến từ chuyến hiện có; giữ nguyên chuyến, cước và giao dịch cũ. Giá trị thiếu bằng chứng giữ null; không gắn nhãn “cân thực tế” cho dữ liệu cũ.
4. Hạn 48 giờ của đơn cũ phải phân loại độc lập/kèm vé và trạng thái. Đơn lịch sử đã nhận/giao không được đưa vào job tự hủy; đơn chờ gửi cũ cần chính sách chuyển tiếp, không tự hủy hàng loạt khi deploy.
5. Cập nhật toàn bộ backend reader, DTO và frontend để chịu được trip null; tuyến/carrier lấy độc lập. Hoàn thành trước khi bật writer tạo đơn không có chuyến.
6. Bật luồng mới sau khi cả Customer/Admin đã tương thích; backend kiểm tra tenant ngay cả khi không có chuyến. API cũ dựa vào trip chỉ bỏ sau khi không còn consumer.
7. Nếu rollback ứng dụng sau khi đã có đơn trip null, không được đưa code cũ đọc trip bắt buộc trở lại hoặc ép cột NOT NULL; phải có phương án tương thích dữ liệu mới.

## 7. Kiểm thử bắt buộc và tiêu chí nghiệm thu

- Nhà xe có tuyến nhưng không có chuyến mở nhận hàng không được hiện là lựa chọn hợp lệ; có chuyến tắt nhận hàng thì không lọt vào kết quả.
- Kiểm tra thời gian tìm kiếm, ngày gửi và các chuyến gần hết hạn; hết kết quả không bị nhầm thành lỗi mạng.
- Bưu cục khác nhà xe/tuyến hoặc đã ngừng hoạt động bị backend từ chối.
- Tạo đơn không có trip thành công; list/detail/lookup/payment và Admin không crash.
- Đúng cận cân, ngoài cận, gap/overlap, bảng cước hết hiệu lực; không còn fallback giả. Tiền và độ chính xác đồng nhất frontend/backend.
- Phân/chuyển chuyến đồng thời không vượt sức chứa; booking kèm hàng vẫn kiểm soát chỗ đúng như trước.
- Online chưa trả không thành công khi tiếp nhận; webhook lặp/muộn và thu bổ sung không ghi trùng/doanh thu trùng.
- Đơn chưa nhận hết 48 giờ tự hủy đúng một lần; đã nhận không hủy dù người nhận chưa trả. Nhận hàng cạnh tranh với job hết hạn không tạo trạng thái mâu thuẫn.
- Đơn đã trả hết hạn giữ giao dịch và tạo đúng một hồ sơ tiền thủ công; không tự hoàn.
- Cân lại lưu đủ số đo gốc/thực tế, cước trước/sau và actor; không sửa payment attempt cũ gây sai callback.
- Customer chỉ xem đơn mình; Admin chỉ nhà xe mình. Scope không dựa vào trip khi trip null.
- Migration giữ được dữ liệu cũ; các màn vé, booking, chuyến, hồ sơ khách và báo cáo doanh thu qua hồi quy.
- Backend unit/integration tests đặt dưới `apps/api/test/` đúng domain; e2e dưới `apps/api/test/e2e/`. Nghiệm thu UI desktop/mobile, loading/error/empty/success, focus và label.

## 8. Thứ tự triển khai dự kiến

1. Chốt các lựa chọn ở mục 9 và API contract. Kiểm tra GitNexus impact từng symbol trước khi sửa code.
2. Sửa độc lập lỗi xác nhận payment online; không chờ toàn bộ rework mới xử lý.
3. Migration theo hướng mở rộng + cập nhật reader/tenant scope; chưa bật tạo đơn trip null.
4. Backend tìm nhà xe/bưu cục, quote/create độc lập và idempotency; cập nhật Customer.
5. Admin tiếp nhận/cân đo/chốt cước, thu tiền và phân chuyến.
6. Hết hạn 48 giờ, tiền thủ công, payment/invoice/history/report consumers.
7. Migration rehearsal, integration/e2e và visual QA; graph change analysis trước commit, CI bắt buộc pass trước merge.

## 9. Các điểm người dùng cần chốt

- Có đồng ý sửa schema để phân chuyến sau hay giữ nguyên DB và tiếp tục tự gắn chuyến lúc tạo? Toàn bộ tài liệu ưu tiên phương án sửa schema; chưa coi là đã duyệt triển khai.
- Khi tìm nhà xe: có chuyến mở nhận hàng đúng ngày dự kiến gửi hay trong một khoảng lịch phục vụ? Khách có thể mang hàng trong 48 giờ, nên không được hứa chuyến cụ thể sẽ còn phù hợp khi khách đến.
- Ngày dự kiến gửi có bị giới hạn trong 48 giờ từ lúc tạo đơn không? Đề xuất có, nếu giữ thời hạn cố định đã trao đổi.
- Cước áp dụng theo ngày dự kiến gửi, ngày tạo đơn hay ngày thực tế tiếp nhận? Đề xuất ngày dự kiến để báo giá và cân lại theo ngày tiếp nhận nếu khác; phải báo khách khi đổi tiền.
- Cận khoảng cân `(min,max]` và cách gom cân theo loại hàng cần xác nhận sau khi rà dữ liệu hiện hành.
- Khách xác nhận chênh lệch tại quầy hay qua web? Đề xuất đợt đầu xác nhận tại quầy, có actor/thời gian và lý do; chưa thêm quy trình duyệt online.
- Đơn chờ gửi tồn tại trước migration dùng hạn chuyển tiếp nào? Cần chốt trước khi bật job mới.

## 10. Nguồn và giới hạn khảo sát

- Đối chiếu source tại `prisma/schema.prisma`, feature shipments Customer/Admin, shipments/payment/cargo-pricing/cargo-capacity backend và các consumer lịch sử/payment.
- Phát hiện dependency trực tiếp đang đọc trip bắt buộc ở shipment service, payment draft, Admin shipment detail và lịch sử khách.
- GitNexus đã được dùng để tra cứu nhưng có kết quả thiếu/stale và dữ liệu đường dẫn không tin cậy ở một số truy vấn. Danh sách ảnh hưởng này được kiểm chứng thêm bằng source, chưa phải cam kết graph đã bao phủ toàn repo; phải khắc phục index trước impact gate triển khai.
- Lần review trước đã chạy 7 test frontend gửi hàng và 52 unit test backend shipments thành công. Đó không phải nghiệm thu phương án mới; chưa chạy integration MySQL/payment thực tế cho tài liệu này.
