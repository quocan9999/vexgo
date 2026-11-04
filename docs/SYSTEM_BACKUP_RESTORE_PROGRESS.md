# Tiến độ backup/restore — 03/11/2026

Nhánh `feature/system-backup-restore`, worktree `vexgo_backup_restore_worktree`,
base develop `713d775`. Chưa thay đổi API, DB schema hoặc migration. Các lệnh trên
nguồn chỉ đọc metadata/dump; không reset/seed/ghi dữ liệu QA vào DB chính.

| Bước                 | Trạng thái có bằng chứng                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Khảo sát          | Đã xác định MySQL 8.4 Docker, volume riêng; người dùng xác nhận dự kiến dùng Cloudinary, hiện chưa tích hợp                                                           |
| 2. Backup thủ công   | Đã chạy trên DB chính: 95 bảng, gzip + AES-GCM + SHA-256, kiểm tra giải mã thành công                                                                                 |
| 3. Restore riêng     | Đã import bản sao DB chính vào container mới, network none, không host port, volume tách biệt, events OFF                                                             |
| 4. Kiểm thử phục hồi | Đã kiểm tra 95 bảng, tổng 9.046 dòng đọc được (gồm kết quả view nếu có), cột/index, migration hash và CHECK TABLE. Chưa chạy API/E2E trên DB phục hồi                 |
| 5. Tự động hóa       | Đã làm và chạy thử Windows runner, mirror, retention; đã export preview lịch hằng ngày. Chưa đăng ký task thường trực, chưa có nơi lưu ngoài máy và cảnh báo chủ động |
| 6. Bàn giao          | Có runbook, kiểm thử tự động và workflow CI riêng. Chưa push/tạo PR trong bản ghi này                                                                                 |

## Các kiểm thử đã thực thi

- `node --test scripts/backup/backup.test.mjs`: **9/9** qua. Crypto round-trip,
  khóa sai, ciphertext/manifest bị sửa, file thiếu, nguồn dump lỗi, input an toàn,
  restore không nhận đích ghi đè DB chính.
- `VEXGO_BACKUP_DOCKER_TEST=1 node --test scripts/backup/docker-smoke.test.mjs`:
  **1/1** qua, MySQL thật trong các container fixture riêng. Xác minh Unicode,
  khóa ngoại, view, routine, event scheduler OFF, source không đổi, mirror được
  xác thực, retention giữ bản mới và bỏ qua partial/file lạ, khóa sai không tạo
  container restore, mirror lỗi không kích hoạt xóa bản chính.
- Windows PowerShell 5.1 runner: lượt thành công trả **exit 0**, source không tồn
  tại trả **exit 1**. Không có mật khẩu trong tham số CLI/log.
- Export Task Scheduler preview: **exit 0**; chưa cài lịch chạy hằng ngày.
- Workflow GitHub mới chưa chạy trên remote; không gọi kết quả local là CI xanh.

## Bản sao thực tế và evidence

Nằm ngoài repo tại `mobile-qa-evidence/backup-restore-20261103/` trong workspace:

- `backups/vexgo-backup-2026-11-03T08-08-29-362Z-36b15ef4/`: bản cuối đã dùng để thử restore, ghi cả charset/collation và hash các file công cụ.
- `backups/.../restore-report-1793693360661.json`: kiểm tra DB thật, ghi rõ phạm vi
  đã/chưa kiểm chứng. Container `vexgo-restore-6a03aae0-5f85-4e6e-bdac-fe8cccd2f776`
  đã dừng sau kiểm tra để tiết kiệm tài nguyên, volume riêng còn giữ để xem xét.
- `logs/`, `task-preview.xml`: evidence trình chạy lịch Windows.
- `archive-tests-final.log`, `docker-smoke-final.log`, `backup-final.log`, `restore-final.log`: kết quả các lượt chạy cuối.
- `mirror-test-same-disk/`: bản copy thử đã xác thực, **cùng ổ đĩa**, không phải offsite.
- `private/backup.key`: khóa nhị phân có ACL riêng, không commit, không gửi qua chat.

