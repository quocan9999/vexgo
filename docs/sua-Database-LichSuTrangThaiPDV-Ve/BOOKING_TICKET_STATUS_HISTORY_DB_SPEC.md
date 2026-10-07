# VexGo — Spec DB Foundation lịch sử trạng thái Phiếu đặt vé & Vé

## 1. Mục tiêu

Bổ sung nền tảng database để lưu lịch sử trạng thái của:

- `PhieuDatVe`
- `Ve`

Mục tiêu chính là phục vụ timeline trạng thái về sau cho Customer/Admin, tương tự timeline theo dõi đơn hàng.

Task này chỉ xây **DB foundation**. Chưa tích hợp vào Customer cancellation và chưa triển khai Feature 07 Admin.

Branch gợi ý:

```text
feature/booking-ticket-status-history
```

---

## 2. Phạm vi

### In scope

- Cập nhật `prisma/schema.prisma`.
- Tạo forward migration mới.
- Thêm hai bảng lịch sử:
  - `LichSuTrangThaiPhieuDatVe`
  - `LichSuTrangThaiVe`
- Backfill baseline history cho dữ liệu hiện có.
- Bổ sung FK, unique và CHECK constraints đã chốt.
- Cập nhật Class Diagram `.mdl`.
- Bổ sung targeted migration/schema tests hoặc verifier cần thiết.
- Tạo handoff Markdown ngắn sau khi hoàn thành.

### Out of scope

Không làm trong branch này:

- Customer cancellation integration.
- Admin quản lý phiếu đặt vé/vé.
- API timeline.
- UI timeline.
- Manual cancellation.
- Permission mới.
- Refund logic.
- Chuẩn hóa lifecycle trạng thái.
- Chuyển các status hiện tại sang Prisma enum.
- Snapshot role/permission.
- Activity log chung.
- Bảng `ThaoTac`.

---

## 3. Quyết định về kiểu dữ liệu trạng thái

Hiện tại `PhieuDatVe.trangThai` và `Ve.trangThai` trên `develop` đang dùng `String @db.VarChar(30)`.

Trong task này **tiếp tục dùng String**, không chuyển sang enum.

Lý do:

- tránh mở rộng blast radius;
- không thay đổi contract/domain hiện hữu;
- project sẽ có một đợt riêng để chuẩn hóa toàn bộ các trạng thái thành enum.

Do đó:

```prisma
trangThaiCu  String? @db.VarChar(30)
trangThaiMoi String  @db.VarChar(30)
```

Tương tự, `nguonThayDoi` hiện cũng dùng String thay vì Prisma enum:

```prisma
nguonThayDoi String @db.VarChar(20)
```

Giá trị hợp lệ:

```text
CUSTOMER
STAFF
SYSTEM
```

Các giá trị này phải được bảo vệ bằng CHECK constraint ở database.

Không tự đổi giá trị status hiện đang được code sử dụng.

Ví dụ nếu `Ve` hiện dùng:

```text
HUY
```

thì migration/history phải giữ đúng `HUY`, không tự đổi thành `DA_HUY`.

---

## 4. Model `LichSuTrangThaiPhieuDatVe`

Schema mục tiêu:

```text
lichSuTrangThaiPhieuDatVeId  Int PK auto increment
phieuDatVeId                 Int NOT NULL
trangThaiCu                  VARCHAR(30) NULL
trangThaiMoi                 VARCHAR(30) NOT NULL
thoiDiem                     DATETIME NOT NULL
nguonThayDoi                 VARCHAR(20) NOT NULL
taiKhoanId                   Int NULL
lyDo                         VARCHAR(255) NOT NULL
laOverride                   Boolean NOT NULL DEFAULT false
maThaoTac                    CHAR(36) NOT NULL
```

Quan hệ:

```text
PhieuDatVe 1 --- 0..* LichSuTrangThaiPhieuDatVe
TaiKhoan   1 --- 0..* LichSuTrangThaiPhieuDatVe
```

`TaiKhoan` là nullable ở phía history vì `SYSTEM` không có tài khoản thực hiện.

FK:

```text
phieuDatVeId -> PhieuDatVe.phieuDatVeId
taiKhoanId   -> TaiKhoan.taiKhoanId
```

Cả hai dùng:

```text
onDelete: Restrict
onUpdate: Restrict
```

Unique:

```text
UNIQUE(maThaoTac, phieuDatVeId)
```

Không có `updatedAt`.

---

## 5. Model `LichSuTrangThaiVe`

Schema mục tiêu:

```text
lichSuTrangThaiVeId  Int PK auto increment
veId                  Int NOT NULL
trangThaiCu           VARCHAR(30) NULL
trangThaiMoi          VARCHAR(30) NOT NULL
thoiDiem              DATETIME NOT NULL
nguonThayDoi          VARCHAR(20) NOT NULL
taiKhoanId            Int NULL
lyDo                   VARCHAR(255) NOT NULL
laOverride             Boolean NOT NULL DEFAULT false
maThaoTac              CHAR(36) NOT NULL
```

Quan hệ:

```text
Ve       1 --- 0..* LichSuTrangThaiVe
TaiKhoan 1 --- 0..* LichSuTrangThaiVe
```

FK:

```text
veId        -> Ve.veId
taiKhoanId  -> TaiKhoan.taiKhoanId
```

Cả hai dùng:

```text
onDelete: Restrict
onUpdate: Restrict
```

Unique:

```text
UNIQUE(maThaoTac, veId)
```

Không có `updatedAt`.

---

## 6. Semantics của history

Hai bảng là **append-only state-transition history**.

History chỉ ghi khi:

1. `PhieuDatVe` / `Ve` được tạo lần đầu; hoặc
2. trạng thái thực sự thay đổi.

Không dùng history để ghi activity không làm đổi trạng thái, ví dụ:

- khách gửi yêu cầu;
- nhân viên mở màn hình;
- refund job bắt đầu;
- API được gọi;
- retry nội bộ.

### Record khởi tạo

Khi entity được tạo mới:

```text
trangThaiCu = NULL
trangThaiMoi = trạng thái ban đầu
```

### Transition bình thường

```text
trangThaiCu != NULL
trangThaiCu != trangThaiMoi
```

Ví dụ:

```text
CHO_THANH_TOAN -> DA_THANH_TOAN
DA_THANH_TOAN -> HUY
```

Không được tạo record vô nghĩa:

```text
DA_THANH_TOAN -> DA_THANH_TOAN
```

---

## 7. `maThaoTac`

Yêu cầu khi triển khai thao tác history từ nghiệp vụ: `maThaoTac` do ứng dụng tạo dùng UUID v4:

```text
CHAR(36)
NOT NULL
```

Quy tắc UUID v4 ở trên áp dụng cho mã thao tác do application tạo. Migration baseline hiện tại gọi MySQL `UUID()`, hàm này sinh UUID version 1 cho từng history baseline. `schema.prisma` chỉ khai báo cột `CHAR(36)`, không đặt default sinh UUID; service tạo history về sau phải tự truyền mã theo quy tắc UUID v4.

Ví dụ:

```text
550e8400-e29b-41d4-a716-446655440000
```

Mỗi nghiệp vụ sinh một UUID.

Nếu một thao tác làm thay đổi:

```text
1 PhieuDatVe
+
3 Ve
```

thì tất cả history sinh ra từ thao tác đó phải dùng:

- cùng `maThaoTac`;
- cùng chính xác một `thoiDiem`.

Nếu thao tác chỉ làm đổi một vé thì vẫn sinh một `maThaoTac`.

`maThaoTac`:

- không phải FK;
- không tạo bảng `ThaoTac`;
- không unique toàn bảng.

Unique theo entity:

```text
LichSuTrangThaiPhieuDatVe:
UNIQUE(maThaoTac, phieuDatVeId)

LichSuTrangThaiVe:
UNIQUE(maThaoTac, veId)
```

Mục đích là ngăn cùng một entity bị ghi history hai lần trong cùng một nghiệp vụ/retry.

---

## 8. `thoiDiem`

Dùng field:

```text
thoiDiem
```

không dùng `createdAt` để biểu diễn mốc business.

Ý nghĩa:

> thời điểm trạng thái thực sự được ghi nhận thay đổi.

Các history thuộc cùng `maThaoTac` phải dùng cùng một timestamp.

Không có `updatedAt` vì history append-only.

---

## 9. `nguonThayDoi`

Dùng String:

```text
CUSTOMER
STAFF
SYSTEM
```

Ý nghĩa:

### `CUSTOMER`

Khách hàng đăng nhập và tự thực hiện thao tác.

### `STAFF`

Bất kỳ tài khoản nội bộ nào có permission phù hợp:

- Admin nhà xe;
- CSKH;
- điều hành;
- hoặc nhân viên khác được cấp quyền.

Không dùng `ADMIN` làm source vì source không đại diện cho role cụ thể.

### `SYSTEM`

Backend/job/system tự thay đổi trạng thái.

Không snapshot role tại thời điểm thao tác trong task này.

---

## 10. `taiKhoanId`

Rule bắt buộc:

```text
CUSTOMER -> taiKhoanId IS NOT NULL
STAFF    -> taiKhoanId IS NOT NULL
SYSTEM   -> taiKhoanId IS NULL
```

