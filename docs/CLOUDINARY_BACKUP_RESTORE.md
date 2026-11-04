# Backup/restore DB và ảnh Cloudinary theo cùng snapshot

## Phạm vi

Mở rộng công cụ DB backup ở `scripts/backup/`, không thêm API hoặc migration.
Dùng contract registry ảnh xe `TaiNguyenMedia` của Backend PR #57. PR #57 chưa
được triển khai lên DB chính thì DB đó chưa đủ điều kiện bật full media backup.
DB-only backup cũ tiếp tục dùng được, không cần cấu hình Cloudinary.

Đợt này sao lưu **file WebP công khai của gallery ảnh xe**, gồm ảnh sẵn sàng và
ảnh đã gỡ nhưng có định danh/version đầy đủ trong snapshot. Không coi URL trong
DB là file backup. Không sao lưu URL mẫu Unsplash, file avatar/chat riêng tư hoặc
tài nguyên ngoài registry; nếu contract thay đổi phải mở rộng công cụ trước khi
gọi đó là backup toàn hệ thống.

## Tính nhất quán

1. Backup SQL bằng transaction snapshot như công cụ hiện có; gzip + AES-256-GCM.
2. Authenticated manifest ghi `mediaRequired=true`, môi trường Cloudinary và ID/hash
   SQL. Chưa gọi gói đó là hoàn tất chỉ vì SQL đã xuất xong.
3. Restore SQL vào container MySQL mới, network none, không host port, events OFF.
   Đọc registry từ **DB phục hồi này**, không đọc registry đang thay đổi ở DB chính.
4. Kiểm tra cloud name, environment, tenant/vehicle folder, public ID, immutable asset
   ID, version, original-input SHA context. Trạng thái đang tải/chờ đối soát làm
   job thất bại, yêu cầu xử lý trước; không đoán rằng ảnh chưa tồn tại.
5. Tải byte gốc WebP từ URL Cloudinary do công cụ dựng, không fetch URL tùy ý từ
   DB/API/archive. Yêu cầu metadata/ETag, dùng If-Match, kiểm tra ETag, MIME, số byte,
   WebP header và SHA-256. Nếu version/folder đã đổi thì dừng, không thay ảnh mới vào
   bản DB cũ một cách im lặng.
6. File ảnh và checksum đóng thành JSONL stream, gzip + AES-GCM cùng cơ chế crypto
   DB; manifest media được xác thực và ràng buộc với ID/hash SQL. Không ghi ảnh
   plaintext lên đĩa. Mỗi file tối đa 5 MiB, xử lý tuần tự để giới hạn RAM.
7. Chỉ sau khi giải mã/xác thực cả SQL và media thành công mới mirror và retention.
   Media lỗi: chuyển gói về `.partial-*`, trả lỗi và giữ bản sao cũ.

Ảnh có UUID, Backend dùng overwrite=false. Không đổi tên/di chuyển/ghi đè/xóa
thủ công ảnh đang được DB hoặc backup tham chiếu. File đã mất trước lần backup
đầu tiên hoặc Cloudinary version bị thay đổi không thể tự tái tạo từ URL: job sẽ
báo lỗi. Cơ chế này không thay thế các quy định giữ version/file phía Cloudinary.

## Cách chạy

Điều kiện: migration PR #57 đã có ở DB nguồn; Cloudinary credential đúng tài khoản
và env file riêng được bảo vệ; không chạy DDL/migration khi backup. Không đưa secret
vào Git, argv hoặc JSON config của scheduler.

```powershell
# DB + file Cloudinary, ví dụ môi trường dev:
node --env-file=C:/Users/HP/.vexgo-private/cloudinary.env scripts/backup/vexgo-backup.mjs backup --source vexgo_web-mysql-1 --out D:/VexGoBackups/database --key C:/Users/HP/.vexgo-private/backup.key --cloudinary-environment dev --mirror E:/VexGoBackups/database --keep 7

# Verify offline, không cần Cloudinary credentials:
node scripts/backup/vexgo-backup.mjs verify --backup D:/VexGoBackups/database/<backup-id> --key C:/Users/HP/.vexgo-private/backup.key

# Thử restore file + cập nhật liên kết trong DB riêng:
node --env-file=C:/Users/HP/.vexgo-private/cloudinary.env scripts/backup/cloudinary-bundle.mjs restore-test --backup D:/VexGoBackups/database/<backup-id> --key C:/Users/HP/.vexgo-private/backup.key
```

Cấu trúc một gói hoàn tất:

```text
vexgo-backup-<timestamp>-<suffix>/
  manifest.json                  # yêu cầu media và ràng buộc SQL
  database.sql.gz.enc
  media/
    manifest.json                # registry snapshot + hash SQL + hash archive
    assets.jsonl.gz.enc          # file thật + SHA-256, đã mã hóa
```

