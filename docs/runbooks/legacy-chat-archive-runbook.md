# Runbook: Quản lý, Tra cứu và Phục hồi Dữ liệu Lưu trữ Tin nhắn Hỗ trợ Cũ (`LuuTruTinNhanHoTroCu`)

> **Phiên bản:** 1.0.0  
> **Áp dụng từ:** Migration `20261013150000_add_chat_support_conversations_and_messages`  
> **Chính sách kiến trúc:** Option A (Archive-Only & Strict Tenant Isolation)  
> **Phạm vi bảo vệ:** Dữ liệu lịch sử bảng `TinNhanHoTro` trước nâng cấp Chat Realtime theo Nhà xe

---

## 1. Mục đích và Quyết định Kiến trúc

### 1.1. Bối cảnh
Trước đợt nâng cấp hệ thống Chat Hỗ trợ Trực tuyến Đa người thuê (Multi-tenant Realtime Support Chat), bảng `TinNhanHoTro` được thiết kế phục vụ hỗ trợ khách hàng nền tảng chung với cấu trúc:
`(tinNhanId, noiDung, thoiGian, trangThai, khachHangId, createdAt, updatedAt)`.

Bảng này **hoàn toàn không có cột `nhaXeId`** và không liên kết trực tiếp với nhà xe, chuyến xe hay vé xe cụ thể. Khi chuyển đổi sang mô hình `CuocTroChuyen` bắt buộc `nhaXeId NOT NULL`, việc gán tùy tiện tin nhắn của khách hàng vào một nhà xe (dù là `MIN(nhaXeId)`, nhà xe mặc định `1`, hay suy đoán dựa trên lịch sử đặt vé) là **vi phạm nghiêm trọng nguyên tắc Tenant Isolation và chính sách bảo mật thông tin khách hàng**.

### 1.2. Chính sách Option A (Archive-Only)
Theo đề xuất định hướng Option A (Archive-Only) trong PR #37 nhằm bảo vệ toàn vẹn dữ liệu và phân tách tenant:
1. **Lưu trữ bảo toàn 100%:** Toàn bộ tin nhắn cũ được sao chép nguyên vẹn vào bảng `LuuTruTinNhanHoTroCu` trước khi thay đổi cấu trúc bảng nguồn.
2. **Không suy đoán Tenant:** Tuyệt đối không tạo cuộc trò chuyện giả hoặc gán nhà xe không có căn cứ xác thực.
3. **Làm sạch bảng hoạt động:** Các bản ghi cũ chưa xác định được cuộc trò chuyện/tenant sẽ được loại bỏ khỏi bảng hoạt động `TinNhanHoTro` để đảm bảo tính toàn vẹn dữ liệu và tuân thủ ràng buộc `NOT NULL` của schema mới.
4. **Phân định quyền sở hữu:** Bảng archive là kho dữ liệu quản trị cấp hệ thống (System Forensic Archive), phục vụ kiểm toán, điều tra khiếu nại và tra cứu có kiểm soát của DBA/Quản trị viên kỹ thuật; **không phân bổ quyền sở hữu cho bất kỳ nhà xe cụ thể nào**.

---

## 2. Cấu trúc Schema & Đặc tả Dữ liệu

Bảng `LuuTruTinNhanHoTroCu` được định nghĩa đồng bộ trong cả Prisma schema ([`prisma/schema.prisma`](../../prisma/schema.prisma)) và SQL Migration:

```prisma
model LuuTruTinNhanHoTroCu {
  tinNhanId     Int      @id @db.Int
  noiDung       String   @db.Text
  thoiGianCu    DateTime @db.DateTime(0)
  trangThaiCu   String   @db.VarChar(30)
  khachHangIdCu Int      @db.Int
  createdAtCu   DateTime @db.DateTime(0)
  updatedAtCu   DateTime @db.DateTime(0)
  archivedAt    DateTime @default(now()) @db.DateTime(0)
}
```

