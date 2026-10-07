# VexGo — Handoff tổng kết migration database gửi hàng

> Tài liệu bàn giao trạng thái **đã triển khai**, dành cho thành viên và agent tiếp tục công việc. Đây là báo cáo kết quả thực tế, không phải yêu cầu tự động chạy lại migration hay chỉnh sửa production.

**Ngày cập nhật:** 07/10/2026

**Nhánh:** `refactor/database-schema-and-class-diagram`

**Database local:** `vexgo` tại `127.0.0.1:3306` là dữ liệu dev/demo. Bản migration corrective cũ đã từng được áp dụng tại đây; mã migration corrective trong branch hiện đã được sửa trước khi merge nên checksum không còn khớp. Dùng database dev mới hoặc reset/reseed database demo trước khi áp dụng bản migration đã sửa.

**Class Diagram đích:** `002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`

## 1. Tóm tắt cho người nhận bàn giao

- Database shipment đã được chuyển sang Class Diagram 002, gồm tinh gọn mô hình gửi hàng theo điểm giao/nhận, sức chứa theo nhóm hàng và cước tính riêng theo từng loại hàng trong một phiếu.
- Migration chính giữ 24 phiếu gửi, 15 điểm giao nhận và tạo 126 dòng cước hoạt động. Các FK bắt buộc của phiếu gửi đã được backfill trước khi đổi sang `NOT NULL`.
- Hai bảng archive từng được tạo tạm thời để giữ dữ liệu cũ trong lúc chuyển đổi đã bị xóa ở migration kế tiếp theo quyết định của chủ dự án. **24 snapshot phiếu và 72 snapshot cước cũ không còn trong database.**
- Prisma schema đã bỏ hai model archive. Kiểm tra introspection sau migration cho thấy 43 model và không có hai bảng archive.
- Branch trước đó có các sửa tương thích API cho schema 002 và cập nhật Admin tab lịch sử; Customer Web vẫn chưa có luồng shipment hoàn chỉnh. Đợt sửa theo finding hiện tại chỉ thay đổi database, seed/verifier, harness, diagram và tài liệu.
- Migration `20261007020000_correct_shipment_capacity_and_validate_invariants` không còn sửa `HangHoa.loaiHangHoaId`. Migration `20261007100000_add_shipment_cargo_type_fees` tạo `ChiTietCuocGuiHang`, backfill cước theo loại hàng, rồi bỏ `PhieuGuiHang.bangCuocApDungId`.
- Regression harness chạy trên database MySQL scratch riêng và bao gồm trường hợp hợp lệ cùng 4 trường hợp phải dừng an toàn. Không dùng database `vexgo` local làm harness target.

## 2. Nguồn thiết kế và phạm vi

Hai file diagram liên quan:

- `docs/class-diagram/001-20261006_sua_loi_cau_hinh_bang_cuoc_theo_cap_diem_gui_nhan.mdl`: đợt tinh gọn mô hình gửi hàng theo điểm giao/nhận.
- `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`: phiên bản cuối được chọn cho schema, bổ sung sức chứa theo nhóm hàng.

Các quyết định trọng tâm của phiên bản cuối:

1. Dùng `DiemGiaoNhanHang` thay `BuuCuc`; người gửi và người nhận tự giao/nhận tại điểm, bỏ lấy/giao tận nơi.
2. Bảng cước được cấu hình theo cặp điểm gửi → điểm nhận và loại hàng, không còn gắn trực tiếp với tuyến hay hình thức lấy/giao.
3. `PhieuGuiHang` tham chiếu chuyến, điểm gửi, điểm nhận và giao dịch; cước của từng loại hàng được lưu trong `ChiTietCuocGuiHang`.
4. Sức chứa mặc định thuộc `LoaiXe`; sức chứa của `ChuyenXe` là snapshot riêng tại thời điểm tạo/chỉnh chuyến.
5. `LoaiHangHoa.nhomSucChua` phân loại hàng vào `XE_MAY`, `HANG_CONG_KENH` hoặc `HANG_NHE`.

## 3. Migration đã chạy

