# VexGo — Handoff ảnh hưởng UI và backend sau migration shipment 002

> Tài liệu này là bản đồ các phần ứng dụng cần được rà soát/cập nhật sau khi database shipment chuyển sang Class Diagram 002. Bản rà soát ban đầu chưa sửa ứng dụng. Cập nhật ngày 06/10/2026: seed và seed verifier đã được chuyển sang schema 002; API và UI vẫn đang chờ xử lý riêng.

**Ngày rà soát:** 06/10/2026

**Nhánh được rà soát:** `refactor/database-schema-and-class-diagram`

**Diagram đích:** `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`

**Tài liệu migration nền:** `docs/class-diagram/migration_handoff/VEXGO_SHIPMENT_DB_MIGRATION_COMPLETION_HANDOFF.md`

## 1. Kết luận nhanh

Migration đã đưa Prisma/MySQL sang mô hình 002, nhưng các luồng ứng dụng chưa được chuyển theo. Những phần cần ưu tiên:

1. **API lấy lịch sử gửi hàng của khách hàng đang dùng quan hệ và cột cũ.** `CustomersService.listAdminCustomerShipments` còn include `buuCucGui`/`buuCucPhat` và đọc các cột hình thức, địa chỉ đã bị bỏ. Endpoint này cần được sửa trước khi chạy lại luồng hoặc build với Prisma Client mới.
2. **API tạo chuyến chưa ghi ba trường sức chứa bắt buộc mới của `ChuyenXe`.** Form Admin và DTO hiện cũng không có các giá trị đó. Tạo chuyến mới vì vậy chưa tương thích schema 002; cần thống nhất cách lấy snapshot từ sức chứa mặc định của loại xe và giá trị `nhanGuiHang`.
3. **Seed và trình xác minh seed — đã cập nhật source.** Seed hiện tạo điểm, mapping điểm/tuyến, cước theo loại hàng, nhóm sức chứa, chuyến có snapshot sức chứa và phiếu gửi có đủ FK bắt buộc theo schema 002. Verifier đã đổi sang kiểm tra các invariant mới. Cần chạy seed và verifier trên database dev để xác nhận dữ liệu thực tế.
4. **Admin vẫn trình bày khái niệm cũ.** Tab lịch sử hiển thị hình thức lấy/giao, bưu cục và địa chỉ người nhận; schema mới chỉ lưu điểm gửi/nhận, không còn hình thức lấy/giao hoặc địa chỉ giao tận nơi.
5. **Customer Web chưa chạy bằng database.** Trang gửi hàng đang dùng dữ liệu, nhà xe, chuyến, sức chứa và cách tính phí hard-code; không gọi API shipment. Đây là chức năng chưa được nối theo mô hình 002, không phải bằng chứng rằng trang đang query sai database.
6. **Quản lý loại xe hiện còn tạo/cập nhật được nhờ default bằng 0, nhưng chưa cho cấu hình ba loại sức chứa.** Do đó cấu hình hiện tại không đủ để cung cấp sức chứa có ý nghĩa cho chuyến.

## 2. Schema mới mà ứng dụng phải tuân theo

