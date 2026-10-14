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

---

## 6. Quy trình Phục hồi Dữ liệu An toàn bằng MySQL Stored Procedure (Safe Restoration Procedure)

> [!CAUTION]
> **BẢO ĐẢM TÍNH NGUYÊN TỬ (TRANSACTION ATOMICITY & ROLLBACK TRONG MYSQL):**  
> MySQL **mặc định KHÔNG tự động rollback toàn bộ transaction** nếu một câu lệnh SQL đơn lẻ phát sinh lỗi trong quá trình thực thi script. Nếu DBA chạy một chuỗi câu lệnh SQL độc lập và client/GUI tiếp tục thực thi đến lệnh `COMMIT`, các dữ liệu đã chèn trước đó (như `CuocTroChuyen` hoặc một phần `TinNhanHoTro`) **vẫn sẽ bị commit vào database**, dẫn đến tình trạng phục hồi dở dang và phá vỡ tính toàn vẹn dữ liệu.  
> **YÊU CẦU BẮT BUỘC:** Quy trình phục hồi phải được đóng gói vào **MySQL Stored Procedure** có khai báo `DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;`. Khi phát sinh bất kỳ lỗi SQL hoặc lỗi kiểm tra nghiệp vụ (`SIGNAL SQLSTATE '45000'`), handler sẽ lập tức thực thi `ROLLBACK` toàn bộ transaction trước khi phát sinh lại lỗi (`RESIGNAL`), bảo đảm 100% không còn bất kỳ bản ghi phục hồi dở dang nào trong cơ sở dữ liệu.

> [!WARNING]
> **ĐIỀU KIỆN TIÊN QUYẾT TRƯỚC KHI KHÔI PHỤC:**  
> Tuyệt đối **KHÔNG ĐƯỢC PHÉP** tự động nạp ngược hàng loạt dữ liệu archive vào bảng `TinNhanHoTro` đang hoạt động.  
> Việc phục hồi một phiên chat lịch sử chỉ được thực hiện khi thỏa mãn **TẤT CẢ** các điều kiện sau:  
> 1. Có văn bản/yêu cầu chính thức từ khách hàng yêu cầu tiếp tục phiên hỗ trợ cũ.  
> 2. Đã xác định **chính xác 100% nhà xe (`nhaXeId`)** chịu trách nhiệm xử lý (có bằng chứng giao dịch vé xe / gửi hàng tương ứng).  
> 3. Đã tạo một `CuocTroChuyen` hợp lệ thuộc nhà xe đó trước khi đưa tin nhắn vào.  
> 4. **RÀNG BUỘC CÁCH LY KHÁCH HÀNG (Cross-Customer Protection):** Bắt buộc phải xác minh tất cả tin nhắn khôi phục thuộc cùng một `khachHangId` duy nhất. **Tuyệt đối không được trộn tin nhắn của khách hàng này vào cuộc trò chuyện của khách hàng khác.**

### 6.1. Định nghĩa Stored Procedure Phục hồi Dữ liệu (`sp_RecoverLegacyMessages`)

Stored Procedure dưới đây tích hợp đầy đủ:
- Exception handler tự động `ROLLBACK` toàn bộ transaction khi có lỗi.
- Validation tham số đầu vào và kiểm tra quyền sở hữu dữ liệu.
- **Guard 1 (Preflight ID & Customer Isolation):** Xác minh 100% ID trong danh sách thuộc duy nhất khách hàng đích trước khi tạo hội thoại.
- **Join Constraint:** Ràng buộc kép `arc.khachHangIdCu = ctc.khachHangId` ở mức truy vấn nạp tin nhắn.
- **Guard 2 (Row Count Check):** Kiểm tra số lượng bản ghi thực tế được chèn khớp chính xác số lượng kỳ vọng.