Lần restore đầu dừng vì image nguồn không có executable `mysqlcheck`; đã sửa dùng
SQL `CHECK TABLE` và thử lại thành công. Container lỗi được xóa kèm volume riêng.

## Việc còn lại trước khi coi là bảo vệ toàn hệ thống

1. Người dùng xác nhận ngày 03/11/2026: dự kiến lưu ảnh/tệp trên Cloudinary nhưng hiện chưa tích hợp. Vì vậy chưa cần kết nối Cloudinary trong đợt backup DB này; khi tích hợp phải bổ sung cách sao lưu/khôi phục tài nguyên và liên kết DB, không coi URL là bản sao file. Snapshot khảo sát có 0 `TepDinhKem`, 60
   `HinhAnhHangHoa` đều trỏ host `images.unsplash.com`, 0 tin nhắn có attachment; số record không chứng minh file còn
   tồn tại hoặc đã có bản sao. Chưa tải/sao chép URL từ DB.
2. Chọn chỗ lưu bản thứ hai ngoài máy và bảo quản bản khóa riêng; không coi thư mục
   mirror thử cùng ổ là chống mất máy/hỏng ổ.
3. Sau khi code được review và đặt ở đường dẫn vận hành ổn định, đăng ký task hằng
   ngày. Máy cần đăng nhập và Docker chạy; theo dõi lỗi/LastTaskResult. Cảnh báo
   email, chính sách retention mirror và log chưa triển khai.
4. Nếu cần diễn tập phục hồi dịch vụ: chuẩn bị cấu hình Backend riêng, chặn gửi
   email/push/webhook, kiểm tra các luồng API thật. Công cụ hiện tại chủ động không
   mở mạng/cổng của container restore và không chuyển kết nối DB chính.
5. Khôi phục DB chính và đối soát thanh toán cần kế hoạch riêng được lead xác nhận.
   Không có thao tác tự động ghi đè DB chính trong đợt triển khai này.

## Giới hạn kiểm tra graph

Đã gọi GitNexus impact trước khi thêm code, nhưng chưa có symbol backup và index
của checkout chính cũ hơn 61 commit: UNKNOWN, không phải all-clear. Text search
xác nhận chưa có công cụ backup/restore trong source. Worktree mới chưa có index;
lượt analyze không trả kết quả và đã dừng, detect-changes báo repository chưa được
đăng ký. Không lấy graph của worktree khác để kết luận diff này an toàn. Chưa commit;
không sửa hàm API hiện có, package/dependency, schema hay workflow CI cũ.

## Cập nhật tích hợp Cloudinary giai đoạn 1

Ngày 03/11/2026: đã triển khai module ảnh xe Cloudinary tại nhánh riêng
`feature/cloudinary-vehicle-media` (worktree `vexgo_cloudinary_media_worktree`).
Upload/readback/CDN và folder môi trường/tenant/xe đã được thử thật trên DB riêng.
Migration registry chưa áp dụng DB chính, UI chưa nối. Các bản backup DB trước
thay đổi này chưa có registry mới. Sau khi apply migration, cơ chế full DB backup
sẽ lấy thêm bảng registry tự động. Binary/version tài nguyên Cloudinary chưa được
sao lưu độc lập; vẫn cần job file backup và restore drill riêng. Xem
`docs/CLOUDINARY_IMPLEMENTATION_PROGRESS.md` trong worktree Cloudinary để biết
bằng chứng và phạm vi chính xác.

## Hoàn thiện backup file Cloudinary theo DB snapshot

Đã triển khai ở cùng nhánh backup/restore, tách khỏi PR #57:

- Dùng registry từ DB snapshot đã restore cách ly, không lấy danh sách ảnh từ DB live.
- Xác minh account/folder/asset ID/version/context/ETag, tải file thật và mã hóa AES-GCM.
- Manifest media ràng buộc ID/hash SQL. Không công bố gói full nếu chỉ có SQL;
  media lỗi thì quarantine .partial, không mirror/retention.
- Verify/mirror/retention bao gồm cả DB và ảnh. Đọc được định dạng DB-only cũ.
- Restore ảnh thật vào vexgo/test/restores/<UUID>/..., đối chiếu SHA-256 byte-for-byte,
  relink metadata bằng transaction/CAS trong MySQL riêng rồi đọc lại để kiểm chứng.
- Không áp migration hoặc đổi dữ liệu DB chính; không ghi đè/xóa file Cloudinary gốc.
  Container thử đã được dọn. Chưa commit/push/tạo PR backup, chưa bật lịch hằng ngày.

Bằng chứng thực thi:

- 16/16 unit crypto/client/record-validation test qua.
- Docker DB-only regression qua; verify lại bản DB chính 95 bảng đã tạo trước đó qua.
- Docker + Cloudinary giả lập qua, bao gồm lệnh backup gộp, mirror, quarantine lỗi,
  chặn file hỏng trước upload, retention và transaction relink.
- Cloudinary thật + MySQL fixture riêng: backup file, restore Cloudinary, CDN readback
  khớp hash, relink DB riêng, mirror/retention qua. Không phải Mobile/Web UI E2E.
- Lệnh backup gộp với Cloudinary thật đã chạy riêng và verify cả bản chính/mirror qua.

Evidence ngoài Git: mobile-qa-evidence/backup-restore-20261103/:
archive-media-final.log, database-regression-after-media.log,
cloudinary-smoke-mock-final.log, cloudinary-smoke-live-final.log,
cloudinary-cli-live.log. Bộ live được giữ tại
mobile-qa-evidence/cloudinary-backup-20261103/vexgo-media-bundle-9DbFkh/:
live-restore-report.json (VERIFIED), cli-live-result.json, các gói mã hóa và khóa
ở thư mục private tách riêng. Mirror thử vẫn cùng ổ, không phải offsite.

Trước rollout: PR #57 phải có registry trên DB nguồn; chọn nơi lưu ngoài máy và
bảo quản khóa riêng; xác nhận lịch và quyền vận hành. Chỉ hỗ trợ gallery WebP công
khai của PR #57, không nhận tệp chat/avatar riêng tư hoặc URL mẫu ngoài registry.
Giới hạn/commands ở CLOUDINARY_BACKUP_RESTORE.md. Kết quả cập nhật này bổ sung cho
snapshot khảo sát ban đầu ở trên; các ghi chú "chưa sao lưu binary" trước đó là
trạng thái lịch sử, không phải trạng thái mã hiện tại.

## Chuẩn bị PR ngày 04/11/2026

Đã fetch develop, base vẫn là 713d775. PR #57 còn mở; DB-only dùng độc lập,
chế độ media cần registry của PR #57 được triển khai trước. Chạy lại 16/16 unit
và hai suite Docker (DB-only, DB + Cloudinary mock): đều qua.

Đã refresh GitNexus ngay tại worktree này và kiểm tra staged diff: 15 file,
241 symbol, 17 process, risk CRITICAL, không partial/truncated ở kết quả diff.
Các process được báo gồm backup/restore, xác thực manifest, giải mã, checksum và
kiểm tra đường dẫn. Toàn bộ graph vẫn có giới hạn suy luận/ngân sách trace, nên
không dùng việc thiếu process làm bằng chứng không ảnh hưởng. Ghi chú index chưa
được tạo ở phần khảo sát ban đầu là lịch sử, đã được cập nhật ở bước này.

Kiểm tra staged diff không có Cloudinary API Secret; credential, khóa và archive
không được đưa lên Git. Chỉ tạo PR review, không cài lịch hoặc triển khai DB chính.