Database phải enforce bằng CHECK constraint.

FK tới `TaiKhoan` dùng `Restrict/NoAction`.

Không dùng `SET NULL`, vì sẽ làm mất audit actor và vi phạm rule source/account.

---

## 11. `lyDo`

```text
VARCHAR(255)
NOT NULL
```

Mọi history record đều phải có lý do.

Ví dụ:

```text
CUSTOMER:
"Khách hàng tự hủy vé theo chính sách hủy"

STAFF:
"Khách gặp trường hợp bất khả kháng, nhân viên hỗ trợ hủy"

SYSTEM:
"Thanh toán được xác nhận thành công"
```

Với backfill:

```text
"Khởi tạo lịch sử trạng thái từ dữ liệu hiện có"
```

---

## 12. `laOverride`

```text
BOOLEAN NOT NULL DEFAULT false
```

Rule:

```text
CUSTOMER -> false
SYSTEM   -> false
STAFF    -> false hoặc true
```

`true` chỉ dùng khi nhân viên có permission đặc biệt và thực sự vượt qua điều kiện nghiệp vụ thông thường.

Database phải enforce:

```text
laOverride = true
-> nguonThayDoi = 'STAFF'
```

---

## 13. CHECK constraints bắt buộc

### Source hợp lệ

```text
nguonThayDoi IN ('CUSTOMER', 'STAFF', 'SYSTEM')
```

### Source/account

```text
(
  nguonThayDoi IN ('CUSTOMER', 'STAFF')
  AND taiKhoanId IS NOT NULL
)
OR
(
  nguonThayDoi = 'SYSTEM'
  AND taiKhoanId IS NULL
)
```

### Override

```text
laOverride = false
OR nguonThayDoi = 'STAFF'
```

### Transition

```text
trangThaiCu IS NULL
OR trangThaiCu <> trangThaiMoi
```

Không thêm composite timeline index `(entityId, thoiDiem)` trong task này.

---

## 14. Bảo toàn dữ liệu audit

History là dữ liệu audit lâu dài.

Do đó:

- không hard-delete `TaiKhoan` nếu đang được history tham chiếu;
- không hard-delete `PhieuDatVe` nếu đã có history;
- không hard-delete `Ve` nếu đã có history;
- không cascade delete history;
- không update history record;
- không delete history record.

Task này chỉ enforce phần phù hợp ở FK/database; không cần xây service riêng để quản lý history.

---

## 15. Backfill dữ liệu hiện có

Sau khi tạo hai bảng, migration phải backfill một baseline history cho mỗi entity hiện có.

### `PhieuDatVe`

Mỗi record hiện hữu:

```text
trangThaiCu = NULL
trangThaiMoi = PhieuDatVe.trangThai
nguonThayDoi = SYSTEM
taiKhoanId = NULL
lyDo = "Khởi tạo lịch sử trạng thái từ dữ liệu hiện có"
laOverride = false
thoiDiem = thời điểm migration chạy
maThaoTac = UUID riêng
```

### `Ve`

Tương tự:

```text
trangThaiCu = NULL
trangThaiMoi = Ve.trangThai
nguonThayDoi = SYSTEM
taiKhoanId = NULL
lyDo = "Khởi tạo lịch sử trạng thái từ dữ liệu hiện có"
laOverride = false
thoiDiem = thời điểm migration chạy
maThaoTac = UUID riêng
```

### Quy tắc backfill

- Không backfill lịch sử giả.
- Không suy diễn transition cũ.
- Không dùng `createdAt` của entity làm `thoiDiem`.
- Không gom toàn bộ backfill vào cùng một `maThaoTac`.
- Mỗi baseline history có UUID riêng. Migration `20261008040000_add_booking_and_ticket_status_histories` dùng MySQL `UUID()` (UUID version 1) cho các record này; đây là cách sinh riêng của bước backfill, không thay đổi quy tắc UUID v4 cho thao tác nghiệp vụ do application tạo.
- Không thay đổi trạng thái hiện tại của `PhieuDatVe` hoặc `Ve`.

Record baseline có nghĩa:

> Tại thời điểm hệ thống bắt đầu lưu history, entity đang ở trạng thái này.

---

## 16. Atomicity cho phase tích hợp sau

Branch này chưa sửa Customer/Admin service.

Nhưng handoff phải ghi rõ yêu cầu:

> Khi state-transition được tích hợp vào code, update trạng thái entity và insert history tương ứng phải nằm trong cùng database transaction.

Nếu một thao tác thay đổi cả `PhieuDatVe` và nhiều `Ve`:

- dùng cùng `maThaoTac`;
- dùng cùng `thoiDiem`;
- ghi tất cả update + history trong cùng transaction.

