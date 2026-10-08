# VexGo — Handoff DB Foundation Lịch sử trạng thái Phiếu đặt vé & Vé

**Branch:** `feature/booking-ticket-status-history`
**Spec tham chiếu:** `docs/sua-Database-LichSuTrangThaiPDV-Ve/BOOKING_TICKET_STATUS_HISTORY_DB_SPEC.md`
**Class Diagram cập nhật:** `docs/class-diagram/003-20261008040000_booking_ticket_status_history.mdl`

---

## 1. Migration đã thêm

Forward migration mới được bổ sung:
- **Tên migration:** `20261008040000_add_booking_and_ticket_status_histories`
- **Đường dẫn:** `prisma/migrations/20261008040000_add_booking_and_ticket_status_histories/migration.sql`

Migration thực hiện các bước sau:
1. `CREATE TABLE LichSuTrangThaiPhieuDatVe` và `CREATE TABLE LichSuTrangThaiVe` với `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci` đồng bộ với các bảng gốc.
2. Thiết lập Foreign Keys với `ON DELETE RESTRICT ON UPDATE RESTRICT`.
3. Thiết lập Unique Constraints:
   - `UNIQUE(maThaoTac, phieuDatVeId)` trên `LichSuTrangThaiPhieuDatVe`.
   - `UNIQUE(maThaoTac, veId)` trên `LichSuTrangThaiVe`.
4. Thiết lập 4 CHECK constraints cho mỗi bảng (`chk_*_nguonThayDoi`, `chk_*_taiKhoan_theo_nguon`, `chk_*_laOverride_staff_only`, `chk_*_trangThai_hopLe`).
5. Backfill chính xác 1 baseline history cho mỗi record hiện có của `PhieuDatVe` và `Ve`.
6. Khởi tạo bảng tạm thời `_BookingTicketStatusHistoryBackfillCheck` kiểm tra số lượng và tính hợp lệ của baseline record (postflight invariant check), sau đó drop bảng tạm.

---

## 2. Schema cuối cùng

### Model `LichSuTrangThaiPhieuDatVe`
```prisma
model LichSuTrangThaiPhieuDatVe {
  lichSuTrangThaiPhieuDatVeId Int        @id @default(autoincrement()) @db.Int
  phieuDatVeId                Int        @db.Int
  trangThaiCu                 String?    @db.VarChar(30)
  trangThaiMoi                String     @db.VarChar(30)
  thoiDiem                    DateTime   @db.DateTime(0)
  nguonThayDoi                String     @db.VarChar(20)
  taiKhoanId                  Int?       @db.Int
  lyDo                        String     @db.VarChar(255)
  laOverride                  Boolean    @default(false)
  maThaoTac                   String     @db.Char(36)
  phieuDatVe                  PhieuDatVe @relation(fields: [phieuDatVeId], references: [phieuDatVeId], onDelete: Restrict, onUpdate: Restrict)
  taiKhoan                    TaiKhoan?  @relation(fields: [taiKhoanId], references: [taiKhoanId], onDelete: Restrict, onUpdate: Restrict)

  @@unique([maThaoTac, phieuDatVeId], map: "LichSuTrangThaiPhieuDatVe_maThaoTac_phieuDatVeId_key")
}
```

### Model `LichSuTrangThaiVe`
```prisma
model LichSuTrangThaiVe {
  lichSuTrangThaiVeId Int       @id @default(autoincrement()) @db.Int
  veId                Int       @db.Int
  trangThaiCu         String?   @db.VarChar(30)
  trangThaiMoi        String    @db.VarChar(30)
  thoiDiem            DateTime  @db.DateTime(0)
  nguonThayDoi        String    @db.VarChar(20)
  taiKhoanId          Int?      @db.Int
  lyDo                String    @db.VarChar(255)
  laOverride          Boolean   @default(false)
  maThaoTac           String    @db.Char(36)
  ve                  Ve        @relation(fields: [veId], references: [veId], onDelete: Restrict, onUpdate: Restrict)
  taiKhoan            TaiKhoan? @relation(fields: [taiKhoanId], references: [taiKhoanId], onDelete: Restrict, onUpdate: Restrict)

  @@unique([maThaoTac, veId], map: "LichSuTrangThaiVe_maThaoTac_veId_key")
}
```