```sql
-- Lưu ý: Khi thực thi qua mysql CLI, bắt buộc phải dùng DELIMITER //
DELIMITER //

DROP PROCEDURE IF EXISTS `sp_RecoverLegacyMessages` //

CREATE PROCEDURE `sp_RecoverLegacyMessages`(
    IN p_targetKhachHangId INT,
    IN p_targetNhaXeId INT,
    IN p_tinNhanIdsJson JSON,
    IN p_expectedCount INT,
    OUT p_newCuocTroChuyenId INT
)
proc_body: BEGIN
    DECLARE v_verifiedCount INT DEFAULT 0;
    DECLARE v_insertedCount INT DEFAULT 0;
    DECLARE v_maCuocTroChuyen VARCHAR(100);
    DECLARE v_taiKhoanId INT DEFAULT NULL;

    -- Bắt mọi lỗi SQL, lập tức ROLLBACK toàn bộ transaction và RESIGNAL lỗi cho caller
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Bắt đầu giao dịch nguyên tử (Atomic Transaction)
    START TRANSACTION;

    -- 1. Validation tham số đầu vào
    IF p_targetKhachHangId IS NULL OR p_targetKhachHangId <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TARGET_KHACH_HANG_ID';
    END IF;

    IF p_targetNhaXeId IS NULL OR p_targetNhaXeId <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TARGET_NHA_XE_ID';
    END IF;

    IF p_tinNhanIdsJson IS NULL OR NOT JSON_VALID(p_tinNhanIdsJson) OR JSON_LENGTH(p_tinNhanIdsJson) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_OR_EMPTY_TIN_NHAN_IDS_JSON';
    END IF;

    IF p_expectedCount IS NULL OR p_expectedCount <= 0 OR p_expectedCount <> JSON_LENGTH(p_tinNhanIdsJson) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EXPECTED_COUNT_MISMATCH_WITH_JSON_LENGTH';
    END IF;

    -- 2. Kiểm tra tồn tại khách hàng và lấy tài khoản tương ứng
    SELECT `taiKhoanId` INTO v_taiKhoanId
    FROM `KhachHang`
    WHERE `khachHangId` = p_targetKhachHangId;

    IF v_taiKhoanId IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CUSTOMER_OR_ACCOUNT_NOT_FOUND';
    END IF;

    -- 3. Kiểm tra tồn tại nhà xe đích
    IF NOT EXISTS (SELECT 1 FROM `NhaXe` WHERE `nhaXeId` = p_targetNhaXeId) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUS_COMPANY_NOT_FOUND';
    END IF;

    -- 4. Guard 1: Xác thực số lượng tin nhắn trong archive thuộc DUY NHẤT khách hàng đích
    SELECT COUNT(*) INTO v_verifiedCount
    FROM `LuuTruTinNhanHoTroCu` arc
    JOIN JSON_TABLE(p_tinNhanIdsJson, '$[*]' COLUMNS (`tinNhanId` INT PATH '$')) jt
      ON jt.`tinNhanId` = arc.`tinNhanId`
    WHERE arc.`khachHangIdCu` = p_targetKhachHangId;

    -- Nếu có bất kỳ ID nào không tồn tại, bị trùng lặp hoặc thuộc về khách hàng khác:
    IF v_verifiedCount <> p_expectedCount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CROSS_CUSTOMER_OR_MISSING_ARCHIVE_MESSAGES_DETECTED';
    END IF;

    -- 5. Tạo cuộc trò chuyện mới hợp lệ cho đúng khách hàng đích và nhà xe đã xác thực
    SET v_maCuocTroChuyen = CONCAT('RECOVERED-KH', p_targetKhachHangId, '-NX', p_targetNhaXeId, '-', UNIX_TIMESTAMP());
    INSERT INTO `CuocTroChuyen` (
        `maCuocTroChuyen`, `tieuDe`, `trangThai`, `kenhHoTro`, `cheDoChat`,
        `khachHangId`, `nhaXeId`, `createdAt`, `updatedAt`
    ) VALUES (
        v_maCuocTroChuyen,
        CONCAT('Phục hồi hỗ trợ khách hàng KH', p_targetKhachHangId),
        'CHO_TIEP_NHAN',
        'WEB',
        'NGUOI_THAT',
        p_targetKhachHangId,
        p_targetNhaXeId,
        CURRENT_TIMESTAMP(0),
        CURRENT_TIMESTAMP(0)
    );

    SET p_newCuocTroChuyenId = LAST_INSERT_ID();

    -- 6. Nạp tin nhắn từ archive: RÀNG BUỘC KÉP arc.khachHangIdCu = ctc.khachHangId
    INSERT INTO `TinNhanHoTro` (
        `cuocTroChuyenId`, `taiKhoanGuiId`, `loaiNguoiGui`, `loaiTinNhan`,
        `noiDung`, `trangThai`, `createdAt`, `updatedAt`
    )
    SELECT
        ctc.`cuocTroChuyenId`,
        v_taiKhoanId,
        'KHACH_HANG',
        'VAN_BAN',
        arc.`noiDung`,
        arc.`trangThaiCu`,
        arc.`thoiGianCu`,
        arc.`updatedAtCu`
    FROM `LuuTruTinNhanHoTroCu` arc
    JOIN JSON_TABLE(p_tinNhanIdsJson, '$[*]' COLUMNS (`tinNhanId` INT PATH '$')) jt
      ON jt.`tinNhanId` = arc.`tinNhanId`
    JOIN `CuocTroChuyen` ctc
      ON ctc.`cuocTroChuyenId` = p_newCuocTroChuyenId
    WHERE arc.`khachHangIdCu` = ctc.`khachHangId`;

    -- 7. Guard 2: Kiểm tra số lượng dòng thực tế đã ghi vào TinNhanHoTro
    SET v_insertedCount = ROW_COUNT();

    IF v_insertedCount <> p_expectedCount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSERTED_ROW_COUNT_MISMATCH';
    END IF;

    -- 8. Hoàn tất giao dịch khi mọi điều kiện an toàn đều thỏa mãn
    COMMIT;
END //

DELIMITER ;
```

