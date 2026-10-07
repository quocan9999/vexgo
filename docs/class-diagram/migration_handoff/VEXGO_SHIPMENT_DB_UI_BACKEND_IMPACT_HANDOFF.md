# VexGo — Handoff ảnh hưởng UI và backend sau migration shipment 002

> Tài liệu này là bản đồ các phần ứng dụng cần được rà soát/cập nhật sau khi database shipment chuyển sang Class Diagram 002. Rà soát ngày 07/10/2026 trên branch `fix/admin-shipment-002-impact`: Phase 1–3 đã hoàn tất cho sức chứa loại xe, cấu hình chuyến và lịch sử gửi hàng Admin; API shipment đầy đủ và luồng Customer Web vẫn chưa được triển khai.

**Ngày rà soát:** 07/10/2026

**Nhánh được rà soát:** `fix/admin-shipment-002-impact`

**Diagram đích:** `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`

**Tài liệu migration nền:** `docs/class-diagram/migration_handoff/VEXGO_SHIPMENT_DB_MIGRATION_COMPLETION_HANDOFF.md`

## 1. Kết luận nhanh

Migration đã đưa Prisma/MySQL sang mô hình 002. Trên branch này, Phase 1–3 đã cập nhật hợp đồng sức chứa loại xe, tạo chuyến và lịch sử gửi hàng Admin. Chức năng shipment đầy đủ và kết nối Customer Web vẫn cần triển khai. Những phần cần ưu tiên tiếp:

1. **Lịch sử gửi hàng Admin đã theo schema 002.** `CustomersService.listAdminCustomerShipments` trả `receiver.fullName`/`phoneNumber`, chuyến và hai điểm gửi/nhận bắt buộc; không còn `pickupMethod`, `deliveryMethod`, `pickupAddress`, `receiver.address` hoặc branch fallback. Admin hiển thị tên và địa chỉ điểm cùng đủ năm trạng thái 002.
2. **Tạo chuyến đã có cờ nhận gửi và ba snapshot sức chứa.** `TripsService.create` nhận `acceptsShipments` (mặc định `false`) và lấy ba mặc định từ `LoaiXe`. Admin cho chọn cờ khi tạo và đọc cờ/snapshot ở danh sách, chi tiết; không sửa cờ hoặc snapshot sau khi tạo.
3. **Seed và verifier theo các invariant đã chốt.** Một phiếu demo có thể chứa nhiều `LoaiHangHoa`; seed nhóm `HangHoa` theo loại, tính `SUM(khoiLuong * soLuong)`, chọn đúng một rate và ghi một `ChiTietCuocGuiHang` cho mỗi loại. `cuocChinh` bằng tổng các dòng cước. Nếu `DonGiaoDich` có cả phiếu vé và phiếu gửi, vé và phiếu gửi dùng cùng `ChuyenXe`. Migration forward kiểm tra dữ liệu hiện hữu và backfill snapshot đủ tải hoạt động.
4. **Admin history đã bỏ cách hiển thị legacy.** Tab dùng hợp đồng điểm gửi/nhận mới, chỉ hiển thị tên/địa chỉ tại từng điểm, thông tin người nhận là tên và điện thoại, và map đủ năm trạng thái schema 002. Lịch sử vẫn read-only.
5. **Customer Web chưa chạy bằng database.** Trang gửi hàng vẫn dùng dữ liệu, nhà xe, chuyến, sức chứa và cách tính phí hard-code; không gọi API shipment. Đây là chức năng chưa được nối theo mô hình 002, không phải bằng chứng rằng trang đang query sai database.
6. **Quản lý loại xe đã cấu hình ba sức chứa mặc định.** API và Admin đọc/ghi sức chứa xe máy, hàng cồng kềnh và hàng nhẹ; create bỏ trống mặc định 0, update bỏ trống giữ giá trị hiện có. Các giá trị này là mặc định cho chuyến mới.
7. **Đặt vé một chiều kèm hành lý cũng bị ảnh hưởng.** Booking một chiều đang cộng phí hành lý tính ở client vào tổng vé rồi lưu một `PaymentDraft` trong `sessionStorage`; payment hiện chỉ chuyển tới hóa đơn mock. Flow này chưa tạo shipment/fee detail trong database và cần được nối vào backend cùng với luồng shipment độc lập. Phạm vi khởi đầu là một chiều; chưa gắn shipment vào booking khứ hồi.