### Các quan hệ liên quan cập nhật trong `prisma/schema.prisma`
- `PhieuDatVe.lichSuTrangThais`: `LichSuTrangThaiPhieuDatVe[]`
- `Ve.lichSuTrangThais`: `LichSuTrangThaiVe[]`
- `TaiKhoan.lichSuTrangThaiPhieuDatVes`: `LichSuTrangThaiPhieuDatVe[]`
- `TaiKhoan.lichSuTrangThaiVes`: `LichSuTrangThaiVe[]`

> **Lưu ý kiểu dữ liệu:** Trạng thái (`trangThaiCu`, `trangThaiMoi`) và `nguonThayDoi` tiếp tục dùng `String`, **KHÔNG** chuyển sang Prisma enum ở phase này nhằm hạn chế blast radius. Toàn bộ tính hợp lệ được bảo vệ bởi CHECK constraints ở mức Database.

---

## 3. Backfill Behavior

Sau khi tạo bảng, migration thực hiện backfill tự động cho toàn bộ dữ liệu hiện có:
- Mỗi record `PhieuDatVe` có đúng 1 baseline record trong `LichSuTrangThaiPhieuDatVe`:
  - `trangThaiCu = NULL`
  - `trangThaiMoi = PhieuDatVe.trangThai`
  - `thoiDiem = CURRENT_TIMESTAMP(0)` (thời điểm chạy migration, không suy diễn từ `createdAt`)
  - `nguonThayDoi = 'SYSTEM'`
  - `taiKhoanId = NULL`
  - `lyDo = 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có'`
  - `laOverride = FALSE`
  - `maThaoTac = UUID()` (MySQL `UUID()` sinh UUID version 1; mỗi baseline record có một UUID 36 ký tự riêng)
- Mỗi record `Ve` có đúng 1 baseline record trong `LichSuTrangThaiVe` với quy tắc tương tự.
- Đây là cohort có mặt đúng tại thời điểm migration chạy. Entity tạo mới về sau có thể có nhiều history transition; tổng history sau migration không phải invariant bằng tổng entity.
- Trạng thái hiện tại của `PhieuDatVe` và `Ve` được giữ nguyên toàn vẹn (không thay đổi trạng thái gốc).
- Kiểm tra dữ liệu thực tế tại thời điểm migration:
  - `PhieuDatVe`: 27 records → 27 baseline history records (27 `maThaoTac` phân biệt).
  - `Ve`: 54 records → 54 baseline history records (54 `maThaoTac` phân biệt).

---

## 4. Semantics của `maThaoTac` và `thoiDiem`

### `maThaoTac` (CHAR(36) NOT NULL)
- Đại diện cho mã định danh của **một lần thao tác nghiệp vụ** (transaction/operation). Quyết định cuối cùng là dùng UUID version 1 cho cả migration và history runtime.
- Migration gọi MySQL `UUID()` cho từng baseline record; integration test cũng gọi `SELECT UUID()` để tạo UUID version 1.
- Đây là yêu cầu cho history runtime; tại thời điểm handoff chưa có history writer trong `apps/api/src`. `schema.prisma` chỉ khai báo `String @db.Char(36)` và không đặt UUID default, nên service về sau phải tự truyền UUID version 1.
- Khi một hành động nghiệp vụ làm thay đổi trạng thái của cả 1 `PhieuDatVe` và nhiều `Ve` (ví dụ hủy đặt vé bao gồm 3 vé), tất cả các bản ghi history sinh ra trong thao tác đó **phải dùng chung một `maThaoTac`**.
- `maThaoTac` không phải là Foreign Key, không có bảng `ThaoTac` riêng.
- Ràng buộc duy nhất theo từng entity:
  - `UNIQUE(maThaoTac, phieuDatVeId)`
  - `UNIQUE(maThaoTac, veId)`
  Ngăn ngừa việc một entity bị ghi history hai lần trong cùng một thao tác nghiệp vụ/retry.