### Ý nghĩa các trường:
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `tinNhanId` | `Int` (PK) | Khóa định danh duy nhất của tin nhắn cũ nguyên bản. |
| `noiDung` | `Text` | Toàn văn nội dung tin nhắn, bảo toàn trọn vẹn từng ký tự. |
| `thoiGianCu` | `DateTime(0)` | Mốc thời gian gửi ban đầu được khách hàng/client ghi nhận. |
| `trangThaiCu` | `VarChar(30)` | Trạng thái tin nhắn tại thời điểm lưu trữ (`DA_GUI`, `DA_DOC`, v.v.). |
| `khachHangIdCu` | `Int` | Mã khách hàng gửi tin nhắn (tham chiếu logic tới `KhachHang`). |
| `createdAtCu` | `DateTime(0)` | Thời điểm bản ghi được tạo trong database cũ. |
| `updatedAtCu` | `DateTime(0)` | Thời điểm cập nhật cuối cùng trong database cũ. |
| `archivedAt` | `DateTime(0)` | Thời điểm migration thực hiện lưu trữ vào bảng archive. |

---

## 3. Chính sách Phân quyền và Bảo mật Truy cập

> [!CAUTION]
> **RÀNG BUỘC BẢO MẬT BẮT BUỘC:**  
> - Bảng `LuuTruTinNhanHoTroCu` **TUYỆT ĐỐI KHÔNG** được expose ra các REST API công khai, WebSocket Gateway, hoặc các giao diện chat của Customer Web và Admin Web.  
> - Các quyền hạn nhà xe thông thường (`chat:read`, `chat:manage`) **KHÔNG** cấp quyền xem dữ liệu bảng archive.  
> - Chỉ có vai trò **Super Admin / Quản trị viên hệ thống VexGo** và **DBA** mới có thẩm quyền truy cập dữ liệu này.

---

## 4. Hướng dẫn Tra cứu Dữ liệu có Kiểm soát

Khi có yêu cầu tra cứu từ bộ phận Chăm sóc khách hàng hoặc giải quyết khiếu nại pháp lý, người vận hành kỹ thuật thực hiện theo các phương thức sau:

### 4.1. Tra cứu thông qua Prisma Client (Backend Service nội bộ)
```typescript
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// 1. Tra cứu theo mã tin nhắn cụ thể
async function findLegacyMessageById(tinNhanId: number) {
  return await prisma.luuTruTinNhanHoTroCu.findUnique({
    where: { tinNhanId },
  });
}

// 2. Tra cứu toàn bộ lịch sử tin nhắn của một khách hàng
async function listLegacyMessagesByCustomer(khachHangIdCu: number) {
  return await prisma.luuTruTinNhanHoTroCu.findMany({
    where: { khachHangIdCu },
    orderBy: { thoiGianCu: 'asc' },
  });
}
```

### 4.2. Tra cứu trực tiếp bằng SQL (DBA Query)
```sql
-- Tra cứu tin nhắn của khách hàng theo số điện thoại hoặc mã khách hàng
SELECT arc.*
FROM `LuuTruTinNhanHoTroCu` arc
JOIN `KhachHang` kh ON kh.`khachHangId` = arc.`khachHangIdCu`
JOIN `TaiKhoan` tk ON tk.`taiKhoanId` = kh.`taiKhoanId`
WHERE tk.`soDienThoai` = '0901234567' OR kh.`maKhachHang` = 'KH0001'
ORDER BY arc.`thoiGianCu` ASC;
```

---

## 5. Quy trình Kiểm tra Tính Toàn vẹn (Integrity Verification)

Để xác minh dữ liệu trong `LuuTruTinNhanHoTroCu` phản ánh đúng và đủ dữ liệu gốc trước migration:

```sql
-- 1. Kiểm tra số lượng bản ghi đã được lưu trữ
SELECT COUNT(*) AS totalArchivedMessages FROM `LuuTruTinNhanHoTroCu`;

-- 2. Kiểm tra tính hợp lệ của timestamp và không có trường bắt buộc bị NULL
SELECT COUNT(*) AS invalidRows
FROM `LuuTruTinNhanHoTroCu`
WHERE `tinNhanId` IS NULL
   OR `noiDung` IS NULL
   OR `thoiGianCu` IS NULL
   OR `khachHangIdCu` IS NULL;
-- Kết quả kỳ vọng: 0 rows
```

---

## 6. Quy trình Phục hồi Dữ liệu An toàn & Chống Trộn Khách Hàng (Safe Restoration Procedure)

