# VexGo — sao lưu và thử khôi phục MySQL

## Phạm vi

Công cụ vận hành Node.js (không thêm dependency), chạy từ máy có Docker CLI.
Không thêm API công khai, trang Admin, Prisma model hay migration. Không thay đổi
các luồng Mobile/Web/Admin. Nhánh xuất phát từ develop `713d775`.

Backup toàn bộ database được cấu hình bằng `MYSQL_DATABASE` trong container nguồn:
schema, data, indexes, views, triggers, routines, events và `_prisma_migrations`.
Không dump hệ thống tài khoản MySQL hay các database hệ thống.
Ứng dụng được tiếp tục ghi dữ liệu vào bảng InnoDB; không chạy migration/DDL khi
backup. Có kiểm tra danh sách bảng, metadata cột/index và lịch sử migration trước/sau;
kiểm tra này không thay thế việc phối hợp tránh DDL trong thời gian backup.

**Mặc định là backup DB.** Chế độ DB + ảnh Cloudinary và giới hạn file được hỗ trợ được mô tả trong [CLOUDINARY_BACKUP_RESTORE.md](CLOUDINARY_BACKUP_RESTORE.md). Chưa coi đây là backup mọi loại file của toàn hệ thống.

| Thành phần                         | Hiện trạng và cách bảo vệ                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB nghiệp vụ                       | Dump bằng client trong chính image MySQL 8.4 của nguồn                                                                                                                                                                                                                   |
| File/ảnh                           | Mặc định DB-only chỉ giữ URL/storageKey. Đã bổ sung chế độ --cloudinary-environment để sao lưu file WebP gallery xe từ registry trong snapshot DB, mã hóa và thử restore sang folder/DB riêng; yêu cầu registry PR #57 đã được rollout. Xem CLOUDINARY_BACKUP_RESTORE.md |
| Code/Prisma migrations             | Git, ghi toolRevision và deployedRevision nếu người vận hành cung cấp đúng phiên bản đang triển khai                                                                                                                                                                     |
| `.env`, SMTP, Firebase, SePay, JWT | Không gom vào gói DB. Lưu riêng trong kho secret được mã hóa; không commit hoặc gửi qua chat                                                                                                                                                                             |
| Khóa giải mã backup                | File 32 byte riêng, tách khỏi thư mục backup và lưu thêm một bản an toàn ở nơi khác                                                                                                                                                                                      |

Không copy trực tiếp volume MySQL đang chạy. Không dump dữ liệu ra `.sql` plaintext
trên host. SQL stream được gzip rồi mã hóa AES-256-GCM (nonce mới mỗi bản), metadata
được xác thực bằng AAD. SHA-256 giúp phát hiện hỏng file; tính xác thực do GCM đảm bảo.
Checksum không thay thế mã hóa/xác thực. Thư mục `.partial-*` là bản chưa hoàn tất,
không đủ điều kiện restore, mirror hoặc retention.

## Chuẩn bị

- Node.js 24, Docker Desktop hoạt động, container nguồn là MySQL 8.4 và có biến
  `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD` như compose của repo.
- Công cụ dùng root **bên trong container** để dump routines/events. Không in secret
  và không đưa password vào argv trên host. Quyền truy cập Docker tương đương quyền
  vận hành DB; không cung cấp công cụ này cho khách hàng/nhân viên nhà xe.
- Khóa và dữ liệu backup phải nằm ngoài checkout. Không dùng dữ liệu nhạy cảm trong CI.
- `--revision` là SHA Backend thực tế đang chạy nếu biết. Khi không biết thì để trống;
  không mặc định toolRevision là phiên bản DB/API đang triển khai.

Các lệnh dưới đây chạy ở gốc repo/worktree. Đường dẫn chỉ là ví dụ; chọn ổ có đủ chỗ.

```powershell
node scripts/backup/vexgo-backup.mjs keygen --key C:/Users/HP/.vexgo-private/backup.key

node scripts/backup/vexgo-backup.mjs backup --source vexgo_web-mysql-1 --out D:/VexGoBackups/database --key C:/Users/HP/.vexgo-private/backup.key

node scripts/backup/vexgo-backup.mjs verify --backup D:/VexGoBackups/database/<backup-id> --key C:/Users/HP/.vexgo-private/backup.key
```

keygen không ghi đè khóa có sẵn. Trên Windows áp ACL chỉ cho SID người chạy; trên
Unix file mode 0600. Bảo vệ cả tài khoản/máy chứa khóa. Mất khóa sẽ không giải mã
được bản sao; không đặt khóa bên trong thư mục backup hoặc cùng bản sao mang ra ngoài.

Backup thất bại trả exit code khác 0 và mã lỗi an toàn, không xuất raw SQL/stderr
có thể chứa PII. Nếu có `.partial-*`, giữ để điều tra, không dùng để phục hồi.

## Restore thử — không có đích ghi đè DB chính

```powershell
node scripts/backup/vexgo-backup.mjs restore-test --backup D:/VexGoBackups/database/<backup-id> --key C:/Users/HP/.vexgo-private/backup.key
```

1. Kiểm tra manifest, SHA-256, giải mã và xác thực GCM toàn file **trước** khi chạy SQL.
2. Tạo container mới `vexgo-restore-<UUID>` bằng đúng immutable image ID của nguồn.
   Image đó phải còn tồn tại local. Khi chuyển máy, cần lưu/chuyển đúng image từ
   nguồn hoặc xây quy trình phê duyệt image tương thích; công cụ không tự đổi phiên bản.
3. Container không mở host port, không gắn volume nguồn, `--network none`, event scheduler
   OFF và local-infile OFF. Chỉ có MySQL, không chạy API/outbox worker/email/push.