Không được để trạng thái đã đổi nhưng history chưa được ghi hoặc ngược lại.

---

## 17. Cập nhật Class Diagram

Cập nhật `.mdl` hiện tại với hai class:

```text
LichSuTrangThaiPhieuDatVe
LichSuTrangThaiVe
```

Quan hệ:

```text
PhieuDatVe 1 ---- 0..* LichSuTrangThaiPhieuDatVe
Ve         1 ---- 0..* LichSuTrangThaiVe

TaiKhoan   1 ---- 0..* LichSuTrangThaiPhieuDatVe
TaiKhoan   1 ---- 0..* LichSuTrangThaiVe
```

`TaiKhoan` nullable phía history theo source `SYSTEM`.

Không thêm:

- enum trạng thái mới;
- enum source trong Prisma;
- bảng `ThaoTac`;
- activity log;
- role snapshot;
- permission snapshot.

Trong diagram có thể ghi rõ domain value của `nguonThayDoi`:

```text
CUSTOMER | STAFF | SYSTEM
```

nhưng implementation hiện vẫn là `String`.

---

## 18. Migration strategy

Phải tạo **forward migration mới**.

Không sửa migration cũ đã merge/chạy.

Migration phải:

1. tạo hai bảng history;
2. tạo FK;
3. tạo unique constraints;
4. tạo CHECK constraints;
5. backfill baseline history;
6. verify không bỏ sót booking/ticket;
7. không sửa dữ liệu trạng thái hiện tại;
8. không phụ thuộc seed để migration hợp lệ.

Không reset database hoặc xóa volume nếu không cần thiết.

---

## 19. Tests / verifier

Chỉ chạy targeted tests/gates cần thiết cho DB task này, không cần full suite.

Phải kiểm tra tối thiểu:

- migration chạy thành công trên database phù hợp/scratch;
- số baseline `LichSuTrangThaiPhieuDatVe` bằng số `PhieuDatVe` hiện có;
- số baseline `LichSuTrangThaiVe` bằng số `Ve` hiện có;
- baseline có `trangThaiCu = NULL`;
- `trangThaiMoi` đúng bằng status hiện tại của entity;
- baseline dùng `SYSTEM`;
- baseline có `taiKhoanId = NULL`;
- baseline có `laOverride = false`;
- `lyDo` không null;
- `maThaoTac` không null và đúng dạng UUID;
- CHECK reject source ngoài `CUSTOMER|STAFF|SYSTEM`;
- CHECK reject `CUSTOMER/STAFF` thiếu `taiKhoanId`;
- CHECK reject `SYSTEM` có `taiKhoanId`;
- CHECK reject `CUSTOMER/SYSTEM + laOverride=true`;
- CHECK reject `trangThaiCu = trangThaiMoi`;
- unique reject duplicate `(maThaoTac, entityId)`;
- FK Restrict hoạt động;
- Prisma schema validate/generate pass.

Không viết test hời hợt chỉ kiểm tra table tồn tại.

---

## 20. Commit

Một commit sạch đại diện cho DB foundation.

Gợi ý:

```text
feat(database): thêm lịch sử trạng thái phiếu đặt vé và vé

- Thêm hai bảng lịch sử trạng thái cho phiếu đặt vé và vé
- Backfill trạng thái hiện tại làm mốc lịch sử ban đầu
- Bổ sung ràng buộc audit và cập nhật class diagram
```

Không trộn Customer/Admin implementation vào commit này.

---

## 21. Handoff

Tạo handoff ngắn sau khi hoàn thành, ghi rõ:

- migration nào được thêm;
- schema cuối cùng;
- semantics của `maThaoTac`;
- semantics của `thoiDiem`;
- backfill behavior;
- CHECK/FK/unique quan trọng;
- history đang dùng `String`, chưa chuyển enum;
- Customer cancellation hiện chưa ghi history;
- Admin Feature 07 chưa làm;
- phase tiếp theo phải retrofit Customer/Admin state changes trong cùng transaction.

---

## 22. Definition of Done

Task chỉ hoàn thành khi:

- Prisma schema hợp lệ;
- forward migration chạy được;
- backfill đầy đủ;
- constraints được kiểm chứng bằng test/verifier thực sự;
- Class Diagram được cập nhật;
- targeted tests pass;
- Prisma generate/validate pass;
- không sửa Customer cancellation;
- không làm Admin Feature 07;
- không đổi status hiện tại sang enum;
- không đổi giá trị status đang được runtime sử dụng;
- không có file rác/generated không cần commit;
- có handoff;
- commit local sạch.

Sau khi PR này được review và merge vào `origin/develop`, mới quay lại session Feature 07 để tiếp tục Admin + retrofit Customer history.