### 6.2. Hướng dẫn Vận hành và Chu trình Gọi Procedure

Khi DBA cần phục hồi một phiên chat lịch sử cho khách hàng `123`, nhà xe `5`, danh sách ID tin nhắn `[101, 102, 103]` (tổng cộng 3 tin nhắn):

```sql
-- Bước 1: Tạo procedure (nếu chưa có trong hệ quản trị) bằng script ở mục 6.1

-- Bước 2: Khai báo biến nhận kết quả và gọi procedure
SET @targetKhachHangId = 123;
SET @targetNhaXeId = 5;
SET @tinNhanIdsJson = '[101, 102, 103]';
SET @expectedCount = 3;
SET @newConvId = NULL;

CALL `sp_RecoverLegacyMessages`(
    @targetKhachHangId,
    @targetNhaXeId,
    @tinNhanIdsJson,
    @expectedCount,
    @newConvId
);

-- Bước 3: Xác minh kết quả sau khi gọi thành công
SELECT @newConvId AS `recoveredConversationId`;

-- Kiểm tra tin nhắn đã được chèn vào bảng hoạt động
SELECT `tinNhanId`, `cuocTroChuyenId`, `taiKhoanGuiId`, `loaiNguoiGui`, `noiDung`, `createdAt`
FROM `TinNhanHoTro`
WHERE `cuocTroChuyenId` = @newConvId;
```

### 6.3. Quy trình Dọn dẹp Procedure (Cleanup Lifecycle)

> [!IMPORTANT]
> **QUY TẮC DỌN DẸP PROCEDURE:**  
> DDL `CREATE PROCEDURE` và `DROP PROCEDURE` là các thao tác độc lập với transaction DML.  
> Sau khi hoàn tất thao tác phục hồi (hoặc sau khi xử lý sự cố lỗi), DBA **BẮT BUỘC** phải dọn dẹp Stored Procedure để tránh tồn đọng thủ tục tạm thời hoặc xung đột schema:
> ```sql
> DROP PROCEDURE IF EXISTS `sp_RecoverLegacyMessages`;
> ```
> Nếu sử dụng script điều phối tự động (Node.js/Bash/Python), lệnh cleanup này phải được đặt trong khối `finally` để luôn được thực thi dù `CALL` thành công hay thất bại.

---

## 7. Xử lý Sự cố Migration & Giới hạn Implicit Commit của MySQL