| Migration | Vai trò | Trạng thái |
|---|---|---|
| `20261006210000_migrate_shipment_schema_to_class_diagram_002` | Đổi schema, backfill dữ liệu, tạo quan hệ mới, dọn bảng staging. | Đã chạy thành công sau khi xử lý lỗi collation. |
| `20261006220000_drop_shipment_legacy_archive_tables` | Xóa `LuuTruBangCuocGuiHangCu` và `LuuTruPhieuGuiHangCu`. | Đã chạy thành công; hai bảng không còn trong MySQL. |
| `20261007020000_correct_shipment_capacity_and_validate_invariants` | Forward correction: giữ snapshot capacity đủ tải, kiểm tra giao dịch vé/gửi cùng chuyến; không ép các dòng hàng về cùng một loại. | Migration được chỉnh trong PR chưa merge; bản đã từng áp dụng trên DB local có checksum cũ. |
| `20261007100000_add_shipment_cargo_type_fees` | Preflight cước lịch sử/tổng tiền; tạo `ChiTietCuocGuiHang`; backfill theo `(phiếu, loại hàng)`; bỏ cột cước đơn trên phiếu. | Migration forward mới trong PR; regression harness kiểm tra trên MySQL scratch. |

Migration đầu từng tạo archive trước khi thay đổi bảng nghiệp vụ. Migration thứ hai là thay đổi có chủ đích sau đó: dữ liệu demo nên không cần lưu snapshot cũ. Không sửa migration lịch sử 002 đã chạy; invariant chuyến/sức chứa nằm ở migration forward. Migration corrective chưa merge được cập nhật để xóa bước ghi đè loại hàng; database local đã áp dụng bản cũ cần tạo lại vì checksum thay đổi. Migration #22 là migration forward riêng cho cước từng loại.

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

`PhieuGuiHang` có FK bắt buộc tới chuyến, điểm gửi, điểm nhận và đơn giao dịch. Khuyến mãi vẫn optional. Cột/FK `bangCuocApDungId` được bỏ; cước nằm ở các dòng `ChiTietCuocGuiHang`. Đã bỏ địa chỉ giao tận nơi (`diaChiNguoiNhan`, `diaChiLayHang`) và hai cột hình thức lấy/giao.

Trạng thái `CHO_DIEU_PHOI` được chuyển thành `MOI_TAO`; enum hiện gồm `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN`, `DA_GIAO`, `DA_HUY`. Các snapshot tiền trên phiếu (`cuocChinh`, `phiDichVu`, `soTienGiam`, `tongPhi`) được giữ nguyên.

Thêm `LichSuTrangThaiPhieuGuiHang` với trạng thái, thời điểm, ghi chú, FK phiếu gửi và FK tài khoản nullable. Bảng hiện có **0 dòng** vì schema cũ không lưu lịch sử; migration không tạo sự kiện giả.

`DonGiaoDich` tiếp tục là quan hệ chung cho giao dịch vé/gửi hàng. Không thêm FK trực tiếp giữa `PhieuDatVe` và `PhieuGuiHang`. Nếu cùng giao dịch có cả phiếu vé và phiếu gửi, tất cả vé trong giao dịch và phiếu gửi phải cùng `ChuyenXe`; migration forward và verifier đều kiểm tra invariant này.

### 4.5. Nhóm hàng và sức chứa