### `thoiDiem` (DATETIME(0) NOT NULL)
- Thời điểm chính xác trạng thái được ghi nhận thay đổi trong nghiệp vụ.
- Tất cả các bản ghi history trong cùng một thao tác (`maThaoTac`) **phải dùng cùng một giá trị `thoiDiem`**.
- Không dùng `createdAt` / `updatedAt` vì history là append-only audit data.

---

## 5. Ràng buộc toàn vẹn (Constraints)

1. **CHECK `chk_*_nguonThayDoi`:**
   ```sql
   CHECK (`nguonThayDoi` IN ('CUSTOMER', 'STAFF', 'SYSTEM'))
   ```
2. **CHECK `chk_*_taiKhoan_theo_nguon`:**
   ```sql
   CHECK (
     (`nguonThayDoi` IN ('CUSTOMER', 'STAFF') AND `taiKhoanId` IS NOT NULL)
     OR
     (`nguonThayDoi` = 'SYSTEM' AND `taiKhoanId` IS NULL)
   )
   ```
3. **CHECK `chk_*_laOverride_staff_only`:**
   ```sql
   CHECK (`laOverride` = FALSE OR `nguonThayDoi` = 'STAFF')
   ```
4. **CHECK `chk_*_trangThai_hopLe`:**
   ```sql
   CHECK (`trangThaiCu` IS NULL OR `trangThaiCu` <> `trangThaiMoi`)
   ```
5. **Foreign Keys (Restrict):**
   - `phieuDatVeId` REFERENCES `PhieuDatVe(phieuDatVeId)` ON DELETE RESTRICT ON UPDATE RESTRICT
   - `veId` REFERENCES `Ve(veId)` ON DELETE RESTRICT ON UPDATE RESTRICT
   - `taiKhoanId` REFERENCES `TaiKhoan(taiKhoanId)` ON DELETE RESTRICT ON UPDATE RESTRICT
   -> Đảm bảo không thể xóa các thực thể gốc khi đang được lịch sử audit tham chiếu.

### Ràng buộc Database không thể hiện trên Class Diagram

Class Diagram chính thức giữ mức field và kiểu logic như các class khác. Theo quyết định thiết kế, không thêm CHECK, UNIQUE, DEFAULT hay độ dài kiểu cột vào file `.mdl`.

Hai bảng history có tổng cộng 8 CHECK constraints (4 mỗi bảng):

1. `nguonThayDoi` chỉ nhận `CUSTOMER`, `STAFF` hoặc `SYSTEM`.
2. `CUSTOMER`/`STAFF` bắt buộc có `taiKhoanId`; `SYSTEM` bắt buộc `taiKhoanId IS NULL`.
3. `laOverride = true` chỉ hợp lệ khi `nguonThayDoi = 'STAFF'`.
4. `trangThaiCu` phải NULL hoặc khác `trangThaiMoi`.

CHECK constraints không được khai báo trong `prisma/schema.prisma` vì Prisma chưa hỗ trợ biểu diễn trực tiếp các biểu thức này. Chúng được khai báo thủ công trong forward migration SQL, nên cần đối chiếu migration khi kiểm tra tính toàn vẹn DB.

Các ràng buộc DB khác:

- UNIQUE(maThaoTac, phieuDatVeId) trên `LichSuTrangThaiPhieuDatVe`.
- UNIQUE(maThaoTac, veId) trên `LichSuTrangThaiVe`.
- `laOverride` có DEFAULT `false`.
- `trangThaiCu` / `trangThaiMoi`: VARCHAR(30); `nguonThayDoi`: VARCHAR(20); `lyDo`: VARCHAR(255); `maThaoTac`: CHAR(36); `thoiDiem`: DATETIME(0).
- Tất cả FK dùng ON DELETE RESTRICT và ON UPDATE RESTRICT.

---

## 6. Tests và Verifiers đã chạy