### 7.1. Đặc tính Implicit Commit trong MySQL DDL
MySQL tự động kích hoạt **implicit commit** sau mỗi câu lệnh DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`). Vì vậy, nếu một migration script bị lỗi ở giữa chừng (ví dụ sau bước `ALTER TABLE`), MySQL **không thể rollback tự động** các câu lệnh DDL đã thực thi trước đó.

### 7.2. Chiến lược Bảo vệ Preflight
Để triệt tiêu nguy cơ mất mát dữ liệu do implicit commit:
1. **Kiểm tra xung đột trước (Preflight Conflict Detection):** Bước kiểm tra xung đột dữ liệu giữa `TinNhanHoTro` và `LuuTruTinNhanHoTroCu` được thực hiện **ngay ở bước 1.1**, trước khi bất kỳ thay đổi cấu trúc bảng nào diễn ra. Nếu phát hiện sai lệch (khác `noiDung`, `thoiGian`, `trangThai`, `khachHangId`, `updatedAt` hoặc `createdAt`), migration sẽ abort ngay lập tức (`ER_SUBQUERY_NO_1_ROW` Code 1242) mà không sửa đổi (zero-mutation) bất kỳ dữ liệu nào.
2. **Double-check trước khi xóa:** Bước 7.1 xác minh lại lần cuối rằng 100% bản ghi legacy sắp bị loại bỏ đã nằm an toàn trong `LuuTruTinNhanHoTroCu`.

---

## 8. Quy trình Phục hồi Thủ công khi Migration dừng dở dang (Manual Recovery for Incomplete Migration)

> [!CAUTION]
> **QUY TẮC CỐT LÕI: KHÔNG CHẠY LẠI MIGRATION TỪ ĐẦU MỘT CÁCH MÙ QUÁNG!**  
> Do đặc tính implicit commit của MySQL DDL, một migration bị lỗi giữa chừng sẽ để lại schema ở trạng thái đã thay đổi một phần. Nếu DBA chạy lại toàn bộ script `migration.sql` từ đầu, các câu lệnh như `ALTER TABLE TinNhanHoTro ADD COLUMN cuocTroChuyenId` ở bước 3 sẽ bị lỗi **Duplicate column name** và tiếp tục thất bại.  
> **Lưu ý về Test F3:** Test tích hợp F3 trong codebase chỉ chứng minh rằng *câu lệnh preflight guard chấp nhận trạng thái `createdAt` đã chuẩn hóa mà không sinh xung đột giả*. Test F3 **KHÔNG PHẢI** là bằng chứng cho thấy migration có khả năng tự động chạy lại từ đầu (not automatically resumable). Mọi trường hợp migration dừng giữa chừng **bắt buộc cần có sự can thiệp thủ công (manual recovery) của DBA theo quy trình 10 bước dưới đây**.

### Quy trình 10 bước can thiệp và kiểm tra cho DBA:

1. **Dừng toàn bộ tiến trình áp dụng migration:**  
   Không retry tự động qua CI/CD hoặc chạy lại lệnh Prisma Migrate. Đánh dấu trạng thái bảo trì nếu cần thiết.

2. **Sao lưu khẩn cấp schema và dữ liệu hiện tại:**  
   Thực hiện backup snapshot cơ sở dữ liệu ngay lập tức trước khi thực hiện bất kỳ truy vấn sửa đổi nào:
   ```bash
   mysqldump -u root -p vexgo TinNhanHoTro LuuTruTinNhanHoTroCu CuocTroChuyen > backup_partial_migration.sql
   ```

3. **Xác định cấu trúc bảng thực tế qua `information_schema`:**  
   Không đoán trạng thái dựa trên log. Truy vấn trực tiếp metadata của MySQL để xác định chính xác các cột và bảng đã được tạo:
   ```sql
   -- Kiểm tra sự tồn tại của bảng archive
   SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LuuTruTinNhanHoTroCu';

   -- Kiểm tra các cột đã được thêm vào TinNhanHoTro
   SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'TinNhanHoTro'
     AND COLUMN_NAME IN ('cuocTroChuyenId', 'taiKhoanGuiId', 'loaiNguoiGui', 'loaiTinNhan');
   ```

4. **Đối chiếu dữ liệu nguồn và archive:**  
   Kiểm tra số lượng bản ghi giữa `TinNhanHoTro` và `LuuTruTinNhanHoTroCu`:
   ```sql
   SELECT COUNT(*) AS total_source FROM `TinNhanHoTro`;
   SELECT COUNT(*) AS total_archive FROM `LuuTruTinNhanHoTroCu`;
   ```

5. **Phân loại 5 mốc trạng thái cụ thể của database:**
   - **Mốc 1 (Dừng ở Bước 1 - Trước DDL):** Bảng `LuuTruTinNhanHoTroCu` chưa được tạo hoặc preflight guard kích hoạt lỗi. Dữ liệu nguồn `TinNhanHoTro` nguyên vẹn 100%. DBA kiểm tra nguyên nhân xung đột dữ liệu, sửa dữ liệu không nhất quán và chạy lại bình thường.
   - **Mốc 2 (Dừng ở Bước 2 - Đã tạo archive nhưng chưa sửa cấu trúc nguồn):** Bảng `LuuTruTinNhanHoTroCu` đã có dữ liệu nhưng `TinNhanHoTro` chưa có cột mới. Dữ liệu nguồn vẫn nguyên vẹn.
   - **Mốc 3 (Dừng ở Bước 3 hoặc 4 - Đã thêm cột `cuocTroChuyenId` và chuẩn hóa `createdAt = thoiGian`):** Các cột mới đã tồn tại nhưng chưa có khóa ngoại. `createdAt` của nguồn đã được đồng bộ. Bảng archive vẫn giữ nguyên snapshot `createdAtCu` ban đầu.
   - **Mốc 4 (Dừng ở Bước 5 hoặc 6 - Đang liên kết hoặc chuẩn hóa trạng thái):** Bảng `CuocTroChuyen` đã được tạo, một số tin nhắn có thể đã được gắn `cuocTroChuyenId`.
   - **Mốc 5 (Dừng ở Bước 7 - Trước hoặc sau khi xóa legacy message):** Kiểm tra xem các bản ghi có `cuocTroChuyenId IS NULL` đã bị xóa hay chưa.

6. **Kiểm tra điều kiện tiên quyết trước khi tiếp tục thao tác xóa:**  
   Nếu database đang ở Mốc 4 hoặc Mốc 5, DBA **BẮT BUỘC** phải chạy truy vấn kiểm tra bước 7.1 để xác nhận 100% bản ghi không có `cuocTroChuyenId` đã nằm an toàn trong archive:
   ```sql
   SELECT COUNT(*) AS unarchived_count
   FROM `TinNhanHoTro` src
   LEFT JOIN `LuuTruTinNhanHoTroCu` arc ON arc.`tinNhanId` = src.`tinNhanId`
   WHERE src.`cuocTroChuyenId` IS NULL AND arc.`tinNhanId` IS NULL;
   -- Kết quả BẮT BUỘC PHẢI BẰNG 0. Nếu > 0, DỪNG LẠI NGAY LẬP TỨC.
   ```

7. **Xử lý thủ công các bước DDL còn thiếu theo kịch bản có kiểm soát:**  
   Dựa trên mốc trạng thái đã xác định ở Bước 5, DBA chỉ thực thi các khối lệnh SQL tiếp theo từ điểm bị dừng, thay vì chạy lại từ Bước 1:
   - Nếu đã thêm cột ở Bước 3 nhưng chưa tạo bảng `CuocTroChuyen`: Thực thi từ Bước 5.
   - Nếu đã xóa tin nhắn legacy nhưng chưa thêm ràng buộc khóa ngoại (Bước 7.3): Thực thi các câu lệnh `ALTER TABLE ... ADD CONSTRAINT` tương ứng.

8. **Đồng bộ hóa trạng thái Prisma Migration:**  
   Sau khi hoàn tất thủ công các thay đổi schema trên cơ sở dữ liệu, sử dụng lệnh Prisma CLI để đánh dấu migration đã được áp dụng thành công:
   ```bash
   npx prisma migrate resolve --applied 20261013150000_add_chat_support_conversations_and_messages
   ```
   Hoặc nếu cần rollback về schema cũ trước đó:
   ```bash
   npx prisma migrate resolve --rolled-back 20261013150000_add_chat_support_conversations_and_messages
   ```

9. **Xác minh không có schema drift:**  
   Chạy lệnh kiểm tra drift giữa Prisma schema và database thực tế:
   ```bash
   npx prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma \
     --exit-code
   ```
   Kết quả trả về mã thoát `0` xác nhận zero drift.

10. **Lưu nhật ký can thiệp vào hồ sơ vận hành:**  
    Ghi nhận đầy đủ thời gian, người thực hiện, lý do migration bị dừng, danh sách câu lệnh SQL thủ công đã chạy và kết quả kiểm tra toàn vẹn dữ liệu vào hệ thống ticket/runbook của dự án.