Mirror copy và verify cả hai thành phần; retention xóa nguyên gói, không tách vòng
đời ảnh khỏi DB. Mirror trên cùng ổ chỉ là thử chức năng; cần nơi lưu khác máy/ổ
vật lý và bản khóa riêng để chống hỏng/mất thiết bị. Không bỏ `--cloudinary-environment`
rồi gọi bản DB-only là bản backup file đầy đủ.

## Restore thử an toàn

- Xác thực toàn bộ archive trước khi upload file nào; không cần truy cập tài khoản
  Cloudinary nguồn nếu đã có gói đầy đủ. Credential hiện tại có thể là tài khoản
  đích khác; nguồn chỉ là metadata trong gói đã mã hóa/xác thực.
- Luôn tạo folder mới **`vexgo/test/restores/<restore-UUID>/bus-companies/<tenant>/vehicles/<vehicle>/`**,
  overwrite=false. Không có lựa chọn ghi đè ID cũ hoặc restore trực tiếp vào prod.
- Upload dùng chữ ký SHA-256 phía server; secret không đi vào manifest/log. Sau
  upload tải lại ảnh, đối chiếu SHA-256 byte-for-byte. Không tự chuyển chất lượng/
  định dạng trong lúc phục hồi; file khác byte thì coi là thất bại.
- Restore DB vào container mới do công cụ tạo, kiểm tra label/network/port trước
  mọi SQL và cleanup. Không nhận container đích do operator cung cấp. Không chạy API,
  SMTP, push hoặc webhook trong container này.
- Sau khi tất cả ảnh đã xác minh, cập nhật cloud/public ID/asset ID/version/URL
  bằng transaction có compare-and-set; nếu số record không khớp thì rollback.
  Đọc lại liên kết từng record để xác minh. Không thay trạng thái vé/đơn/thanh toán.
- `media-restore-<UUID>.json` ghi mapping cũ/mới và trạng thái VERIFIED; trạng thái
  khác VERIFIED không phải khôi phục hoàn tất. Giữ report để xử lý kết quả không
  xác định khi mất kết nối. Không tự retry thành thao tác ghi đè.
- Container DB thử được dọn sau xác minh; file Cloudinary ở folder thử vẫn giữ để
  xem xét. Không tự purge Cloudinary. Restore thử chưa chứng minh UI/API đăng nhập
  hoặc đối soát thanh toán; đổi DB chính cần kế hoạch triển khai riêng.

## Scheduler và giới hạn

Trong JSON config riêng của Windows runner, sau khi rollout PR #57 có thể thêm:

```json
{
  "cloudinaryEnvironment": "dev",
  "cloudinaryEnvFile": "C:\\Users\\HP\\.vexgo-private\\cloudinary.env"
}
```

Giữ hai trường null để chạy DB-only. Scheduler không lưu secret, chỉ tham chiếu
env file. Không bật lịch mặc định trong đợt phát triển. Theo dõi exit code/log;
lỗi Cloudinary không được xem là job hoàn tất và không được dọn bản cũ.

Giới hạn hiện tại: một cloud name/môi trường cho một gói, tối đa 1.000 registry
records, mỗi file 5 MiB, ảnh WebP public từ PR #57. Admin API có quota; job trả lỗi
rõ khi 429 và không bỏ qua ảnh để báo thành công. Cần chọn lịch/quota phù hợp trước
khi mở rộng dữ liệu. Không có PITR/binlog hay tự động chuyển production.

## Kiểm thử

```powershell
node --test scripts/backup/backup.test.mjs scripts/backup/cloudinary.test.mjs
$env:VEXGO_BACKUP_DOCKER_TEST='1'
node --test scripts/backup/docker-smoke.test.mjs scripts/backup/cloudinary-smoke.test.mjs
```

CI dùng MySQL thật và Cloudinary transport giả lập, không cần credential thật.
Live test cần chủ động bật VEXGO_CLOUDINARY_LIVE_TEST=1, cung cấp reference ảnh QA
đã tồn tại qua VEXGO_CLOUDINARY_REFERENCE_FILE, nơi lưu evidence ngoài repo qua
VEXGO_MEDIA_EVIDENCE_ROOT và nạp env riêng. Live test dùng DB/container riêng và
folder test; giữ bản sao mã hóa, khóa riêng và restore mapping để kiểm tra.

Tham khảo: [Cloudinary signatures](https://cloudinary.com/documentation/authentication_signatures),
[Admin API/ETag](https://cloudinary.com/documentation/admin_api),
[Backup và version](https://cloudinary.com/documentation/backups_and_version_management).
