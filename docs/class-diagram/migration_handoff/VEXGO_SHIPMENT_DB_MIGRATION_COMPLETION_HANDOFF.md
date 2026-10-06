# VexGo — Handoff tổng kết migration database gửi hàng

> Tài liệu bàn giao trạng thái **đã triển khai**, dành cho thành viên và agent tiếp tục công việc. Đây là báo cáo kết quả thực tế, không phải yêu cầu tự động chạy lại migration hay chỉnh sửa production.

**Ngày cập nhật:** 07/10/2026

**Nhánh:** `refactor/database-schema-and-class-diagram`

**Database đã áp dụng:** `vexgo` tại `127.0.0.1:3306` (MySQL 8.4.11)

**Class Diagram đích:** `002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`

## 1. Tóm tắt cho người nhận bàn giao

- Database shipment đã được chuyển sang Class Diagram 002, gồm hai phần: tinh gọn mô hình gửi hàng theo điểm giao/nhận và bổ sung sức chứa theo nhóm hàng.
- Migration chính giữ 24 phiếu gửi, 15 điểm giao nhận và tạo 126 dòng cước hoạt động. Các FK bắt buộc của phiếu gửi đã được backfill trước khi đổi sang `NOT NULL`.
- Hai bảng archive từng được tạo tạm thời để giữ dữ liệu cũ trong lúc chuyển đổi đã bị xóa ở migration kế tiếp theo quyết định của chủ dự án. **24 snapshot phiếu và 72 snapshot cước cũ không còn trong database.**
- Prisma schema đã bỏ hai model archive. Kiểm tra introspection sau migration cho thấy 43 model và không có hai bảng archive.
- Sau khi phát hiện CI compile lỗi với Prisma Client mới, branch có thêm hai sửa đổi API tương thích tối thiểu: lịch sử gửi hàng đọc quan hệ `diemGui`/`diemNhan`; tạo chuyến chụp ba mức sức chứa mặc định từ `LoaiXe`. Các UI chưa được sửa và chưa có module API shipment đầy đủ.
- Seed demo đã được chạy thành công trên MySQL cô lập mới sau 20 migrations; verifier cũng đạt các kiểm tra mã, FK, trạng thái, sức chứa và kịch bản demo.

## 2. Nguồn thiết kế và phạm vi

Hai file diagram liên quan:

- `docs/class-diagram/001-20261006_sua_loi_cau_hinh_bang_cuoc_theo_cap_diem_gui_nhan.mdl`: đợt tinh gọn mô hình gửi hàng theo điểm giao/nhận.
- `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`: phiên bản cuối được chọn cho schema, bổ sung sức chứa theo nhóm hàng.

Các quyết định trọng tâm của phiên bản cuối:

1. Dùng `DiemGiaoNhanHang` thay `BuuCuc`; người gửi và người nhận tự giao/nhận tại điểm, bỏ lấy/giao tận nơi.
2. Bảng cước được cấu hình theo cặp điểm gửi → điểm nhận và loại hàng, không còn gắn trực tiếp với tuyến hay hình thức lấy/giao.
3. `PhieuGuiHang` phải tham chiếu chuyến, điểm gửi, điểm nhận và dòng cước áp dụng.
4. Sức chứa mặc định thuộc `LoaiXe`; sức chứa của `ChuyenXe` là snapshot riêng tại thời điểm tạo/chỉnh chuyến.
5. `LoaiHangHoa.nhomSucChua` phân loại hàng vào `XE_MAY`, `HANG_CONG_KENH` hoặc `HANG_NHE`.

## 3. Migration đã chạy

| Migration | Vai trò | Trạng thái |
|---|---|---|
| `20261006210000_migrate_shipment_schema_to_class_diagram_002` | Đổi schema, backfill dữ liệu, tạo quan hệ mới, dọn bảng staging. | Đã chạy thành công sau khi xử lý lỗi collation. |
| `20261006220000_drop_shipment_legacy_archive_tables` | Xóa `LuuTruBangCuocGuiHangCu` và `LuuTruPhieuGuiHangCu`. | Đã chạy thành công; hai bảng không còn trong MySQL. |

