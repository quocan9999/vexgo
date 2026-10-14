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
Theo quyết định kiến trúc đã phê duyệt:
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

## 6. Quy trình Phục hồi Dữ liệu có Điều kiện (Restoration Procedure)

> [!WARNING]
> **ĐIỀU KIỆN TIÊN QUYẾT TRƯỚC KHI KHÔI PHỤC:**  
> Tuyệt đối **KHÔNG ĐƯỢC PHÉP** tự động nạp ngược hàng loạt dữ liệu archive vào bảng `TinNhanHoTro` đang hoạt động.  
> Việc phục hồi một phiên chat lịch sử chỉ được thực hiện khi thỏa mãn **TẤT CẢ** các điều kiện sau:  
> 1. Có văn bản/yêu cầu chính thức từ khách hàng yêu cầu tiếp tục phiên hỗ trợ cũ.  
> 2. Đã xác định **chính xác 100% nhà xe (`nhaXeId`)** chịu trách nhiệm xử lý (có bằng chứng giao dịch vé xe / gửi hàng tương ứng).  
> 3. Đã tạo một `CuocTroChuyen` hợp lệ thuộc nhà xe đó trước khi đưa tin nhắn vào.

### Kịch bản phục hồi thủ công có kiểm soát (Manual Handled Recovery):
```sql
-- Bước 1: Tạo cuộc trò chuyện hợp lệ cho nhà xe được chỉ định
INSERT INTO `CuocTroChuyen` (
    `maCuocTroChuyen`, `tieuDe`, `trangThai`, `kenhHoTro`, `cheDoChat`,
    `khachHangId`, `nhaXeId`, `createdAt`, `updatedAt`
) VALUES (
    'RECOVERED-KH123-NX5', 'Phục hồi hỗ trợ khách hàng', 'CHO_TIEP_NHAN', 'WEB', 'NGUOI_THAT',
    123, 5, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)
);
SET @newCuocTroChuyenId = LAST_INSERT_ID();

-- Bước 2: Nạp các tin nhắn đã xác minh từ archive vào cuộc trò chuyện mới
INSERT INTO `TinNhanHoTro` (
    `cuocTroChuyenId`, `taiKhoanGuiId`, `loaiNguoiGui`, `loaiTinNhan`,
    `noiDung`, `trangThai`, `createdAt`, `updatedAt`
)
SELECT
    @newCuocTroChuyenId,
    kh.`taiKhoanId`,
    'KHACH_HANG',
    'VAN_BAN',
    arc.`noiDung`,
    arc.`trangThaiCu`,
    arc.`thoiGianCu`,
    arc.`updatedAtCu`
FROM `LuuTruTinNhanHoTroCu` arc
JOIN `KhachHang` kh ON kh.`khachHangId` = arc.`khachHangIdCu`
WHERE arc.`tinNhanId` IN (101, 102, 103); -- Danh sách ID tin nhắn cụ thể đã được xác minh
```