## 2. Schema mới mà ứng dụng phải tuân theo

| Khái niệm | Schema sau migration 002 | Cấu trúc cũ không còn dùng |
|---|---|---|
| Điểm gửi/nhận | `DiemGiaoNhanHang`, khóa `diemGiaoNhanHangId`, mã `maDiem`, tên `tenDiem` | Model `BuuCuc`, `buuCucId`, `maBuuCuc`, `tenBuuCuc` |
| Điểm thuộc tuyến | `DiemGiaoNhanTuyenXe`, vai trò `GUI_HANG`, `NHAN_HANG`, `CA_HAI` | Suy ra điểm gửi/nhận chỉ từ `TuyenXe.diemDi/diemDen` |
| Cước gửi | `BangCuocGuiHang` theo `diemGuiId`, `diemNhanId`, `loaiHangHoaId` và khoảng cân nặng/ngày hiệu lực; snapshot áp dụng nằm trong `ChiTietCuocGuiHang` theo từng loại | `buuCucGuiId`, `buuCucPhatId`, `hinhThucLayHang`, `hinhThucGiaoHang` |
| Phiếu gửi | Bắt buộc bốn quan hệ trực tiếp `chuyenXeId`, `diemGuiId`, `diemNhanId`, `donGiaoDichId`; không còn FK cước trực tiếp. `cuocChinh` bằng tổng detail; người nhận có tên và điện thoại | Có thể chưa gán chuyến/điểm; `bangCuocApDungId`; địa chỉ nhận/lấy và hình thức lấy/giao |
| Chi tiết cước gửi | `ChiTietCuocGuiHang`: một dòng duy nhất cho mỗi `(phieuGuiHangId, loaiHangHoaId)`, chứa rate, khối lượng tính cước và `soTienCuoc` snapshot | Một cước đơn áp dụng cho toàn bộ phiếu |
| Trạng thái gửi | `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN`, `DA_GIAO`, `DA_HUY` | `CHO_DIEU_PHOI` và các trạng thái không còn nằm trong enum mới |
| Nhóm loại hàng | `LoaiHangHoa.nhomSucChua`: `XE_MAY`, `HANG_CONG_KENH`, `HANG_NHE` | Loại hàng không có nhóm sức chứa |
| Loại xe | Ba mặc định: `sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, `sucChuaHangNheMacDinh` | Một sức chứa ghế không đại diện sức chứa hàng |
| Chuyến xe | `nhanGuiHang` và ba snapshot bắt buộc `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe` | Chuyến chỉ có thông tin lịch chạy/xe/ghế, không có snapshot sức chứa hàng |
| Lịch sử trạng thái | `LichSuTrangThaiPhieuGuiHang` | Chưa có bảng sự kiện lịch sử tương ứng |

Các model và trường trên được xác nhận trong [`prisma/schema.prisma`](../../../prisma/schema.prisma). Chi tiết backfill và dữ liệu demo nằm trong handoff migration nền ở đầu tài liệu.

## 3. Mức độ ảnh hưởng theo khu vực

### API/Admin — Lịch sử gửi hàng theo schema 002 đã hoàn tất (read-only)

**Endpoint:** `GET /api/v1/customers/:id/shipments`

**Luồng:** Customer Workspace → tab Gửi hàng → `getCustomerShipments` → `AdminCustomersController.getShipments` → `CustomersService.listAdminCustomerShipments` → Prisma.

Thay đổi đã có trong branch:

- [`apps/api/src/customers/customers.service.ts`](../../../apps/api/src/customers/customers.service.ts): truy vấn các relation `diemGui`, `diemNhan`, `chuyenXe` bắt buộc và trả `receiver` chỉ gồm tên/điện thoại cùng `trip`, `originPoint`, `destinationPoint`.
- API đã bỏ `pickupMethod`, `deliveryMethod`, `pickupAddress`, `receiver.address`, `originBranch` và `destinationBranch`; không còn fallback cho các relation bắt buộc.
- [`apps/api/src/customers/admin-customers.controller.ts`](../../../apps/api/src/customers/admin-customers.controller.ts): giữ endpoint, quyền truy cập và query phân trang hiện có.
- [`apps/admin/src/features/customers/services/customer-service.ts`](../../../apps/admin/src/features/customers/services/customer-service.ts) và [`apps/admin/src/features/customers/types/customer.ts`](../../../apps/admin/src/features/customers/types/customer.ts) dùng contract mới.
- [`apps/admin/src/features/customers/components/customer-shipments-tab.tsx`](../../../apps/admin/src/features/customers/components/customer-shipments-tab.tsx): hiển thị tên/địa chỉ tại hai điểm, tên/điện thoại người nhận và đủ năm trạng thái mới; không còn cột hình thức lấy/giao. Tab vẫn read-only.

Schema 002 không có quan hệ/cột bưu cục, địa chỉ nhận tận nhà hoặc hình thức lấy/giao cũ. Test tích hợp API xác minh response mới, không có field legacy, giữ tenant visibility và tìm kiếm; test Admin xác minh điểm, người nhận, trạng thái, empty/error/retry và search.

### API/Admin — Tạo chuyến nhận gửi hàng và snapshot sức chứa đã hoàn tất

**Luồng:** Admin tạo chuyến → `TripsController` → `TripsService.create` → Prisma `ChuyenXe.create`.

- [`apps/api/src/trips/dto/create-trip.dto.ts`](../../../apps/api/src/trips/dto/create-trip.dto.ts) nhận `acceptsShipments?: boolean`; omission tạo chuyến với `false`. [`apps/admin/src/features/trips/components/trip-form-dialog.tsx`](../../../apps/admin/src/features/trips/components/trip-form-dialog.tsx) có checkbox `Nhận gửi hàng` mặc định bỏ chọn.
- [`apps/api/src/trips/trips.service.ts`](../../../apps/api/src/trips/trips.service.ts): `create` đọc ba giá trị mặc định từ `LoaiXe` và ghi chúng vào snapshot chuyến.
- Các cột snapshot ở [`prisma/schema.prisma`](../../../prisma/schema.prisma) là `NOT NULL`; API đã truyền đủ dữ liệu khi tạo chuyến.
- Trip list/detail expose `acceptsShipments` và ba trường trong `cargoCapacity`; dữ liệu đọc trực tiếp từ snapshot, không fallback sang giá trị Loại xe hiện tại.
- `UpdateTripDto`/form chỉ cập nhật lịch chạy; không nhận thay đổi cờ nhận gửi hoặc snapshot theo giới hạn Phase 2.

**Giới hạn giữ nguyên:** chưa có xử lý shipment runtime, sức chứa còn lại, giữ chỗ hàng hoặc sửa cờ/snapshot sau khi tạo chuyến.

### Đã xử lý — Admin quản lý sức chứa mặc định loại xe

Các file liên quan:

- [`apps/api/src/vehicle-types/vehicle-types.service.ts`](../../../apps/api/src/vehicle-types/vehicle-types.service.ts) và DTO đọc/ghi ba giá trị mặc định theo contract API.
- [`apps/admin/src/features/vehicle-types/types/vehicle-type.ts`](../../../apps/admin/src/features/vehicle-types/types/vehicle-type.ts), service và form hỗ trợ ba field; form ghi rõ chúng chỉ áp dụng cho chuyến mới.
- API create mặc định field bị lược bỏ thành `0`; API update chỉ ghi field được gửi. Giá trị phải là số nguyên không âm trong phạm vi Int32.

Không có thay đổi Prisma schema hoặc migration trong Phase 1. Chuyến đã tạo giữ snapshot riêng; đổi mặc định loại xe không sửa chuyến cũ.

### P1 — Customer Web gửi hàng chưa dùng mô hình 002

- Trang là [`apps/web/src/features/shipments/components/send-freight-page.tsx`](../../../apps/web/src/features/shipments/components/send-freight-page.tsx), được mount tại [`apps/web/src/app/(public)/shipments/new/page.tsx`](../../../apps/web/src/app/%28public%29/shipments/new/page.tsx).
- Nhà xe/chuyến/điểm và thông tin còn chỗ được ghi tĩnh trong JSX; phí được tính ở frontend bằng hàm cục bộ; nút “Tạo mã vận đơn” chỉ chuyển tới `/payment`.
- Không tìm thấy service gọi API shipment trong luồng này. [`apps/web/src/mocks/shipments.ts`](../../../apps/web/src/mocks/shipments.ts) cũng là fixture tĩnh.

Trang cần được chuyển sang API thật khi triển khai chức năng gửi hàng: tải điểm, chuyến có `nhanGuiHang`, cước khớp cặp điểm + loại hàng, và sức chứa theo nhóm. Khi tạo phiếu, backend ghi bốn quan hệ trực tiếp bắt buộc (`chuyenXeId`, `diemGuiId`, `diemNhanId`, `donGiaoDichId`); với mỗi loại hàng, backend nhóm khối lượng, chọn đúng một rate và tạo detail tương ứng. `PhieuGuiHang` không có `bangCuocApDungId`. Backend phải tính/kiểm tra phí và sức chứa. UI cần bỏ địa chỉ lấy/giao tận nơi và biểu diễn lựa chọn điểm gửi/điểm nhận. Đây là phần chức năng chưa hoàn thiện, không phải lỗi truy vấn DB đang chạy của trang hiện tại.

### P1 — Chưa có module nghiệp vụ shipment trong API

Không có module shipment chuyên biệt trong `apps/api/src/`. Các khái niệm shipment hiện diện ở schema và một số luồng đọc/tích hợp trong `CustomersService`/`TripsService`, nhưng chưa có backend API shipment đầy đủ để:

- Tra cứu điểm gửi/nhận được cấu hình trên tuyến (`DiemGiaoNhanTuyenXe`).
- Quản lý/chọn `BangCuocGuiHang` theo điểm, loại hàng, cân nặng và hiệu lực.
- Tạo `PhieuGuiHang` với bốn quan hệ trực tiếp bắt buộc: chuyến, hai điểm và giao dịch; tạo một `ChiTietCuocGuiHang` cho mỗi loại hàng cùng rate khớp loại, khối lượng và điểm.
- Tính `PhieuGuiHang.cuocChinh` bằng tổng `ChiTietCuocGuiHang.soTienCuoc`; giữ nguyên snapshot sau khi xác nhận dù `BangCuocGuiHang` được sửa cho phiếu mới.
- Cập nhật trạng thái có ghi `LichSuTrangThaiPhieuGuiHang`.
- Tính sức chứa sử dụng theo nhóm hàng và loại trừ phiếu đã hủy.

Đây là phạm vi backend cần agent triển khai theo module riêng, không nên tiếp tục nhúng toàn bộ truy vấn shipment vào UI hoặc controller khách hàng.

### Đã xử lý — Seed và xác minh seed theo schema 002

- [`prisma/seed.mjs`](../../../prisma/seed.mjs): tạo `DiemGiaoNhanHang`, `DiemGiaoNhanTuyenXe`, 126 dòng cước theo 7 loại hàng và 6 khoảng cân nặng; gán nhóm `HANG_NHE`; ghi ba snapshot sức chứa trên mọi chuyến; tạo phiếu gửi với đủ điểm gửi/nhận, nhiều loại hàng, detail cước từng loại và lịch sử trạng thái. Giao dịch ghép vé/gửi dùng cùng chuyến. Seed dọn các dòng hàng demo cũ không còn thuộc fixture mới. Các mã điểm giữ convention demo `FUTA-BC-001` dạng tương tự.
- [`prisma/verify-seed.mjs`](../../../prisma/verify-seed.mjs): kỳ vọng 15 điểm, 6 mapping điểm/tuyến, 126 dòng cước và 60 bản ghi lịch sử; kiểm tra mã hành chính, nhà xe/tuyến/điểm/cước, trạng thái hiện hành, snapshot sức chứa, tải hàng theo nhóm, đúng một detail mỗi loại, composite type/rate, tổng `cuocChinh` và giao dịch vé/gửi cùng chuyến. `soTienCuoc` là snapshot: verifier không so nó với `mucCuoc` hiện tại của rate.

Đã chạy `prisma db seed` và `node prisma/verify-seed.mjs` trên MySQL 8.4 cô lập mới sau khi áp dụng đủ 22 migrations. Seed tạo đủ dữ liệu demo và verifier đạt toàn bộ kiểm tra. `findOrCreate` tra cứu điểm và mapping bằng điều kiện field thường; verifier so sánh trạng thái history bằng `BINARY` để không phụ thuộc collation của hai bảng. Regression harness còn sửa một rate sau khi backfill và xác nhận `ChiTietCuocGuiHang.soTienCuoc` cùng lịch sử tài chính không đổi. Database dev của thành viên không bị dùng trong kiểm tra này. Seed dùng giá cước demo theo cân nặng và không thêm phí lấy/giao tận nơi vì schema 002 chỉ còn luồng giao/nhận tại điểm.

### Test contract hiện hành và khoảng trống nghiệp vụ cần bổ sung sau

- [`apps/api/test/integration/customers/admin-customers.spec.ts`](../../../apps/api/test/integration/customers/admin-customers.spec.ts): kiểm tra contract điểm/chuyến bắt buộc, field legacy vắng mặt, tenant visibility và search.
- [`apps/admin/test/customer-shipments.spec.tsx`](../../../apps/admin/test/customer-shipments.spec.tsx): kiểm tra tên/địa chỉ điểm, người nhận, năm trạng thái, không còn nhãn legacy, empty/error/retry và search.
- [`apps/api/test/unit/trips/trips.service.spec.ts`](../../../apps/api/test/unit/trips/trips.service.spec.ts): xác minh default nhận gửi và ba giá trị snapshot từ loại xe.
- Các integration fixture chuyến có đủ snapshot bắt buộc; Vehicle Type mock trong cả Fare Price test dùng đủ ba field capacity theo contract Phase 1.
- Regression test Vehicle Type kiểm tra relationship accessibility giữa label/textarea và mô tả dialog, đồng thời phát hiện duplicate ID.
- Chưa có test/feature nghiệp vụ cho việc bật `nhanGuiHang`, điều chỉnh snapshot theo chuyến hoặc cấp phát sức chứa đồng thời; cần xác định rule trước khi mở rộng API/UI.

## 4. Các luồng liên quan và phạm vi ảnh hưởng

- **Phần vé của luồng đặt vé:** `BangGia`, `PhieuDatVe`, `Ve` không đổi schema trong migration shipment. Tạo chuyến backend hiện ghi snapshot từ loại xe nên đã qua yêu cầu schema; tiếp tục giữ các kiểm tra hiện có cho luồng chọn/giữ chỗ vé. Phần hành lý đi kèm booking chịu ảnh hưởng riêng như mô tả bên dưới.
- **Đặt vé một chiều kèm hành lý — đang tính ở client, chưa lưu shipment thật:** [`luggage-step.tsx`](../../../apps/web/src/features/booking/components/luggage/luggage-step.tsx) tính phí theo các ngưỡng tổng cân nặng hard-code; [`one-way-booking.tsx`](../../../apps/web/src/features/booking/components/one-way-booking.tsx) cộng `luggageFee` vào `totalFare` và đưa hành lý vào `PaymentDraft`. [`payment-draft.ts`](../../../apps/web/src/features/booking/services/payment-draft.ts) chỉ lưu `fee`, `weight` và summary trong `sessionStorage`; summary hiện giữ `luggageItems.length`, tổng cân nặng, phí và category của phần tử đầu tiên, không giữ đủ từng dòng hàng. [`payment-page.tsx`](../../../apps/web/src/features/payments/components/payment-page.tsx) hiện chuyển sang mã hóa đơn cố định sau timeout; [`invoice-page.tsx`](../../../apps/web/src/features/payments/components/invoice-page.tsx) dùng fixture tĩnh. Vì vậy draft và hóa đơn hiện không phải bản ghi `PhieuGuiHang`/`ChiTietCuocGuiHang` đã persist.
- Mapping hàng phải tách hai field hiện có trong UI: `ILuggageItem.type` chứa giá trị như `Vali`, `Balo`, `Thùng hàng`, `Xe đạp`, `Thiết bị điện tử`, `Hành lý khác` và cần một mapping/catalog rõ ràng sang `LoaiHangHoa`; `ILuggageItem.category` có giá trị `normal`/`fragile`/`valuable`, là thuộc tính xử lý/đặc tính hàng (dù label UI hiện ghi “Loại hàng”), không được map thẳng thành `LoaiHangHoa`. Nếu cần lưu category này, thiết kế field/ghi chú dịch vụ riêng.
- Phạm vi tích hợp hiện tại chỉ là booking một chiều: UI khứ hồi tạo một payment draft có hai `tripId` nhưng không có bước nhập hành lý tương đương. Schema cho phép một `DonGiaoDich` có tối đa một `PhieuDatVe` và một `PhieuGuiHang`; `PhieuDatVe` lại chứa nhiều `Ve`, mỗi vé suy ra chuyến qua `GheChuyenXe`, trong khi một `PhieuGuiHang` có đúng một `chuyenXeId`. Vì vậy một shipment không thể cùng thỏa invariant chuyến với cả lượt đi và lượt về của booking khứ hồi. Không bật flow khứ hồi+kèm shipment cho tới khi chốt thiết kế riêng, chẳng hạn tách giao dịch theo từng leg hoặc đổi quan hệ để shipment gắn rõ với một leg/chuyến.
- Khi hoàn thiện flow một chiều, backend phải tự tính lại cước và sức chứa; giữ từng món hàng và loại hàng, tạo một detail cước cho mỗi loại theo schema 002, rồi liên kết phiếu vé và phiếu gửi vào cùng `DonGiaoDich` và cùng `ChuyenXe`. Các ghi database liên quan cần all-or-nothing; không dùng phí hoặc sức chứa do draft frontend gửi lên làm nguồn sự thật.
- **CRUD loại xe:** đã có ba mặc định sức chứa; các giá trị này chỉ làm đầu vào snapshot cho chuyến mới, chưa phải luồng shipment runtime.
- **Trang gửi hàng customer hiện tại:** do đang là giao diện demo tĩnh nên chưa query các cột DB đã đổi; tích hợp API thật mới là bước bị ảnh hưởng trực tiếp bởi contract 002.
- **Hủy chuyến:** `TripsService.cancel` có truy vấn phiếu gửi và chặn chuyến có shipment đang hoạt động. Cần giữ lại hành vi bảo vệ này; kiểm tra lại trạng thái giữ chuyến theo enum 002 và bổ sung xử lý sức chứa khi thiết kế luồng shipment. `DA_GIAO`/`DA_HUY` vẫn là trạng thái hợp lệ trong enum mới.

## 5. Thứ tự đề xuất để agent tiếp tục

1. Chốt contract shipment backend: API danh mục điểm/tuyến/cước, tạo vận đơn, chuyển trạng thái và ghi lịch sử; thống nhất DTO/response trước khi nối UI.
2. **Hoàn tất trong Phase 1–2:** API/Admin cấu hình ba sức chứa mặc định, chọn `acceptsShipments` khi tạo chuyến và đọc snapshot; không cho cập nhật cờ/snapshot sau khi tạo.
3. **Hoàn tất trong Phase 3:** Admin Customer Workspace hiển thị tên/địa chỉ hai điểm, thông tin người nhận theo contract và đủ trạng thái 002; lịch sử read-only.
4. Nối hành lý vào booking một chiều: giữ đủ từng món; map `ILuggageItem.type` sang `LoaiHangHoa` bằng catalog đã chốt; giữ `category` như thuộc tính riêng; để backend tính cước/sức chứa và tạo phiếu gửi cùng `DonGiaoDich`/`ChuyenXe` của booking. Thay `PaymentDraft` và invoice mock bằng kết quả API thật.
5. Chưa bật booking khứ hồi kèm shipment. Nếu cần hỗ trợ, chốt trước cách tách giao dịch theo leg hoặc cách sửa quan hệ/invariant để mỗi shipment có một chuyến cụ thể.
6. Thay UI gửi hàng tĩnh bằng service/API thật; backend là nguồn xác thực cuối cùng cho cước, điều kiện tuyến và sức chứa.
7. Xác định rule giữ/nhả sức chứa và concurrency trước khi triển khai thao tác tạo/cập nhật phiếu gửi.
8. Seed/verifier đã chạy thành công trên DB cô lập. Khi kiểm tra DB cá nhân, dùng các lệnh trong handoff migration và xác nhận URL `.env` trước khi seed.
9. Đã chạy targeted regression, API/Admin typecheck và lint cho phạm vi Phase 1–3; không chạy full suites hoặc full E2E. GitHub Actions run `37604228110` trên commit Phase 3 có API CI, Admin CI và Web CI đều green. Sau commit final handoff cần kiểm tra lại Actions của commit mới nhất trước khi merge.

## 6. Checklist khi hoàn tất phần ứng dụng

- [ ] Prisma Client đã được generate từ `prisma/schema.prisma` hiện hành.
- [x] Typecheck API không còn tham chiếu các model/cột shipment cũ trong các luồng ảnh hưởng CI đã sửa.
- [x] Tạo chuyến ghi ba snapshot sức chứa mặc định.
- [x] Expose lựa chọn `acceptsShipments` khi tạo chuyến và giá trị đọc ở trip list/detail; default `false`.
- [ ] API shipment đảm bảo bốn FK trực tiếp bắt buộc (`chuyenXeId`, hai điểm, `donGiaoDichId`), tính phí theo từng loại và ghi composite mapping vào `ChiTietCuocGuiHang`; xác minh điểm/cước/chuyến cùng nhà xe, tuyến phù hợp.
- [ ] Thay đổi trạng thái phiếu gửi ghi một dòng lịch sử trong cùng thao tác ghi cần all-or-nothing.
- [ ] Sức chứa được tính theo nhóm hàng, số lượng, trạng thái giữ chỗ và có xử lý cạnh tranh ở backend.
- [ ] Luồng booking một chiều có hành lý gửi đủ từng món lên backend; map `ILuggageItem.type` rõ ràng sang `LoaiHangHoa`, giữ `category` riêng, backend tính lại cước/capacity rồi tạo phiếu vé + phiếu gửi dưới cùng `DonGiaoDich` và `ChuyenXe`; payment draft/invoice mock không được xem là persistence.
- [ ] Booking khứ hồi có hành lý vẫn ngoài phạm vi cho tới khi được chốt cách gắn shipment vào từng leg/chuyến và transaction; không gắn một shipment duy nhất vào hai chuyến.
- [x] Admin hiển thị điểm gửi/nhận; không yêu cầu hình thức lấy/giao hoặc địa chỉ người nhận đã bị loại khỏi schema.
- [ ] Customer Web tải dữ liệu và phí từ API thay vì dữ liệu/giá hard-code.
- [x] Seed và seed verifier khớp enum/cột mới; integration fixtures liên quan API đã cập nhật.
- [x] Admin Customer Workspace theo hợp đồng điểm gửi/nhận mới.
- [ ] Customer Web tải dữ liệu gửi hàng và phí từ API thật.
- [ ] Kiểm tra lại luồng vé sau các thay đổi tạo chuyến trong CI trên commit mới nhất.

## 7. Cách rà soát và giới hạn

- Đối chiếu `prisma/schema.prisma`, source trong `apps/api`, `apps/admin`, `apps/web`, `prisma/seed.mjs`, `prisma/verify-seed.mjs` và các test/fixture liên quan.
- Trạng thái sau Phase 1–3 trên `fix/admin-shipment-002-impact`: cấu hình Vehicle Type capacity, tạo trip nhận gửi/snapshot và Admin shipment history đã hoàn tất; seed/verifier và schema 002 được giữ nguyên. Chưa có API shipment đầy đủ; Customer Web shipment vẫn là giao diện demo tĩnh và booking hành lý chưa persist shipment. Xem mục 3–6 để biết phần còn lại. Browser smoke Phase 4 không chạy vì không có browser/session sẵn dùng và local Admin/API không phản hồi. CI phải được xác nhận trên commit cuối cùng.
- Database local đã xóa hai bảng archive theo migration cleanup trước đó; tài liệu này không yêu cầu khôi phục hay tạo lại dữ liệu archive.
