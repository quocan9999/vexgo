# VexGo — Handoff ảnh hưởng UI và backend sau migration shipment 002

> Tài liệu này là bản đồ các phần ứng dụng cần được rà soát/cập nhật sau khi database shipment chuyển sang Class Diagram 002. Cập nhật ngày 07/10/2026: seed/verifier, API history và một số hiển thị tương thích trong Admin đã được cập nhật; các luồng shipment đầy đủ ở Admin/Customer vẫn chưa được triển khai.

**Ngày rà soát:** 07/10/2026

**Nhánh được rà soát:** `refactor/database-schema-and-class-diagram`

**Diagram đích:** `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`

**Tài liệu migration nền:** `docs/class-diagram/migration_handoff/VEXGO_SHIPMENT_DB_MIGRATION_COMPLETION_HANDOFF.md`

## 1. Kết luận nhanh

Migration đã đưa Prisma/MySQL sang mô hình 002. Branch đã thêm sửa tương thích API tối thiểu để build và test với Prisma Client mới; các chức năng UI và API shipment đầy đủ vẫn cần triển khai. Những phần cần ưu tiên:

1. **API lịch sử gửi hàng theo schema 002.** `CustomersService.listAdminCustomerShipments` truy vấn `diemGui`/`diemNhan`, giữ response shape chuyển tiếp; `receiver.address` trả `null`, còn địa chỉ điểm nằm riêng trên `originBranch.address`/`destinationBranch.address`. Hai field legacy `pickupMethod`/`deliveryMethod` trả `null`; Admin hiển thị `—`, tên + địa chỉ điểm và nhãn trạng thái 002.
2. **Tạo chuyến đã ghi ba snapshot sức chứa.** `TripsService.create` lấy mặc định từ `LoaiXe`. DTO và Form Admin chưa có cấu hình sức chứa hoặc lựa chọn `nhanGuiHang`; cờ này hiện theo default database `false`. Đây là tương thích schema, chưa phải cấu hình nghiệp vụ hoàn chỉnh.
3. **Seed và verifier theo các invariant đã chốt.** Một phiếu demo có thể chứa nhiều `LoaiHangHoa`; seed nhóm `HangHoa` theo loại, tính `SUM(khoiLuong * soLuong)`, chọn đúng một rate và ghi một `ChiTietCuocGuiHang` cho mỗi loại. `cuocChinh` bằng tổng các dòng cước. Nếu `DonGiaoDich` có cả phiếu vé và phiếu gửi, vé và phiếu gửi dùng cùng `ChuyenXe`. Migration forward kiểm tra dữ liệu hiện hữu và backfill snapshot đủ tải hoạt động.
4. **Admin UI mới chỉ có chỉnh tương thích nhỏ.** Type cho phép hai field hình thức legacy là `null`; tab map `MOI_TAO`/`DA_TIEP_NHAN` và hiển thị địa chỉ điểm dưới tên điểm gửi/nhận, không hiển thị địa chỉ điểm dưới người nhận. Tab vẫn giữ cột `Lấy / Giao` chuyển tiếp và response shape cũ; đợt UI sau nên bỏ hẳn khái niệm pickup/delivery khỏi màn hình.
5. **Customer Web chưa chạy bằng database.** Trang gửi hàng vẫn dùng dữ liệu, nhà xe, chuyến, sức chứa và cách tính phí hard-code; không gọi API shipment. Đây là chức năng chưa được nối theo mô hình 002, không phải bằng chứng rằng trang đang query sai database.
6. **Quản lý loại xe chưa cho cấu hình ba loại sức chứa.** Giá trị mặc định hiện là 0, nên snapshot chuyến lấy từ đó cũng có thể bằng 0; cần thêm API và form khi triển khai phần quản lý năng lực.

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

### API — Truy vấn lịch sử gửi hàng đã tương thích schema; Admin vẫn cần cập nhật cách hiển thị

**Endpoint:** `GET /api/v1/customers/:id/shipments`

**Luồng:** Customer Workspace → tab Gửi hàng → `getCustomerShipments` → `AdminCustomersController.getShipments` → `CustomersService.listAdminCustomerShipments` → Prisma.

Thay đổi đã có trong branch:

- [`apps/api/src/customers/customers.service.ts`](../../../apps/api/src/customers/customers.service.ts): include `diemGui`/`diemNhan`; ánh xạ mã, tên, địa chỉ và ID điểm vào response shape hiện tại.
- API giữ `pickupMethod` và `deliveryMethod` để tương thích response nhưng trả `null`; schema mới không lưu hình thức lấy/giao. API trả `receiver.address = null`, địa chỉ điểm nằm trong summary riêng; Admin hiển thị `—` cho method và địa chỉ trong cột điểm gửi/nhận.
- [`apps/api/src/customers/admin-customers.controller.ts`](../../../apps/api/src/customers/admin-customers.controller.ts), route vẫn được gọi từ UI; contract URL/phân trang hiện có thể giữ nếu nhóm muốn tương thích endpoint.
- [`apps/admin/src/features/customers/services/customer-service.ts`](../../../apps/admin/src/features/customers/services/customer-service.ts) gọi endpoint trên.
- [`apps/admin/src/features/customers/types/customer.ts`](../../../apps/admin/src/features/customers/types/customer.ts) giữ các field method legacy nullable và thêm địa chỉ cho summary điểm gửi/nhận.

Schema 002 không có quan hệ/cột bưu cục và địa chỉ nhận tận nhà cũ. API không gán địa chỉ điểm vào `receiver.address`; địa chỉ được expose ở summary riêng của điểm. Admin hiện hiển thị cặp tên và địa chỉ điểm, nhưng vẫn cần bỏ cột hình thức lấy/giao legacy trong đợt UI tiếp theo.

### API — Tạo chuyến đã snapshot sức chứa; cấu hình nghiệp vụ ở UI còn thiếu

**Luồng:** Admin tạo chuyến → `TripsController` → `TripsService.create` → Prisma `ChuyenXe.create`.

- [`apps/api/src/trips/trips.service.ts`](../../../apps/api/src/trips/trips.service.ts): `create` đọc ba giá trị mặc định từ `LoaiXe` và ghi `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe` vào snapshot chuyến.
- Các cột snapshot ở [`prisma/schema.prisma`](../../../prisma/schema.prisma) là `NOT NULL`; API đã truyền đủ dữ liệu khi tạo chuyến.
- [`apps/api/src/trips/dto/create-trip.dto.ts`](../../../apps/api/src/trips/dto/create-trip.dto.ts) và [`apps/admin/src/features/trips/components/trip-form-dialog.tsx`](../../../apps/admin/src/features/trips/components/trip-form-dialog.tsx) chưa nhận/nhập sức chứa hàng hoặc lựa chọn nhận gửi hàng.
- `UpdateTripDto`/form hiện chỉ sửa thời gian. Nếu nghiệp vụ cho phép chỉnh sức chứa snapshot sau khi tạo chuyến, đó cũng là contract cần quyết định riêng; schema không tự quy định quyền sửa.

**Còn cần làm:** cấu hình ba mặc định trong CRUD loại xe; quyết định API/UI có cho bật `nhanGuiHang` và tùy chỉnh snapshot theo chuyến không; sau đó expose các giá trị cần thiết cho client. Hiện snapshot khởi tạo theo `LoaiXe`, còn `nhanGuiHang` theo default database (`false`).

### P1 — Admin quản lý loại xe chưa cấu hình sức chứa hàng

Các file liên quan:

- [`apps/api/src/vehicle-types/vehicle-types.service.ts`](../../../apps/api/src/vehicle-types/vehicle-types.service.ts): `VEHICLE_TYPE_SELECT`, `mapVehicleType`, create và update chỉ xử lý tên/mô tả.
- [`apps/api/src/vehicle-types/dto/vehicle-type-write-fields.dto.ts`](../../../apps/api/src/vehicle-types/dto/vehicle-type-write-fields.dto.ts): DTO không nhận ba sức chứa mặc định.
- [`apps/admin/src/features/vehicle-types/types/vehicle-type.ts`](../../../apps/admin/src/features/vehicle-types/types/vehicle-type.ts) và [`apps/admin/src/features/vehicle-types/components/vehicle-type-form-dialog.tsx`](../../../apps/admin/src/features/vehicle-types/components/vehicle-type-form-dialog.tsx): type/form chỉ có tên, mô tả và nhà xe.

CRUD tên/mô tả có thể tiếp tục do ba cột mới của `LoaiXe` có default `0`; nhưng Admin không thể cấu hình năng lực cho xe. Hiện tại giá trị `0` khiến snapshot chuyến cũng không có sức chứa hữu dụng nếu backend lấy đúng giá trị mặc định này. Bổ sung API và form để quản lý ba nhóm hàng trước khi demo luồng nhận hàng theo sức chứa.

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