4. Import SQL vào cùng tên DB nhưng trên instance riêng. So sánh bảng/cột/index,
   migration hash, charset/collation database; chạy `CHECK TABLE`, đọc số hàng. Báo cáo không chứa dữ liệu cá nhân.
5. Nếu thất bại, xóa đúng container mới tạo và volume riêng của nó. Nếu thành công,
   giữ container để xem xét, in lệnh dọn chính xác; không tự chuyển ứng dụng sang DB này.

Kết quả `RESTORE_DATABASE_VERIFIED` chứng minh khôi phục DB và kiểm tra kỹ thuật,
**không chứng minh các luồng API/E2E, file ngoài DB hay đối soát ngân hàng**.
Tệp `restore-report-*.json` ghi rõ những phần đã/chưa kiểm tra.

Trước khi thay DB chính: chốt phiên bản ứng dụng tương thích, lập kế hoạch downtime,
dừng toàn bộ nguồn ghi (API, cron, workers), backup hiện trạng, restore và kiểm tra
ở môi trường riêng. Đăng xuất/vô hiệu phiên và xử lý OTP/giữ ghế đã hết hạn theo
contract ứng dụng. Đối soát giao dịch SePay phát sinh sau thời điểm backup; rà soát
outbox email/push để tránh gửi lại. Sau khi lead chốt mới chuyển cấu hình DB.
Không có lệnh restore ghi đè DB chính trong đợt này.

## Lịch chạy, bản thứ hai và retention

```powershell
node scripts/backup/vexgo-backup.mjs backup --source vexgo_web-mysql-1 --out D:/VexGoBackups/database --key C:/Users/HP/.vexgo-private/backup.key --mirror E:/VexGoBackups/database --keep 7
```

Mirror copy vào thư mục partial rồi xác thực lại trước khi công bố. Mirror lỗi thì
job lỗi và không chạy retention; bản chính vừa hoàn tất vẫn được giữ. Mirror trên
cùng ổ chỉ chứng minh khả năng copy, không bảo vệ khỏi hỏng ổ/mất máy. Chọn ổ khác
hoặc nơi lưu ngoài máy; backup chứa PII đã mã hóa, cần kiểm soát truy cập cả metadata.

`--keep 7` chỉ xóa các thư mục backup hoàn tất, đúng định dạng ID, trong **đúng** root
đã chỉ định sau khi xác thực các gói. Không xóa file lạ, symlink hay partial. Root
phải dành riêng cho công cụ/người vận hành; không cho tài khoản không tin cậy sửa nội
dung trong lúc job chạy. Không chạy hai job backup/retention đồng thời cùng root.
Retention chỉ áp dụng bản chính; bản mirror cần chính sách riêng, không tự xóa từ xa.

Windows: copy `scripts/backup/schedule.example.json` ra ngoài repo và sửa đường dẫn.
File config chỉ có đường dẫn, không chứa key/password. Bỏ `mirror` nếu chưa có nơi
lưu thứ hai; ghi nhận đây là giới hạn bảo vệ dữ liệu.

```powershell
powershell -NoProfile -File scripts/backup/run-scheduled.ps1 -ConfigFile D:/VexGoBackups/schedule.json
powershell -NoProfile -File scripts/backup/install-schedule.ps1 -ConfigFile D:/VexGoBackups/schedule.json -At 02:00 -Preview
powershell -NoProfile -File scripts/backup/install-schedule.ps1 -ConfigFile D:/VexGoBackups/schedule.json -At 02:00
```

Task chạy bằng tài khoản đang đăng nhập, quyền Limited, không lưu mật khẩu Windows;
yêu cầu Docker Desktop đang chạy. `StartWhenAvailable` hỗ trợ chạy bù khi máy hoạt
động lại; không bảo đảm SLA khi người dùng đăng xuất hoặc Docker tắt. Job không
chạy chồng, tối đa 2 giờ. Log JSON theo lượt chạy và `LastTaskResult` khác 0 khi lỗi.
Chưa gửi cảnh báo email; không tự dùng tài khoản SMTP thật trong công cụ này.
Log cần được người vận hành theo dõi và dọn định kỳ. Trên server cần scheduler/service
và cảnh báo phù hợp hạ tầng lead lựa chọn.

Mục tiêu ban đầu: backup hằng ngày, giữ 7 bản và thêm bản trước migration. Mất dữ liệu
có thể đến gần 24 giờ hoặc lâu hơn nếu job lỗi. Chưa có binlog/PITR, không hứa phục
hồi đúng từng phút. Thời gian khôi phục phải đo trên DB thực tế.

## Kiểm thử

```powershell
node --test scripts/backup/backup.test.mjs

# Chỉ dùng DB mẫu do test tự tạo trong container riêng, không dùng DB chính:
$env:VEXGO_BACKUP_DOCKER_TEST='1'
node --test scripts/backup/docker-smoke.test.mjs
```

Test crypto/stream, khóa sai, ciphertext/metadata bị sửa, bản sao thiếu, dump lỗi,
identifier, restore không có đích DB chính. Không thay thế thử restore MySQL thật.
Docker smoke test xác minh dữ liệu Unicode, FK, view, routine, event scheduler OFF,
mirror, retention và khóa sai. Workflow backup riêng dùng fixture disposable, không
truy cập secret hoặc DB thật của dự án.
Evidence triển khai thực tế và trạng thái từng bước ghi ở `SYSTEM_BACKUP_RESTORE_PROGRESS.md`.

Tài liệu nền: [MySQL 8.4 mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html),
[Docker network none](https://docs.docker.com/engine/network/drivers/none/).