- `LoaiHangHoa.nhomSucChua` là enum bắt buộc: `XE_MAY`, `HANG_CONG_KENH`, `HANG_NHE`.
- `LoaiXe` có `sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, `sucChuaHangNheMacDinh`; cả ba mặc định **0** và có CHECK không âm.
- `ChuyenXe` có ba cột snapshot `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe`, NOT NULL và CHECK không âm; có thêm `nhanGuiHang`.
- Default trên `LoaiXe` được backfill là 0 vì schema cũ không lưu cấu hình năng lực. Migration 002 lịch sử backfill snapshot từ default; migration corrective forward giữ snapshot lớn hơn nếu đã cấu hình và nâng snapshot chưa đủ lên tổng số lượng hàng còn hiệu lực theo từng `nhomSucChua`. Như vậy, chuyến cũ hợp lệ ngay sau `migrate deploy`, không lệ thuộc seed. 18 chuyến có phiếu gửi được đánh dấu `nhanGuiHang = true`.

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

Điểm gửi/nhận nào đang `NULL` được lấy từ hai điểm trong dòng cước cũ mà phiếu đang tham chiếu. Sau backfill, 24/24 phiếu có chuyến, hai điểm; migration #22 gắn một snapshot cước cho mỗi loại hàng và kiểm tra nhà xe của hai điểm khớp với nhà xe chuyến.

### 5.2. Loại hàng và cước áp dụng

Một `PhieuGuiHang` được phép có nhiều `HangHoa` thuộc nhiều `LoaiHangHoa`. Migration không cập nhật hoặc ép lại `HangHoa.loaiHangHoaId`.

`ChiTietCuocGuiHang` lưu đúng một dòng cho mỗi `(phieuGuiHangId, loaiHangHoaId)`:

- `khoiLuongTinhCuoc = SUM(HangHoa.khoiLuong * HangHoa.soLuong)` của đúng phiếu và loại hàng.
- Tìm đúng một `BangCuocGuiHang` theo cặp điểm, loại hàng, ngày gửi và khoảng cân nặng inclusive; nếu không có hoặc có nhiều dòng cước cùng match thì migration dừng ở preflight.
- `soTienCuoc` là snapshot mức cước đã chọn. Sau khi xác nhận, thay đổi `BangCuocGuiHang` về sau không tính lại snapshot này.
- `BangCuocGuiHang` có unique `(bangCuocGuiHangId, loaiHangHoaId)` để làm đích composite FK. `ChiTietCuocGuiHang` tham chiếu cặp cột đó; unique `(phieuGuiHangId, loaiHangHoaId)` chặn hai dòng cước cho cùng loại trên một phiếu.
- `PhieuGuiHang.cuocChinh = SUM(ChiTietCuocGuiHang.soTienCuoc)`.

Khi tạo phiếu mới, rate phải `HOAT_DONG` và ngày gửi nằm trong `tuNgay..denNgay`. Khi backfill lịch sử, rate được chấp nhận nếu trạng thái là `HOAT_DONG` hoặc `HET_HIEU_LUC` và ngày gửi nằm trong khoảng hiệu lực; trạng thái hiện tại không được dùng để loại nhầm một rate lịch sử đúng.

Hai đầu khoảng cân nặng đều inclusive. Vì vậy `0–5kg` và `5–10kg` overlap tại `5kg`; cấu hình có thể làm một trọng lượng match nhiều rate phải bị preflight/verifier từ chối. Migration chỉ ghi snapshot chi tiết khi tổng cước mới bằng `PhieuGuiHang.cuocChinh` cũ và công thức `tongPhi` còn khớp. Nó không cập nhật `DonGiaoDich.tongTien`, `HoaDon.tongTien` hay `ThanhToan`; mismatch bị từ chối thay vì điều chỉnh/fabricate lịch sử tài chính.

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

- `npm exec -- prisma validate --schema prisma/schema.prisma`: hợp lệ; `npm run build --workspace=@vexgo/api`: thành công và tạo Prisma Client cho schema mới.
- Regression harness `node prisma/tests/shipment-migration-upgrade.mjs` chạy trên MySQL 8.4 scratch, kiểm tra 5 ca: backfill mixed cargo hợp lệ (kể cả rate lịch sử `HET_HIEU_LUC` đúng ngày), lệch chuyến trong transaction, thiếu rate, overlap inclusive tại biên, và cước mới không khớp snapshot tài chính.
- Ca hợp lệ xác minh hai loại hàng được giữ nguyên, có hai dòng cước riêng với khối lượng/tiền đúng, snapshot capacity được backfill, cột cước đơn bị drop, và `DonGiaoDich`, `HoaDon`, `ThanhToan` giữ nguyên tổng cũ.
- Các ca preflight lỗi xác minh migration thất bại trước khi tạo bảng chi tiết/drop cột và không thay đổi loại hàng, snapshot tiền, lịch sử giao dịch hoặc capacity.
- Seed tạo fixture có nhiều loại hàng trong cùng phiếu, nhóm hàng cùng loại bằng `SUM(khoiLuong * soLuong)`, chọn đúng một rate mỗi nhóm, và dừng nếu có dải cước inclusive chồng lấn. `verify-seed.mjs` kiểm tra mỗi nhóm có đúng một detail, composite type/rate đúng, tổng `cuocChinh` và các snapshot tiền/cân nặng khớp.
- Full-flow scratch MySQL đã áp dụng đủ 22 migrations, chạy `prisma generate`, seed 45 giao dịch / 24 phiếu gửi / 42 món hàng / 36 snapshot cước, và `node prisma/verify-seed.mjs` kết thúc với `Seed verification passed.`
- Harness và full-flow chỉ tạo/xóa các database scratch mang tên riêng; không dùng database dev `vexgo` tại `127.0.0.1:3306` làm target kiểm thử.
- GitHub Actions cần chạy bước harness mới sau khi push. Chỉ kết luận CI xanh khi các check của PR hoàn thành thành công.

## 8. Điểm cần agent tiếp theo biết

### Việc chưa làm trong phạm vi database

- `CustomersService.listAdminCustomerShipments` hiện truy vấn `diemGui`/`diemNhan` và ánh xạ điểm vào response chuyển tiếp. `receiver.address` trả `null` để không nhầm địa chỉ điểm nhận với địa chỉ nhà; địa chỉ điểm được expose riêng trên `originBranch.address`/`destinationBranch.address` và Admin hiển thị dưới tên điểm. Hai field legacy `pickupMethod`/`deliveryMethod` trả `null` vì schema 002 không còn khái niệm hình thức lấy/giao; formatter trạng thái Admin đã map `MOI_TAO` và `DA_TIEP_NHAN`.
- `TripsService.create` hiện ghi ba snapshot sức chứa từ default `LoaiXe` cho chuyến mới. Cấu hình sức chứa của loại xe vẫn mặc định 0; DTO/form Admin chưa có lựa chọn `nhanGuiHang` hoặc ba sức chứa theo chuyến, nên đây mới là tương thích schema/CI chứ chưa hoàn thiện nghiệp vụ sức chứa. Snapshot các chuyến cũ sau migration được backfill đủ với tải hàng đang hiệu lực.
- API shipment đầy đủ vẫn chưa có module riêng: còn thiếu API tra cứu điểm/cước, tạo vận đơn, kiểm tra cùng nhà xe/tuyến/loại hàng, tính phí/sức chứa và cập nhật trạng thái kèm lịch sử.
- Admin tab lịch sử đã chỉnh type/hiển thị cho hai field hình thức legacy nullable, map nhãn trạng thái 002 và hiển thị địa chỉ riêng của điểm gửi/nhận. Bố cục tab và contract tổng thể chưa được làm lại; Customer Web vẫn dùng fixture/hard-code. Không xem các sửa tương thích nhỏ này là hoàn thành luồng full-stack.
- Service tạo shipment tương lai phải nhóm hàng theo `LoaiHangHoa`, tính `SUM(khoiLuong * soLuong)` riêng từng nhóm, tìm đúng một rate active/effective duy nhất, ghi snapshot `ChiTietCuocGuiHang` và đặt `cuocChinh` bằng tổng detail trong cùng transaction. Nếu nhiều rate match thì trả lỗi/preflight; không tự chọn một dòng. Cần giữ snapshot đã xác nhận bất biến trước thay đổi rate. Service cũng phải xác thực hai điểm cùng nhà xe, cặp điểm được tuyến hỗ trợ, vé/phiếu gửi trong một giao dịch cùng chuyến, và trạng thái giữ/nhả sức chứa; database hiện không lưu số sức chứa còn lại.
- Các cấu hình sức chứa demo hiện bằng 0 và toàn bộ loại hàng đang ở `HANG_NHE`; dữ liệu này chưa đủ để demo luồng nhận xe máy/hàng cồng kềnh.

### Sai khác lịch sử migration của database local

Trong `prisma migrate status`, database local từng có bản ghi migration `20261002220000_persistent_seat_holds` nhưng file migration đó không có trong checkout hiện tại. Đây là sai khác lịch sử có trước phần shipment; schema local cũng từng có các bảng `GiuCho` và `GiuChoGhe` không được model trong Prisma schema.

Ngoài ra, database demo local đã từng áp dụng bản cũ của migration `20261007020000_correct_shipment_capacity_and_validate_invariants`. Vì file đó được sửa trong PR để ngừng ghi đè loại hàng, checksum hiện tại khác với bản local đã áp dụng. Dùng database dev mới hoặc reset/reseed dữ liệu demo trước khi kiểm tra migration mới; không dùng `migrate resolve` để bỏ qua checksum/preflight. Không chạy reset trên database có dữ liệu cần giữ.

## 9. Đường dẫn artifact chính

- Prisma schema: `prisma/schema.prisma`
- Migration chuyển sang diagram 002: `prisma/migrations/20261006210000_migrate_shipment_schema_to_class_diagram_002/migration.sql`
- Migration xóa archive: `prisma/migrations/20261006220000_drop_shipment_legacy_archive_tables/migration.sql`
- Migration sửa invariant chuyến/sức chứa: `prisma/migrations/20261007020000_correct_shipment_capacity_and_validate_invariants/migration.sql`
- Migration tạo snapshot cước từng loại: `prisma/migrations/20261007100000_add_shipment_cargo_type_fees/migration.sql`
- Harness nâng cấp schema: `prisma/tests/shipment-migration-upgrade.mjs`
- Seed demo: `prisma/seed.mjs`
- Seed verifier: `prisma/verify-seed.mjs`
- Class Diagram cuối: `docs/class-diagram/002-20261006202600_add_shipment_capacity_and_capacity_group.mdl`
- Class Diagram giai đoạn trước: `docs/class-diagram/001-20261006_sua_loi_cau_hinh_bang_cuoc_theo_cap_diem_gui_nhan.mdl`

## 10. Cập nhật database local sau khi lấy `develop`

Chạy sau khi PR này đã được merge vào `develop`. Các lệnh chạy từ thư mục gốc repository. `DATABASE_URL`, `MIGRATION_URL` và `SHADOW_DATABASE_URL` trong `.env` phải trỏ đúng các database dev của người chạy lệnh; shadow database phải riêng biệt.

#### Nếu database đã có dữ liệu shipment từ seed cũ

Không chạy thẳng `migrate deploy` trên database dev/demo cũ mà chưa kiểm tra dữ liệu cước. Migration `20261007100000_add_shipment_cargo_type_fees` cố ý dừng tại `_ShipmentCargoFeePreflight_financial_check` nếu tổng rate lịch sử theo từng loại hàng không khớp `PhieuGuiHang.cuocChinh`/`tongPhi`. Trường hợp này đã xảy ra trên database demo local: có 15 phiếu lệch do dữ liệu fixture được seed ở phiên bản rate cũ. Đây là guard bảo vệ snapshot tài chính; không bỏ guard hoặc đánh dấu migration là đã áp dụng để đi tiếp.

Với database demo có thể tạo lại, hãy dùng một database dev mới/rỗng rồi chạy quy trình bên dưới. Nếu cần giữ dữ liệu đang có, dừng tại preflight và đối chiếu/mapping các khoản cước trước khi retry; không áp dụng hướng dẫn reset database lên dữ liệu cần giữ. Với lỗi preflight ở query 7 của migration này, chưa có bảng `ChiTietCuocGuiHang` hay DDL bền vững nào được tạo.

Với database mới hoặc database dev/demo đã được tạo lại rỗng:

```bash
git switch develop
git pull --ff-only origin develop
npm ci
npm run build --workspace=@vexgo/api
npm exec -- prisma migrate deploy
npm exec -- prisma generate
npm exec -- prisma db seed
node prisma/verify-seed.mjs
```

Lệnh build API tạo Prisma Client để bootstrap seed có thể chạy. Sau đó `migrate deploy` áp dụng toàn bộ 22 migrations; `generate`, `db seed` và verifier chạy trên schema cuối. Seed hiện dừng nếu có dải cước inclusive chồng lấn hoặc không tìm được duy nhất một rate phù hợp cho nhóm hàng.

> **Lưu ý dữ liệu:** migration `20261006220000_drop_shipment_legacy_archive_tables` xóa vĩnh viễn hai bảng archive cũ. Chỉ chạy trên database dev theo quyết định dữ liệu demo đã được xác nhận; hãy sao lưu hoặc dùng database dev mới nếu cần giữ dữ liệu khác. Nếu preflight báo giao dịch ghép khác chuyến, không resolve migration là applied; sửa/reseed dữ liệu demo rồi chạy lại `migrate deploy`.