### P1 — Seed và xác minh seed đã khớp schema 002

- [`prisma/seed.mjs`](../../../prisma/seed.mjs): tạo `DiemGiaoNhanHang`, `DiemGiaoNhanTuyenXe`, 126 dòng cước theo 7 loại hàng và 6 khoảng cân nặng; gán nhóm `HANG_NHE`; ghi ba snapshot sức chứa trên mọi chuyến; tạo phiếu gửi với đủ điểm gửi/nhận, nhiều loại hàng, detail cước từng loại và lịch sử trạng thái. Giao dịch ghép vé/gửi dùng cùng chuyến. Seed dọn các dòng hàng demo cũ không còn thuộc fixture mới. Các mã điểm giữ convention demo `FUTA-BC-001` dạng tương tự.
- [`prisma/verify-seed.mjs`](../../../prisma/verify-seed.mjs): kỳ vọng 15 điểm, 6 mapping điểm/tuyến, 126 dòng cước và 60 bản ghi lịch sử; kiểm tra mã hành chính, nhà xe/tuyến/điểm/cước, trạng thái hiện hành, snapshot sức chứa, tải hàng theo nhóm, đúng một detail mỗi loại, composite type/rate, tổng `cuocChinh` và giao dịch vé/gửi cùng chuyến. `soTienCuoc` là snapshot: verifier không so nó với `mucCuoc` hiện tại của rate.

Đã chạy `prisma db seed` và `node prisma/verify-seed.mjs` trên MySQL 8.4 cô lập mới sau khi áp dụng đủ 22 migrations. Seed tạo đủ dữ liệu demo và verifier đạt toàn bộ kiểm tra. `findOrCreate` tra cứu điểm và mapping bằng điều kiện field thường; verifier so sánh trạng thái history bằng `BINARY` để không phụ thuộc collation của hai bảng. Regression harness còn sửa một rate sau khi backfill và xác nhận `ChiTietCuocGuiHang.soTienCuoc` cùng lịch sử tài chính không đổi. Database dev của thành viên không bị dùng trong kiểm tra này. Seed dùng giá cước demo theo cân nặng và không thêm phí lấy/giao tận nơi vì schema 002 chỉ còn luồng giao/nhận tại điểm.

### Test contract hiện hành và khoảng trống nghiệp vụ cần bổ sung sau

- [`apps/api/test/integration/customers/admin-customers.spec.ts`](../../../apps/api/test/integration/customers/admin-customers.spec.ts): fixture và expectation đã chuyển sang `diemGui`/`diemNhan`, địa chỉ điểm và hai field hình thức lấy/giao nullable.
- [`apps/admin/test/customer-shipments.spec.tsx`](../../../apps/admin/test/customer-shipments.spec.tsx): mock response dùng method/address người nhận nullable, địa chỉ điểm riêng; có assertion cho nhãn/tone `MOI_TAO` và `DA_TIEP_NHAN`.
- [`apps/api/test/unit/trips/trips.service.spec.ts`](../../../apps/api/test/unit/trips/trips.service.spec.ts): xác minh truy vấn mặc định từ loại xe và ghi ba giá trị snapshot vào chuyến.
- Các fixture trực tiếp tạo chuyến trong integration tests đã bổ sung ba cột bắt buộc; fixture loại xe cũng có ba giá trị mặc định.
- Chưa có test/feature nghiệp vụ cho việc bật `nhanGuiHang`, điều chỉnh snapshot theo chuyến hoặc cấp phát sức chứa đồng thời; cần xác định rule trước khi mở rộng API/UI.

## 4. Phần ít hoặc chưa bị tác động trực tiếp

- **Đặt vé và bảng giá vé:** `BangGia`, `PhieuDatVe`, `Ve` không thuộc phần thay đổi shipment này. Tạo chuyến backend hiện ghi snapshot từ loại xe nên đã qua yêu cầu schema; cần tiếp tục giữ các kiểm tra hiện có cho luồng chọn/giữ chỗ vé.
- **CRUD tên/mô tả loại xe:** có thể chạy do default sức chứa mới bằng `0`, nhưng chưa đủ cho nghiệp vụ shipment.
- **Trang gửi hàng customer hiện tại:** do đang là giao diện demo tĩnh nên chưa query các cột DB đã đổi; tích hợp API thật mới là bước bị ảnh hưởng trực tiếp bởi contract 002.
- **Hủy chuyến:** `TripsService.cancel` có truy vấn phiếu gửi và chặn chuyến có shipment đang hoạt động. Cần giữ lại hành vi bảo vệ này; kiểm tra lại trạng thái giữ chuyến theo enum 002 và bổ sung xử lý sức chứa khi thiết kế luồng shipment. `DA_GIAO`/`DA_HUY` vẫn là trạng thái hợp lệ trong enum mới.