Migration đầu từng tạo archive trước khi thay đổi bảng nghiệp vụ. Migration thứ hai là thay đổi có chủ đích sau đó: dữ liệu demo nên không cần lưu snapshot cũ. Không sửa migration lịch sử 002 đã chạy; database mới sẽ replay migration 002 rồi chạy migration cleanup để đạt trạng thái cuối giống schema hiện tại.

Các bảng staging chỉ tồn tại trong lúc chạy migration 002 và đã được drop ở cuối migration:

- `_MigrationShipmentTripMapping`
- `_MigrationShipmentPrimaryCargoMapping`
- `_MigrationShipmentCategoryGroupMapping`
- `_MigrationShipmentPointCodeMapping` (temporary table)

## 4. Schema cuối cùng

### 4.1. Điểm giao nhận

`BuuCuc` được **rename** thành `DiemGiaoNhanHang`, giữ lại ID và dữ liệu điểm thay vì tạo bảng rỗng. Các cột định danh được đổi tên:

- `buuCucId` → `diemGiaoNhanHangId`
- `maBuuCuc` → `maDiem`
- `tenBuuCuc` → `tenDiem`

Thêm `maTinhThanh`, `maPhuongXa`, `viDo`, `kinhDo`. Tọa độ để `NULL` vì dữ liệu demo không có tọa độ đã xác minh. `quanHuyen` được đặt `NULL` theo mô hình địa giới hai cấp; tỉnh/phường và chuỗi địa chỉ được chuẩn hóa theo mã hành chính mới.

Ràng buộc hiện có:

- `maDiem` duy nhất trong phạm vi nhà xe: `(nhaXeId, maDiem)`; các mã cũ theo convention `<MÃ_NHÀ_XE>-BC-###` được giữ nguyên.
- `maTinhThanh` nếu có phải gồm 2 chữ số; `maPhuongXa` nếu có phải gồm 5 chữ số.
- Điểm giao nhận thuộc một nhà xe bằng FK `nhaXeId`.

### 4.2. Điểm giao nhận theo tuyến

Thêm `DiemGiaoNhanTuyenXe`, gồm tuyến, điểm và vai trò `GUI_HANG`, `NHAN_HANG` hoặc `CA_HAI`. Unique `(tuyenXeId, diemGiaoNhanHangId)` ngăn cấu hình trùng. Có **6 dòng** được suy ra từ các phiếu gửi hiện hữu; đây là backfill từ dữ liệu quan sát được, không phải cấu hình đầy đủ mọi tuyến.

### 4.3. Bảng cước

`BangCuocGuiHang` hiện tham chiếu:

- `diemGuiId` → `DiemGiaoNhanHang`
- `diemNhanId` → `DiemGiaoNhanHang`
- `loaiHangHoaId` → `LoaiHangHoa`

Đã bỏ `hinhThucLayHang` và `hinhThucGiaoHang`. Cước cho hai chiều A → B và B → A là các cấu hình độc lập. Database giữ FK, index và trạng thái cước; một số quy tắc liên bảng như hai điểm cùng nhà xe và tuyến có hỗ trợ cặp điểm cần được service xác minh.

### 4.4. Phiếu gửi và lịch sử trạng thái

`PhieuGuiHang` có FK bắt buộc tới chuyến, điểm gửi, điểm nhận, cước áp dụng và đơn giao dịch. Khuyến mãi vẫn optional. Đã bỏ địa chỉ giao tận nơi (`diaChiNguoiNhan`, `diaChiLayHang`) và hai cột hình thức lấy/giao.

Trạng thái `CHO_DIEU_PHOI` được chuyển thành `MOI_TAO`; enum hiện gồm `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN`, `DA_GIAO`, `DA_HUY`. Các snapshot tiền trên phiếu (`cuocChinh`, `phiDichVu`, `soTienGiam`, `tongPhi`) được giữ nguyên.

