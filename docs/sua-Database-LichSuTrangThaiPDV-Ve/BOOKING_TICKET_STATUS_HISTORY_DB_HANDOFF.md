# VexGo — Handoff DB Foundation Lịch sử trạng thái Phiếu đặt vé & Vé

**Branch:** `feature/booking-ticket-status-history`
**Spec tham chiếu:** `docs/sua-Database-LichSuTrangThaiPDV-Ve/BOOKING_TICKET_STATUS_HISTORY_DB_SPEC.md`
**Class Diagram cập nhật:** `docs/sua-Database-LichSuTrangThaiPDV-Ve/003-20261008040000_booking_ticket_status_history.mdl`

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
- Trạng thái hiện tại của `PhieuDatVe` và `Ve` được giữ nguyên toàn vẹn (không thay đổi trạng thái gốc).
- Kiểm tra dữ liệu thực tế tại thời điểm migration:
  - `PhieuDatVe`: 27 records → 27 baseline history records (27 `maThaoTac` phân biệt).
  - `Ve`: 54 records → 54 baseline history records (54 `maThaoTac` phân biệt).

---

## 4. Semantics của `maThaoTac` và `thoiDiem`

### `maThaoTac` (CHAR(36) NOT NULL)
- Đại diện cho mã định danh của **một lần thao tác nghiệp vụ** (transaction/operation). Với history do application tạo, dùng định dạng UUID v4 chuẩn.
- Đây là yêu cầu cho history runtime; tại thời điểm handoff chưa có history writer trong `apps/api/src`.
- Các integration test tạo history dùng `node:crypto.randomUUID()`, tức UUID v4. `schema.prisma` chỉ khai báo `String @db.Char(36)` và không đặt UUID default, nên schema không quyết định version.
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

---

## 6. Tests và Verifiers đã chạy

### Targeted Vitest Integration Test
- **File:** `apps/api/test/integration/tickets/booking-ticket-status-history-db.spec.ts`
- **Kết quả:** **16/16 tests PASS**
- **Nội dung kiểm tra:**
  1. Count `LichSuTrangThaiPhieuDatVe` == `PhieuDatVe` count (27 == 27).
  2. Count `LichSuTrangThaiVe` == `Ve` count (54 == 54).
  3. Kiểm tra chi tiết baseline PhieuDatVe: `trangThaiCu = null`, `trangThaiMoi = status`, `nguonThayDoi = 'SYSTEM'`, `taiKhoanId = null`, `laOverride = false`, lý do chuẩn, UUID riêng phân biệt.
  4. Kiểm tra chi tiết baseline Ve: các thuộc tính chuẩn và UUID riêng phân biệt.
  5. CHECK constraint reject source khác `CUSTOMER|STAFF|SYSTEM`.
  6. CHECK constraint reject `CUSTOMER`/`STAFF` khi thiếu `taiKhoanId`.
  7. CHECK constraint reject `SYSTEM` khi có `taiKhoanId`.
  8. CHECK constraint reject `CUSTOMER`/`SYSTEM` khi có `laOverride = true`.
  9. CHECK constraint reject `trangThaiCu == trangThaiMoi` (không cho phép transition rỗng).
  10. Cho phép `STAFF` có `laOverride = true` và `taiKhoanId` hợp lệ.
  11. UNIQUE reject duplicate `(maThaoTac, phieuDatVeId)`.
  12. UNIQUE reject duplicate `(maThaoTac, veId)`.
  13. FK Restrict chặn xóa `PhieuDatVe` khi đã có history.
  14. FK Restrict chặn xóa `Ve` khi đã có history.
  15. FK Restrict chặn xóa `TaiKhoan` khi được history tham chiếu.
  16. FK reject insert history với id không tồn tại.

### Standalone Verifier Script
- **File:** `prisma/tests/verify-booking-ticket-status-history.mjs`
- **Lệnh chạy:** `node prisma/tests/verify-booking-ticket-status-history.mjs`
- **Kết quả:** Pass thành công mọi điều kiện kiểm tra dữ liệu hiện có trong database.

### Quality Gates khác
- `npx prisma validate`: Schema hợp lệ.
- `npx prisma migrate status`: Database schema is up to date (23 migrations).
- `npm run typecheck --workspace=@vexgo/api`: TypeScript check pass 100%.

---

## 7. Phạm vi chưa thực hiện (Out of Scope) & Bước tiếp theo

- **Customer cancellation:** Hiện tại code nghiệp vụ hủy vé phía Customer Web/API **CHƯA** ghi history vào hai bảng mới này.
- **Admin Feature 07:** Màn hình quản lý phiếu đặt vé, timeline chi tiết và thao tác của Admin **CHƯA** được triển khai trong branch này.
- **Yêu cầu bắt buộc cho phase tiếp theo (Atomicity):**
  > Khi retrofit logic thay đổi trạng thái tại Customer và Admin (đổi trạng thái phiếu đặt vé / vé), việc **UPDATE trạng thái entity** và **INSERT bản ghi history tương ứng** BẮT BUỘC phải thực hiện trong **CÙNG MỘT DATABASE TRANSACTION** (`prisma.$transaction`).
  > Nếu một thao tác cập nhật cả phiếu đặt vé và nhiều vé, phải dùng chung một `maThaoTac` (UUID) và cùng một `thoiDiem`.