### Targeted Vitest Integration Test
- **File:** `apps/api/test/integration/tickets/booking-ticket-status-history-db.spec.ts`
- **Kết quả:** **16/16 tests PASS**
- Chỉ kết nối qua `BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL`, bắt buộc schema chuyên biệt có hậu tố `_test`, mặc định chặn host từ xa và từ chối trùng host/port/schema với `DATABASE_URL`, `MIGRATION_URL` hoặc `SHADOW_DATABASE_URL`.
- Mỗi test tạo fixture riêng có các ID do test tạo, chạy trong transaction và chỉ cleanup fixture đó; không tìm/xóa/cập nhật entity nghiệp vụ có sẵn.
- Kiểm tra cả hai bảng: 4 CHECK constraint tương ứng (assert mã lỗi adapter `P2039` và tên CHECK cụ thể), giá trị hợp lệ/không hợp lệ, nhiều history trên một entity, chia sẻ `maThaoTac` giữa entity khác nhau, UNIQUE cặp operation/entity, FK reject ID không tồn tại và FK Restrict khi xóa entity/account đang được fixture history tham chiếu.
- UUID test lấy từ MySQL `SELECT UUID()` và xác nhận version 1.

### Standalone Verifier Script
- **File:** `prisma/tests/verify-booking-ticket-status-history.mjs`
- **Kết quả:** chạy thành công trên schema test cô lập sau khi integration tests cleanup; schema lúc verifier chạy có 0 Phiếu đặt vé, 0 Vé và 0 history. Kết quả này chỉ xác nhận verifier kết nối/đánh giá dataset rỗng thành công, không phải kiểm toán dữ liệu ứng dụng.
- Verifier kiểm tra UUID v1, source/account, override, transition và unique theo từng entity; không so tổng history với tổng entity, không yêu cầu một entity chỉ có một history, và chỉ báo số record có hình dạng baseline để tham khảo.

### Migration verification trên MySQL test cô lập
- **Database rỗng:** `prisma migrate deploy` áp dụng thành công toàn bộ 23 migration, gồm migration lịch sử trạng thái.
- **Database có cohort trước migration:** áp dụng 22 migration trước trên schema tạm; chèn fixture tối thiểu gồm 2 `PhieuDatVe` và 3 `Ve`, chụp ID/status trước migration; sau đó áp migration lịch sử. Việc seed fixture tối thiểu tắt `FOREIGN_KEY_CHECKS` riêng trên connection seed và bật lại trước khi chạy migration; đây không phải dữ liệu nghiệp vụ và schema được drop sau kiểm tra.
- Kết quả cohort: mỗi entity trong cohort có đúng một baseline; `trangThaiMoi` giữ nguyên status đã chụp, `trangThaiCu = NULL`, nguồn `SYSTEM`, account `NULL`, override `false`, đúng lý do backfill; 5 `maThaoTac` là UUID v1 và phân biệt; tất cả baseline dùng cùng một timestamp.
- CHECK, UNIQUE và FK Restrict đã được thực thi qua targeted integration tests trên schema đầy đủ đã migrate, với fixture quan hệ hợp lệ. Schema cohort và thư mục migration tạm đều đã được dọn.

### Quality Gates khác
- `npm exec -- prisma validate`: PASS.
- `npm exec -- prisma generate`: PASS; Prisma Client 7.10.0 được sinh vào `apps/api/src/generated/prisma`.
- `npm run typecheck --workspace=@vexgo/api`: PASS.
- `npm run build --workspace=@vexgo/api`: PASS.
- `git diff --check`: PASS (exit 0; chỉ có cảnh báo Git chuẩn hóa LF/CRLF trên Windows).

---

## 7. Phạm vi chưa thực hiện (Out of Scope) & Bước tiếp theo

- **Customer cancellation:** Hiện tại code nghiệp vụ hủy vé phía Customer Web/API **CHƯA** ghi history vào hai bảng mới này.
- **Admin Feature 07:** Màn hình quản lý phiếu đặt vé, timeline chi tiết và thao tác của Admin **CHƯA** được triển khai trong branch này.
- **Yêu cầu bắt buộc cho phase tiếp theo (Atomicity):**
  > Khi retrofit logic thay đổi trạng thái tại Customer và Admin (đổi trạng thái phiếu đặt vé / vé), việc **UPDATE trạng thái entity** và **INSERT bản ghi history tương ứng** BẮT BUỘC phải thực hiện trong **CÙNG MỘT DATABASE TRANSACTION** (`prisma.$transaction`).
  > Nếu một thao tác cập nhật cả phiếu đặt vé và nhiều vé, phải dùng chung một `maThaoTac` (UUID) và cùng một `thoiDiem`.