| Khái niệm | Schema sau migration 002 | Cấu trúc cũ không còn dùng |
|---|---|---|
| Điểm gửi/nhận | `DiemGiaoNhanHang`, khóa `diemGiaoNhanHangId`, mã `maDiem`, tên `tenDiem` | Model `BuuCuc`, `buuCucId`, `maBuuCuc`, `tenBuuCuc` |
| Điểm thuộc tuyến | `DiemGiaoNhanTuyenXe`, vai trò `GUI_HANG`, `NHAN_HANG`, `CA_HAI` | Suy ra điểm gửi/nhận chỉ từ `TuyenXe.diemDi/diemDen` |
| Cước gửi | `BangCuocGuiHang` theo `diemGuiId`, `diemNhanId`, `loaiHangHoaId` và khoảng cân nặng/ngày hiệu lực | `buuCucGuiId`, `buuCucPhatId`, `hinhThucLayHang`, `hinhThucGiaoHang` |
| Phiếu gửi | Bắt buộc `chuyenXeId`, `diemGuiId`, `diemNhanId`, `bangCuocApDungId`; người nhận có tên và điện thoại | Có thể chưa gán chuyến/điểm; địa chỉ nhận, địa chỉ lấy và hình thức lấy/giao |
| Trạng thái gửi | `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN`, `DA_GIAO`, `DA_HUY` | `CHO_DIEU_PHOI` và các trạng thái không còn nằm trong enum mới |
| Nhóm loại hàng | `LoaiHangHoa.nhomSucChua`: `XE_MAY`, `HANG_CONG_KENH`, `HANG_NHE` | Loại hàng không có nhóm sức chứa |
| Loại xe | Ba mặc định: `sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, `sucChuaHangNheMacDinh` | Một sức chứa ghế không đại diện sức chứa hàng |
| Chuyến xe | `nhanGuiHang` và ba snapshot bắt buộc `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe` | Chuyến chỉ có thông tin lịch chạy/xe/ghế, không có snapshot sức chứa hàng |
| Lịch sử trạng thái | `LichSuTrangThaiPhieuGuiHang` | Chưa có bảng sự kiện lịch sử tương ứng |

Các model và trường trên được xác nhận trong [`prisma/schema.prisma`](../../../prisma/schema.prisma). Chi tiết backfill và dữ liệu demo nằm trong handoff migration nền ở đầu tài liệu.

## 3. Mức độ ảnh hưởng theo khu vực

### P0 — API lịch sử gửi hàng của khách trong Admin bị lệch schema

**Endpoint:** `GET /api/v1/customers/:id/shipments`

**Luồng:** Customer Workspace → tab Gửi hàng → `getCustomerShipments` → `AdminCustomersController.getShipments` → `CustomersService.listAdminCustomerShipments` → Prisma.

Các vị trí cần cập nhật:

- [`apps/api/src/customers/customers.service.ts`](../../../apps/api/src/customers/customers.service.ts), đoạn `listAdminCustomerShipments` khoảng dòng 575–718:
  - Include quan hệ cũ `buuCucGui` và `buuCucPhat`.
  - Đọc `diaChiNguoiNhan`, `hinhThucLayHang`, `hinhThucGiaoHang`, `diaChiLayHang`.
  - Trả `originBranch`/`destinationBranch` dựa trên ID và mã bưu cục cũ.
- [`apps/api/src/customers/admin-customers.controller.ts`](../../../apps/api/src/customers/admin-customers.controller.ts), route vẫn được gọi từ UI; contract URL/phân trang hiện có thể giữ nếu nhóm muốn tương thích endpoint.
- [`apps/admin/src/features/customers/services/customer-service.ts`](../../../apps/admin/src/features/customers/services/customer-service.ts) gọi endpoint trên.
- [`apps/admin/src/features/customers/types/customer.ts`](../../../apps/admin/src/features/customers/types/customer.ts) khai báo shape cũ của `CustomerShipment`.

Schema 002 không có các quan hệ/cột nêu trên. Khi Prisma Client được sinh từ schema mới, các tham chiếu này cần được thay để qua typecheck; nếu chạy truy vấn với client cũ trên database mới, Prisma/MySQL sẽ không tìm thấy các cột/quan hệ tương ứng.

**Hướng chuyển đổi contract:** đọc `diemGui` và `diemNhan`, trả tên/mã điểm mới; bỏ cách biểu diễn lấy/giao tận nơi. Schema không có địa chỉ người nhận nên không thể tiếp tục lấy `receiver.address` từ `PhieuGuiHang`. Nếu muốn hiển thị địa chỉ điểm, API cần chủ động trả địa chỉ của hai điểm và UI phải ghi nhãn đúng là điểm gửi/điểm nhận.

### P0 — Tạo chuyến xe chưa ghi sức chứa snapshot bắt buộc

**Luồng:** Admin tạo chuyến → `TripsController` → `TripsService.create` → Prisma `ChuyenXe.create`.

- [`apps/api/src/trips/trips.service.ts`](../../../apps/api/src/trips/trips.service.ts), `create` khoảng dòng 626–781, tạo chuyến với mã, lịch, trạng thái, nhà xe, tuyến, xe và các ghế; chưa ghi `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe`.
- Ba cột snapshot ở [`prisma/schema.prisma`](../../../prisma/schema.prisma) là `NOT NULL`, không có default. Vì vậy thao tác tạo chuyến hiện thiếu dữ liệu bắt buộc ở database; Prisma Client mới cũng sẽ báo kiểu dữ liệu create thiếu trường.
- [`apps/api/src/trips/dto/create-trip.dto.ts`](../../../apps/api/src/trips/dto/create-trip.dto.ts) và [`apps/admin/src/features/trips/components/trip-form-dialog.tsx`](../../../apps/admin/src/features/trips/components/trip-form-dialog.tsx) không nhận/nhập sức chứa hàng hoặc lựa chọn nhận gửi hàng.
- `UpdateTripDto`/form hiện chỉ sửa thời gian. Nếu nghiệp vụ cho phép chỉnh sức chứa snapshot sau khi tạo chuyến, đó cũng là contract cần quyết định riêng; schema không tự quy định quyền sửa.

**Cần quyết định khi sửa:** có thể khởi tạo snapshot từ ba giá trị mặc định của `LoaiXe` tại thời điểm tạo chuyến; đồng thời xác định và lưu `nhanGuiHang` (mặc định hiện tại là `false`). Nếu Admin cần tùy chỉnh sức chứa theo chuyến, bổ sung DTO/form/validation phù hợp. API trả chuyến hiện chưa expose những giá trị mới cho client.

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

Trang cần được chuyển sang API thật khi triển khai chức năng gửi hàng: tải điểm, chuyến có `nhanGuiHang`, cước khớp cặp điểm + loại hàng, và sức chứa theo nhóm; tạo phiếu gửi với đủ bốn FK bắt buộc. Backend phải tính/kiểm tra phí và sức chứa. UI cần bỏ địa chỉ lấy/giao tận nơi và biểu diễn lựa chọn điểm gửi/điểm nhận. Đây là phần chức năng chưa hoàn thiện, không phải lỗi truy vấn DB đang chạy của trang hiện tại.

### P1 — Chưa có module nghiệp vụ shipment trong API

Không có module shipment chuyên biệt trong `apps/api/src/`. Các khái niệm shipment hiện diện ở schema và một số luồng đọc/tích hợp trong `CustomersService`/`TripsService`, nhưng chưa có backend API shipment đầy đủ để:

- Tra cứu điểm gửi/nhận được cấu hình trên tuyến (`DiemGiaoNhanTuyenXe`).
- Quản lý/chọn `BangCuocGuiHang` theo điểm, loại hàng, cân nặng và hiệu lực.
- Tạo `PhieuGuiHang` với chuyến, hai điểm, dòng cước và giao dịch bắt buộc.
- Cập nhật trạng thái có ghi `LichSuTrangThaiPhieuGuiHang`.
- Tính sức chứa sử dụng theo nhóm hàng và loại trừ phiếu đã hủy.

Đây là phạm vi backend cần agent triển khai theo module riêng, không nên tiếp tục nhúng toàn bộ truy vấn shipment vào UI hoặc controller khách hàng.

### P1 — Seed và xác minh seed đã khớp schema 002

- [`prisma/seed.mjs`](../../../prisma/seed.mjs): tạo `DiemGiaoNhanHang`, `DiemGiaoNhanTuyenXe`, 126 dòng cước theo 7 loại hàng và 6 khoảng cân nặng; gán nhóm `HANG_NHE`; ghi ba snapshot sức chứa trên mọi chuyến; tạo phiếu gửi với đủ điểm gửi/nhận, cước, chuyến và lịch sử trạng thái. Các mã điểm giữ convention demo `FUTA-BC-001` dạng tương tự.
- [`prisma/verify-seed.mjs`](../../../prisma/verify-seed.mjs): kỳ vọng 15 điểm, 6 mapping điểm/tuyến, 126 dòng cước và 60 bản ghi lịch sử; kiểm tra mã hành chính, nhà xe/tuyến/điểm/cước, trạng thái hiện hành, snapshot sức chứa và tải hàng theo nhóm.

Việc này chỉ cập nhật file seed và verifier; database dev chưa được chạy lại trong lượt cập nhật này. Seed dùng giá cước demo theo cân nặng và không thêm phí dịch vụ tại nhà vì schema 002 chỉ còn luồng gửi/nhận tại các điểm.

### P1 — Test fixture và assertion còn lưu contract cũ

- [`apps/api/test/integration/customers/admin-customers.spec.ts`](../../../apps/api/test/integration/customers/admin-customers.spec.ts): fixture và expectation còn `buuCucGui`, `buuCucPhat`, `buuCucGuiId`, `buuCucPhatId`, `diaChiNguoiNhan`, hình thức lấy/giao và `pickupAddress`.
- [`apps/admin/test/customer-shipments.spec.tsx`](../../../apps/admin/test/customer-shipments.spec.tsx): mock response còn địa chỉ người nhận, hình thức cũ và `originBranch`/`destinationBranch`.
- [`apps/api/test/unit/trips/trips.service.spec.ts`](../../../apps/api/test/unit/trips/trips.service.spec.ts) và [`apps/api/test/integration/trips/trips-write.spec.ts`](../../../apps/api/test/integration/trips/trips-write.spec.ts): shipment fixture còn trạng thái `CHO_DIEU_PHOI`, đã bị loại khỏi enum; trạng thái tương ứng sau migration được chuyển thành `MOI_TAO`.
- Cần bổ sung/điều chỉnh test cho snapshot sức chứa khi tạo chuyến, `nhanGuiHang`, và luồng phân bổ sức chứa; không coi việc chỉ đổi fixture để test pass là đủ nếu business rule chưa được xác định.

## 4. Phần ít hoặc chưa bị tác động trực tiếp

- **Đặt vé và bảng giá vé:** `BangGia`, `PhieuDatVe`, `Ve` không thuộc phần thay đổi shipment này. Tuy nhiên, thao tác lập chuyến dùng chung bị chặn do thiếu ba trường sức chứa mới; cần phân biệt lỗi tạo chuyến với logic chọn/giữ chỗ vé.
- **CRUD tên/mô tả loại xe:** có thể chạy do default sức chứa mới bằng `0`, nhưng chưa đủ cho nghiệp vụ shipment.
- **Trang gửi hàng customer hiện tại:** do đang là giao diện demo tĩnh nên chưa query các cột DB đã đổi; tích hợp API thật mới là bước bị ảnh hưởng trực tiếp bởi contract 002.
- **Hủy chuyến:** `TripsService.cancel` có truy vấn phiếu gửi và chặn chuyến có shipment đang hoạt động. Cần giữ lại hành vi bảo vệ này; kiểm tra lại trạng thái giữ chuyến theo enum 002 và bổ sung xử lý sức chứa khi thiết kế luồng shipment. `DA_GIAO`/`DA_HUY` vẫn là trạng thái hợp lệ trong enum mới.

## 5. Thứ tự đề xuất để agent tiếp tục

1. Sinh Prisma Client từ schema hiện tại và sửa các lỗi tham chiếu cũ trong API; bắt đầu với lịch sử gửi hàng Admin và tạo chuyến.
2. Chốt contract shipment backend: API danh mục điểm/tuyến/cước, tạo vận đơn, chuyển trạng thái và ghi lịch sử; thống nhất DTO/response trước khi nối UI.
3. Bổ sung ba sức chứa mặc định vào API và màn hình quản lý loại xe; tạo chuyến thì snapshot sang ba cột `ChuyenXe` và lưu `nhanGuiHang` theo lựa chọn nghiệp vụ.
4. **Hoàn tất phần seed/verify-seed.** Chạy lại seed và verifier trên database dev khi sẵn sàng kiểm tra dữ liệu demo.
5. Cập nhật Admin Customer Workspace và test của nó theo shape điểm gửi/nhận mới; bỏ trường hình thức/địa chỉ không còn tồn tại.
6. Thay UI gửi hàng tĩnh bằng service/API thật; backend là nguồn xác thực cuối cùng cho cước, điều kiện tuyến và sức chứa.
7. Chạy typecheck/build và test mục tiêu sau khi cập nhật. Những việc này chưa chạy trong lượt lập handoff.

## 6. Checklist khi hoàn tất phần ứng dụng

- [ ] Prisma Client đã được generate từ `prisma/schema.prisma` hiện hành.
- [ ] Typecheck API không còn tham chiếu model/cột shipment cũ.
- [ ] Tạo chuyến ghi ba snapshot sức chứa bắt buộc và giá trị `nhanGuiHang` có chủ đích.
- [ ] API shipment đảm bảo bốn FK bắt buộc và xác minh điểm/cước/chuyến cùng nhà xe, tuyến phù hợp.
- [ ] Thay đổi trạng thái phiếu gửi ghi một dòng lịch sử trong cùng thao tác ghi cần all-or-nothing.
- [ ] Sức chứa được tính theo nhóm hàng, số lượng, trạng thái giữ chỗ và có xử lý cạnh tranh ở backend.
- [ ] Admin hiển thị điểm gửi/nhận, không yêu cầu hình thức lấy/giao hoặc địa chỉ người nhận đã bị loại khỏi schema.
- [ ] Customer Web tải dữ liệu và phí từ API thay vì dữ liệu/giá hard-code.
- [x] Seed và seed verifier khớp enum/cột mới. Integration fixtures và UI mocks vẫn cần rà soát.
- [ ] Kiểm tra luồng vé vẫn hoạt động sau khi sửa tạo chuyến.

## 7. Cách rà soát và giới hạn

- Đối chiếu `prisma/schema.prisma`, source trong `apps/api`, `apps/admin`, `apps/web`, `prisma/seed.mjs`, `prisma/verify-seed.mjs` và các test/fixture liên quan.
- GitNexus xác nhận một số liên kết component/endpoint, nhưng index đang chậm **30 commit** so với HEAD. Vì vậy kết luận trong tài liệu được kiểm chứng bằng source hiện tại và không dùng kết quả graph cũ làm bằng chứng duy nhất.
- Bản rà soát ban đầu không sửa code/database. Cập nhật sau đó chỉ sửa seed và seed verifier, không chạy seed/verifier hoặc test lên database. Các mục P0 là kết luận từ schema/source mismatch; cần xác nhận lần cuối bằng Prisma generate + typecheck khi agent sửa backend.
- Database local đã xóa hai bảng archive theo migration cleanup trước đó; tài liệu này không yêu cầu khôi phục hay tạo lại dữ liệu archive.