> [!WARNING]
> **ĐIỀU KIỆN TIÊN QUYẾT TRƯỚC KHI KHÔI PHỤC:**  
> Tuyệt đối **KHÔNG ĐƯỢC PHÉP** tự động nạp ngược hàng loạt dữ liệu archive vào bảng `TinNhanHoTro` đang hoạt động.  
> Việc phục hồi một phiên chat lịch sử chỉ được thực hiện khi thỏa mãn **TẤT CẢ** các điều kiện sau:  
> 1. Có văn bản/yêu cầu chính thức từ khách hàng yêu cầu tiếp tục phiên hỗ trợ cũ.  
> 2. Đã xác định **chính xác 100% nhà xe (`nhaXeId`)** chịu trách nhiệm xử lý (có bằng chứng giao dịch vé xe / gửi hàng tương ứng).  
> 3. Đã tạo một `CuocTroChuyen` hợp lệ thuộc nhà xe đó trước khi đưa tin nhắn vào.  
> 4. **RÀNG BUỘC CÁCH LY KHÁCH HÀNG (Cross-Customer Protection):** Bắt buộc phải xác minh tất cả tin nhắn khôi phục thuộc cùng một `khachHangId` duy nhất. **Tuyệt đối không được trộn tin nhắn của khách hàng này vào cuộc trò chuyện của khách hàng khác.**

### Kịch bản phục hồi thủ công nguyên tử (Atomic Safe Recovery Script):

Quy trình sử dụng Database Transaction kết hợp với 3 lớp kiểm tra (Guards) fail-closed. Nếu có bất kỳ ID nào không tồn tại hoặc thuộc về khách hàng khác, giao dịch sẽ **hủy bỏ toàn bộ (ROLLBACK)**, không để lại cuộc trò chuyện rỗng hay dữ liệu phục hồi dở dang:

```sql
START TRANSACTION;

-- 1. Thiết lập tham số kiểm soát
SET @targetKhachHangId = 123;  -- Khách hàng được chỉ định nhận phiên phục hồi
SET @targetNhaXeId = 5;       -- Nhà xe chịu trách nhiệm xử lý
SET @expectedCount = 3;        -- Số lượng tin nhắn cần phục hồi trong danh sách (101, 102, 103)

-- 2. Guard 1: Xác thực số lượng tin nhắn hợp lệ thuộc DUY NHẤT khách hàng đích @targetKhachHangId
-- Nếu có bất kỳ tin nhắn nào thuộc khách hàng khác, @verifiedCount sẽ nhỏ hơn @expectedCount
SET @verifiedCount = (
    SELECT COUNT(*)
    FROM `LuuTruTinNhanHoTroCu` arc
    WHERE arc.`tinNhanId` IN (101, 102, 103)
      AND arc.`khachHangIdCu` = @targetKhachHangId
);

-- Kích hoạt abort nếu phát hiện sai lệch (ID không tồn tại hoặc thuộc khách hàng khác)
SET @cross_customer_guard = (
    SELECT 1
    FROM (SELECT 1 UNION ALL SELECT 2) `_cross_customer_guard_abort`
    WHERE @verifiedCount <> @expectedCount
);

-- 3. Tạo cuộc trò chuyện mới cho đúng khách hàng đích và nhà xe đã xác thực
INSERT INTO `CuocTroChuyen` (
    `maCuocTroChuyen`, `tieuDe`, `trangThai`, `kenhHoTro`, `cheDoChat`,
    `khachHangId`, `nhaXeId`, `createdAt`, `updatedAt`
) VALUES (
    CONCAT('RECOVERED-KH', @targetKhachHangId, '-NX', @targetNhaXeId, '-', UNIX_TIMESTAMP()),
    'Phục hồi hỗ trợ khách hàng',
    'CHO_TIEP_NHAN',
    'WEB',
    'NGUOI_THAT',
    @targetKhachHangId,
    @targetNhaXeId,
    CURRENT_TIMESTAMP(0),
    CURRENT_TIMESTAMP(0)
);
SET @newCuocTroChuyenId = LAST_INSERT_ID();

-- 4. Nạp tin nhắn từ archive: RÀNG BUỘC KÉP arc.khachHangIdCu = ctc.khachHangId
-- Đảm bảo 100% ở cấp truy vấn rằng chỉ có tin nhắn của khách hàng sở hữu hội thoại mới được nạp
INSERT INTO `TinNhanHoTro` (
    `cuocTroChuyenId`, `taiKhoanGuiId`, `loaiNguoiGui`, `loaiTinNhan`,
    `noiDung`, `trangThai`, `createdAt`, `updatedAt`
)
SELECT
    ctc.`cuocTroChuyenId`,
    kh.`taiKhoanId`,
    'KHACH_HANG',
    'VAN_BAN',
    arc.`noiDung`,
    arc.`trangThaiCu`,
    arc.`thoiGianCu`,
    arc.`updatedAtCu`
FROM `LuuTruTinNhanHoTroCu` arc
JOIN `CuocTroChuyen` ctc ON ctc.`cuocTroChuyenId` = @newCuocTroChuyenId
JOIN `KhachHang` kh ON kh.`khachHangId` = arc.`khachHangIdCu`
WHERE arc.`tinNhanId` IN (101, 102, 103)
  AND arc.`khachHangIdCu` = ctc.`khachHangId`;

-- 5. Guard 2: Kiểm tra số lượng dòng thực tế đã ghi vào TinNhanHoTro phải khớp chính xác @expectedCount
SET @insertedCount = ROW_COUNT();
SET @row_count_guard = (
    SELECT 1
    FROM (SELECT 1 UNION ALL SELECT 2) `_row_count_guard_abort`
    WHERE @insertedCount <> @expectedCount
);

-- 6. Hoàn tất giao dịch khi mọi điều kiện an toàn đều thỏa mãn
COMMIT;
```