Thêm `LichSuTrangThaiPhieuGuiHang` với trạng thái, thời điểm, ghi chú, FK phiếu gửi và FK tài khoản nullable. Bảng hiện có **0 dòng** vì schema cũ không lưu lịch sử; migration không tạo sự kiện giả.

`DonGiaoDich` tiếp tục là quan hệ chung cho giao dịch vé/gửi hàng. Không thêm FK trực tiếp giữa `PhieuDatVe` và `PhieuGuiHang`.

### 4.5. Nhóm hàng và sức chứa

- `LoaiHangHoa.nhomSucChua` là enum bắt buộc: `XE_MAY`, `HANG_CONG_KENH`, `HANG_NHE`.
- `LoaiXe` có `sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, `sucChuaHangNheMacDinh`; cả ba mặc định **0** và có CHECK không âm.
- `ChuyenXe` có ba cột snapshot `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe`, NOT NULL và CHECK không âm; có thêm `nhanGuiHang`.
- Migration sao chép sức chứa mặc định từ loại xe của xe được gán cho chuyến. Do schema cũ không có dữ liệu cấu hình năng lực, các giá trị mặc định được backfill là 0. 18 chuyến có phiếu gửi được đánh dấu `nhanGuiHang = true`.

Database không lưu sức chứa còn lại. Service cần tính từ snapshot của chuyến trừ số lượng hàng thuộc nhóm tương ứng trên các phiếu còn hiệu lực, và phải xác định rõ trạng thái nào tiếp tục giữ chỗ; `DA_HUY` không được chiếm sức chứa.

## 5. Mapping dữ liệu demo đã áp dụng

### 5.1. Phiếu gửi sang chuyến

12 phiếu thiếu `chuyenXeId` được backfill. Ưu tiên chuyến xác định từ vé trong cùng giao dịch; trường hợp còn lại dùng tuyến/cặp điểm đã được dữ liệu phiếu khác xác nhận trong cùng ngày và chọn ID chuyến nhỏ nhất để kết quả ổn định.

| `phieuGuiHangId` | `chuyenXeId` | Căn cứ |
|---:|---:|---|
| 1 | 5 | Hai chuyến cùng tuyến/ngày (5, 6), lấy ID nhỏ hơn |
| 2 | 5 | Hai chuyến cùng tuyến/ngày (5, 6), lấy ID nhỏ hơn |
| 5 | 9 | Hai chuyến cùng tuyến/ngày (9, 10), lấy ID nhỏ hơn |
| 8 | 17 | Vé cùng giao dịch |
| 9 | 37 | Hai chuyến cùng tuyến/ngày (37, 38), lấy ID nhỏ hơn |
| 10 | 37 | Hai chuyến cùng tuyến/ngày (37, 38), lấy ID nhỏ hơn |
| 13 | 41 | Hai chuyến cùng tuyến/ngày (41, 42), lấy ID nhỏ hơn |
| 16 | 49 | Vé cùng giao dịch |
| 17 | 69 | Hai chuyến cùng tuyến/ngày (69, 70), lấy ID nhỏ hơn |
| 18 | 69 | Hai chuyến cùng tuyến/ngày (69, 70), lấy ID nhỏ hơn |
| 21 | 73 | Hai chuyến cùng tuyến/ngày (73, 74), lấy ID nhỏ hơn |
| 24 | 81 | Vé cùng giao dịch |

Điểm gửi/nhận nào đang `NULL` được lấy từ hai điểm trong dòng cước cũ mà phiếu đang tham chiếu. Sau backfill, 24/24 phiếu có chuyến, hai điểm và cước hợp lệ; nhà xe của hai điểm khớp với nhà xe chuyến.

### 5.2. Loại hàng chính và cước áp dụng

Một phiếu có thể có nhiều mặt hàng, trong khi dòng cước có một `loaiHangHoaId`. Loại hàng chính được chọn theo tổng khối lượng `SUM(khoiLuong × soLuong)` lớn nhất; nếu hòa, lấy `loaiHangHoaId` nhỏ nhất.

| `loaiHangHoaId` | Phiếu được gán làm loại hàng chính |
|---:|---|
| 1 — BƯU PHẨM | 1, 5, 8, 9, 13, 16, 17, 21, 24 |
| 2 — THỰC PHẨM | 2, 10, 18 |
| 4 — HẢI SẢN | 4, 12, 20 |
| 5 — ĐIỆN TỬ | 6, 14, 22 |
| 6 — QUẦN ÁO | 3, 11, 19 |
| 7 — HÀNG GIA DỤNG | 7, 15, 23 |

Loại 3 — THƯ TÍN — không là loại có tổng khối lượng lớn nhất trên phiếu demo nào. ID dòng cước của từng phiếu được chuyển sang dòng khớp cặp điểm, khoảng cân nặng, thời hạn và loại hàng chính; snapshot tiền trên phiếu không đổi.

### 5.3. Dòng cước

- Giữ 18 dòng cước điểm-đến-điểm cũ: ID `19–24`, `43–48`, `67–72`.
- Nhân 18 dòng nền cho sáu loại hàng còn lại: thêm 108 dòng. Kết quả: **126 dòng**, 18 dòng cho mỗi một trong 7 loại hàng.
- 54 dòng cước lấy/giao tận nơi bị xóa khỏi bảng đang hoạt động.
- 72 dòng cước cũ từng được snapshot trong archive, nhưng archive đã bị xóa bởi migration cleanup theo quyết định rằng đây là dữ liệu demo. Hiện không còn bản lưu các dòng cước đó.

### 5.4. Nhóm sức chứa cho hàng demo

Các kiện demo có kích thước tối đa 30 × 21 × 14 cm và khối lượng tối đa 2 kg/kiện. Vì vậy cả 7 loại hiện được gán `HANG_NHE`. Đây chỉ là mapping cho fixture hiện tại, **không phải quy tắc phân loại chung cho dữ liệu nghiệp vụ thật**. Muốn dùng `XE_MAY` hoặc `HANG_CONG_KENH`, cần cập nhật danh mục/seed theo quy tắc sản phẩm.

### 5.5. Mã hành chính của điểm

15 điểm được giữ nguyên `maDiem`; mã địa giới lưu dưới dạng chuỗi để không mất số 0 đầu và có định dạng 2/5 chữ số:

| Địa chỉ cũ | Địa giới sau sắp xếp | Mã tỉnh | Mã phường/xã |
|---|---|---:|---:|
| TP.HCM, Quận 1, Bến Nghé | TP.HCM, Phường Sài Gòn | `79` | `26740` |
| TP.HCM, Bình Thạnh, Phường 17 | TP.HCM, Phường Gia Định | `79` | `26944` |
| TP.HCM, Quận 3, Phường 6 | TP.HCM, Phường Xuân Hòa | `79` | `27139` |
| Lâm Đồng, Đà Lạt, Phường 2 hoặc 4 | Lâm Đồng, Phường Xuân Hương - Đà Lạt | `68` | `24781` |
| Lâm Đồng, Đà Lạt, Phường 12 | Lâm Đồng, Phường Lâm Viên - Đà Lạt | `68` | `24778` |
| Bà Rịa - Vũng Tàu, Vũng Tàu, Phường 1 hoặc 2 | TP.HCM, Phường Vũng Tàu | `79` | `26506` |

`quanHuyen` để `NULL`; tọa độ không được đoán. Nguồn mã được dùng khi lập mapping: [Quyết định 19/2025/QĐ-TTg và danh mục mã](https://xaydungchinhsach.chinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-cac-don-vi-hanh-chinh-cap-xa-moi-11925070418263625.htm), [phụ lục Quyết định 19](https://congbao.chinhphu.vn/tai-ve-van-ban-so-19-2025-qd-ttg-45430-57441), [Nghị quyết 1685 — TP.HCM](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1685-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-thanh-pho-ho-chi-minh-nam-2025-119250616211341304.htm), [Nghị quyết 1671 — Lâm Đồng](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1671-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-tinh-lam-dong-nam-2025-119250616201715664.htm).

## 6. Lỗi collation và trạng thái lịch sử Prisma

Lần chạy đầu của migration 002 gặp MySQL error `1267 Illegal mix of collations (utf8mb4_unicode_ci, IMPLICIT) and (utf8mb4_0900_ai_ci, IMPLICIT)` tại phép so sánh chuỗi của mapping địa giới. Các điều kiện so sánh được sửa để dùng `COLLATE utf8mb4_0900_ai_ci` tường minh; sau đó migration được đánh dấu rollback và chạy lại thành công.

Kiểm tra trực tiếp `_prisma_migrations` cho thấy có **hai bản ghi cùng tên migration 002**:

1. Lần lỗi: `finished_at = NULL`, `rolled_back_at` có giá trị, `logs` chứa lỗi 1267.
2. Lần chạy lại: `finished_at` có giá trị, `rolled_back_at = NULL`, `logs = NULL`.

Đây là lịch sử recovery bình thường của Prisma. Không xóa bản ghi lỗi bằng tay; khi kiểm tra trạng thái, hãy xem `rolled_back_at` và bản ghi chạy lại thành công thay vì chỉ nhìn thấy cột `logs`.

Migration cleanup chạy sau đó với `finished_at` có giá trị, `rolled_back_at = NULL`; query `information_schema.TABLES` trả về không có hai bảng archive.

## 7. Kiểm chứng đã thực hiện

- `prisma validate --schema prisma/schema.prisma`: hợp lệ.
- `prisma migrate deploy --schema prisma/schema.prisma`: migration 002 và migration cleanup áp dụng thành công trên database dev nêu đầu tài liệu.
- Introspection MySQL sau cleanup: 43 model, 0 model/bảng archive.
- SQL consistency checks sau migration 002: 24 phiếu có đủ chuyến/điểm/cước; không có điểm gửi/nhận sai nhà xe; loại hàng chính khớp dòng cước; mã địa giới đúng định dạng; `maDiem` duy nhất đúng phạm vi.
- Số lượng đối chiếu: 15 điểm giao nhận, 24 phiếu gửi, 126 dòng cước, 7 loại hàng (đều `HANG_NHE`), 6 cấu hình điểm/tuyến, 0 dòng lịch sử giả.
- Trên một MySQL 8.4 cô lập mới: `prisma migrate deploy` áp dụng đủ 20 migrations; `prisma generate`, `prisma db seed` và `node prisma/verify-seed.mjs` chạy thành công. Không dùng database dev tại `127.0.0.1:3306` cho đợt kiểm tra này.
- API: build thành công; toàn bộ test unit/integration hiện hành đạt 80 file / 1.320 test; E2E đạt 1 test; typecheck và lint đều thành công.
- CI của PR cần được kiểm tra lại sau khi push commit sửa lỗi; chỉ kết luận xanh khi GitHub Actions báo thành công.

## 8. Điểm cần agent tiếp theo biết

### Việc chưa làm trong phạm vi database

- `CustomersService.listAdminCustomerShipments` hiện truy vấn `diemGui`/`diemNhan` và ánh xạ vào response hiện hữu để giữ tương thích với Admin. Hai field legacy `pickupMethod`/`deliveryMethod` vẫn có trong response nhưng trả `null`, vì schema 002 không còn khái niệm hình thức lấy/giao. Địa chỉ được lấy từ điểm giao nhận; Admin hiển thị dấu `—` cho hình thức chưa được schema xác định.
- `TripsService.create` hiện ghi ba snapshot sức chứa từ giá trị mặc định của loại xe. Cấu hình sức chứa của loại xe vẫn mặc định 0; DTO/form Admin chưa có lựa chọn `nhanGuiHang` hoặc ba sức chứa theo chuyến, nên đây mới là tương thích schema/CI chứ chưa hoàn thiện nghiệp vụ sức chứa.
- API shipment đầy đủ vẫn chưa có module riêng: còn thiếu API tra cứu điểm/cước, tạo vận đơn, kiểm tra cùng nhà xe/tuyến/loại hàng, tính phí/sức chứa và cập nhật trạng thái kèm lịch sử.
- Admin chỉ được chỉnh type/hiển thị cho hai field hình thức legacy nullable trong tab lịch sử; bố cục và cách trình bày điểm gửi/nhận chưa được làm lại. Customer Web vẫn dùng fixture/hard-code. Không xem các sửa tương thích nhỏ này là hoàn thành luồng full-stack.
- Service phải xác thực hai điểm thuộc cùng nhà xe, cặp điểm được tuyến hỗ trợ, và dòng cước khớp điểm + loại hàng. Cần xác định trạng thái giữ/nhả sức chứa và xử lý concurrency/transaction khi nhận đơn; database hiện không lưu số sức chứa còn lại.
- Các cấu hình sức chứa demo hiện bằng 0 và toàn bộ loại hàng đang ở `HANG_NHE`; dữ liệu này chưa đủ để demo luồng nhận xe máy/hàng cồng kềnh.

### Sai khác lịch sử migration của database local

Trong `prisma migrate status`, database local có bản ghi migration `20261002220000_persistent_seat_holds` nhưng file migration đó không có trong checkout hiện tại. Đây là sai khác lịch sử có trước phần shipment; migration deploy cleanup vẫn chạy thành công. Diff schema cũng từng phát hiện các bảng local `GiuCho` và `GiuChoGhe` không được model trong Prisma schema.

Không tự chạy `migrate reset`, xóa bảng, hoặc `migrate resolve` cho migration này khi chưa đối chiếu nhánh/nguồn migration tương ứng. Cần xác nhận với nhóm xem migration thuộc nhánh khác hay file chưa được mang sang.

## 9. Đường dẫn artifact chính

- Prisma schema: `prisma/schema.prisma`
- Migration chuyển sang diagram 002: `prisma/migrations/20261006210000_migrate_shipment_schema_to_class_diagram_002/migration.sql`
- Migration xóa archive: `prisma/migrations/20261006220000_drop_shipment_legacy_archive_tables/migration.sql`
- Class Diagram cuối: `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`
- Class Diagram giai đoạn trước: `docs/class-diagram/001-20261006_sua_loi_cau_hinh_bang_cuoc_theo_cap_diem_gui_nhan.mdl`

## 10. Cập nhật database local sau khi lấy `develop`

Chạy sau khi PR này đã được merge vào `develop`. Các lệnh chạy từ thư mục gốc repository. Database cần dùng MySQL local đang chạy và các URL trong `.env` phải trỏ đúng database dev của người chạy lệnh.

```bash
git switch develop
git pull --ff-only origin develop
npm ci
npm exec -- prisma migrate deploy
npm exec -- prisma generate
npm exec -- prisma db seed
node prisma/verify-seed.mjs
```

`.env` cần có `DATABASE_URL`, `MIGRATION_URL` và `SHADOW_DATABASE_URL`. `SHADOW_DATABASE_URL` phải trỏ tới database shadow riêng, không được dùng chung database runtime hay database migration. `prisma db seed` chạy `prisma/seed-bootstrap.mjs`, build API trước rồi chạy seed demo; `verify-seed.mjs` là bước kiểm tra tùy chọn sau seed.

> **Lưu ý dữ liệu:** migration `20261006220000_drop_shipment_legacy_archive_tables` xóa vĩnh viễn hai bảng archive cũ. Chỉ chạy trên database dev theo quyết định dữ liệu demo đã được xác nhận; hãy sao lưu hoặc dùng database dev mới nếu cần giữ dữ liệu khác.