## 5. Thứ tự đề xuất để agent tiếp tục

1. Chốt contract shipment backend: API danh mục điểm/tuyến/cước, tạo vận đơn, chuyển trạng thái và ghi lịch sử; thống nhất DTO/response trước khi nối UI.
2. Bổ sung ba sức chứa mặc định vào API và màn hình quản lý loại xe; quyết định cách chọn `nhanGuiHang` và cho phép thay đổi snapshot theo chuyến hay không.
3. Hoàn thiện Admin Customer Workspace: tab history đã hiển thị tên/địa chỉ hai điểm và map trạng thái; đợt sau bỏ cột `Lấy / Giao` legacy, làm rõ các nhãn/response còn lại theo contract điểm.
4. Thay UI gửi hàng tĩnh bằng service/API thật; backend là nguồn xác thực cuối cùng cho cước, điều kiện tuyến và sức chứa.
5. Xác định rule giữ/nhả sức chứa và concurrency trước khi triển khai thao tác tạo/cập nhật phiếu gửi.
6. Seed/verifier đã chạy thành công trên DB cô lập. Khi kiểm tra DB cá nhân, dùng các lệnh trong handoff migration và xác nhận URL `.env` trước khi seed.
7. Build, lint, typecheck, API tests và E2E đã chạy thành công trên branch; chạy lại CI trên commit sau cùng trước khi merge.

## 6. Checklist khi hoàn tất phần ứng dụng

- [ ] Prisma Client đã được generate từ `prisma/schema.prisma` hiện hành.
- [x] Typecheck API không còn tham chiếu các model/cột shipment cũ trong các luồng ảnh hưởng CI đã sửa.
- [x] Tạo chuyến ghi ba snapshot sức chứa mặc định.
- [ ] Xác định và expose giá trị `nhanGuiHang` qua API/UI.
- [ ] API shipment đảm bảo bốn FK trực tiếp bắt buộc (`chuyenXeId`, hai điểm, `donGiaoDichId`), tính phí theo từng loại và ghi composite mapping vào `ChiTietCuocGuiHang`; xác minh điểm/cước/chuyến cùng nhà xe, tuyến phù hợp.
- [ ] Thay đổi trạng thái phiếu gửi ghi một dòng lịch sử trong cùng thao tác ghi cần all-or-nothing.
- [ ] Sức chứa được tính theo nhóm hàng, số lượng, trạng thái giữ chỗ và có xử lý cạnh tranh ở backend.
- [ ] Admin hiển thị điểm gửi/nhận, không yêu cầu hình thức lấy/giao hoặc địa chỉ người nhận đã bị loại khỏi schema.
- [ ] Customer Web tải dữ liệu và phí từ API thay vì dữ liệu/giá hard-code.
- [x] Seed và seed verifier khớp enum/cột mới; integration fixtures liên quan API đã cập nhật.
- [ ] Cập nhật UI Admin và Customer theo hợp đồng điểm gửi/nhận mới.
- [ ] Kiểm tra lại luồng vé sau các thay đổi tạo chuyến trong CI trên commit mới nhất.

## 7. Cách rà soát và giới hạn

- Đối chiếu `prisma/schema.prisma`, source trong `apps/api`, `apps/admin`, `apps/web`, `prisma/seed.mjs`, `prisma/verify-seed.mjs` và các test/fixture liên quan.
- GitNexus xác nhận một số liên kết component/endpoint, nhưng index đang chậm **30 commit** so với HEAD. Vì vậy kết luận trong tài liệu được kiểm chứng bằng source hiện tại và không dùng kết quả graph cũ làm bằng chứng duy nhất.
- Bản rà soát ban đầu không sửa code/database. Cập nhật ngày 07/10 đã sửa API tương thích tối thiểu, fixtures, seed và seed verifier; migration, Admin UI và Customer UI không bị sửa trong lượt CI này. Migrate, seed và verifier được xác nhận trên MySQL cô lập mới; full API suite, E2E, build, lint và typecheck cũng đạt.
- Database local đã xóa hai bảng archive theo migration cleanup trước đó; tài liệu này không yêu cầu khôi phục hay tạo lại dữ liệu archive.