> [!CAUTION]
> **QUY TẮC BẮT BUỘC KHI PHỤC HỒI THẤT BẠI:**  
> Nếu bất kỳ câu lệnh nào trong khối transaction gặp lỗi (ví dụ `Subquery returns more than 1 row` do Guard kích hoạt), DBA **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP TIẾP TỤC THAO TÁC THỦ CÔNG**. Hệ thống sẽ tự động ROLLBACK toàn bộ transaction, hủy bỏ `CuocTroChuyen` vừa tạo và không ghi nhận bất kỳ tin nhắn nào vào `TinNhanHoTro`. Người vận hành phải kiểm tra lại danh sách ID tin nhắn và báo cáo sự cố an toàn dữ liệu.


---

## 7. Xử lý Sự cố Migration & Giới hạn Implicit Commit của MySQL

### 7.1. Đặc tính Implicit Commit trong MySQL DDL
MySQL tự động kích hoạt **implicit commit** sau mỗi câu lệnh DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`). Vì vậy, nếu một migration script bị lỗi ở giữa chừng (ví dụ sau bước `ALTER TABLE`), MySQL **không thể rollback tự động** các câu lệnh DDL đã thực thi trước đó.

### 7.2. Chiến lược Bảo vệ Preflight
Để triệt tiêu nguy cơ mất mát dữ liệu do implicit commit:
1. **Kiểm tra xung đột trước (Preflight Conflict Detection):** Bước kiểm tra xung đột dữ liệu giữa `TinNhanHoTro` và `LuuTruTinNhanHoTroCu` được thực hiện **ngay ở bước 1.1**, trước khi bất kỳ thay đổi cấu trúc bảng nào diễn ra. Nếu phát hiện sai lệch (khác `noiDung`, `thoiGian`, `trangThai`, hoặc `khachHangId`), migration sẽ abort ngay lập tức (`ERROR_ARCHIVE_DATA_CONFLICT_DETECTED`), giữ nguyên 100% dữ liệu và schema cũ.
2. **Double-check trước khi xóa:** Bước 7.1 xác minh lại lần cuối rằng 100% bản ghi legacy sắp bị loại bỏ đã nằm an toàn trong `LuuTruTinNhanHoTroCu`.
3. **Quy trình phục hồi cho DBA khi migration fail giữa chừng:**
   - Trường hợp migration dừng trước bước DDL: Dữ liệu nguồn chưa bị thay đổi, chỉ cần kiểm tra lỗi dữ liệu xung đột và chạy lại migration.
   - Trường hợp migration dừng ở các bước DDL cuối (sau khi xóa bản ghi legacy): Toàn bộ dữ liệu tin nhắn cũ đã nằm an toàn trong `LuuTruTinNhanHoTroCu`. DBA có thể tra cứu bảng archive để đối chiếu hoặc hoàn tất các bước DDL còn lại theo hướng dẫn của migration script mà không lo ngại mất mát dữ liệu.

