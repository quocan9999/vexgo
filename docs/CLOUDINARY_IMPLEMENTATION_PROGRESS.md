# Cloudinary — báo cáo giai đoạn 1, 03/11/2026

## Kết quả

Đã triển khai Backend shared media cho **gallery ảnh xe công khai**. Worktree
`vexgo_cloudinary_media_worktree`, branch `feature/cloudinary-vehicle-media`, base
develop `713d775`. Gói thay đổi dành cho PR Backend review; chưa triển khai API mới
hoặc migration lên DB chính. Chưa sửa UI Admin/Customer Web/Flutter.

- Cloudinary xác thực thật thành công. Cấu hình thật ở file riêng ngoài repo,
  ACL tài khoản Windows; `.env.example` chỉ có biến cấu hình mẫu.
- Folder theo môi trường, tenant và xe, UUID cho tài nguyên. Xử lý đúng dynamic
  và fixed mode; đã thử thực tế dynamic mode.
- Có upload, public list, tenant management list, read-only reconcile và gỡ liên kết.
- Validate byte header + giải mã ảnh, limit 5 MiB/20 MP, bỏ metadata, WebP tối đa
  1600x1600. Không nhận URL, SVG hoặc file chat riêng tư.
- Có reservation, request ID/hash, lock row xe và tối đa 10 ảnh active; không giữ
  transaction mở khi gọi Cloudinary. CAS ngăn ảnh đã gỡ xuất hiện lại do callback chậm.
- Có migration thêm bảng `TaiNguyenMedia`, composite tenant FK, idempotency unique
  và CHECK constraints. Không đổi cột/data cũ, không reset/seed DB chính.

## Bằng chứng đã thực thi

| Kiểm tra                                                                | Kết quả                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Unit image/provider/lifecycle + HTTP + hồi quy quyền xe/rate limit auth | **43/43** qua, 6 file                                                                 |
| MySQL riêng + Cloudinary thật + CDN                                     | **4/4** qua, gồm 1 ca gọi Cloudinary thật                                             |
| Prisma validate/generate                                                | Thành công                                                                            |
| API typecheck                                                           | Exit 0                                                                                |
| API build                                                               | Exit 0, Prisma generate dùng URL giả ở process, không kết nối DB chính                |
| API lint                                                                | Exit 0; còn 7 warning sẵn có ngoài media ở bookings/stations, không sửa ngoài phạm vi |
| Tìm API Secret thực trong các file repo tracked/untracked               | Không tìm thấy                                                                        |
| GitHub CI                                                               | Chưa chạy trên remote; có workflow DB riêng, không dùng credential thật               |

MySQL test dùng container riêng publish chỉ loopback, DB tên
`vexgo_media_cloudinary_test`, migrate toàn bộ từ đầu, teardown container + volume
sau test. Fixture người dùng/xe chỉ tồn tại trong DB riêng; không gán ảnh QA vào xe
hoặc tài khoản thật ở DB chính.

Ca MySQL xác minh metadata và retry không upload trùng, FK chặn tenant khác, CHECK
chặn ready thiếu metadata, 12 upload đồng thời chỉ 10 thành công, xóa xe chưa dùng
không bị gallery chặn. Ca live xác minh upload, SDK readback, public_id/asset_folder/
context SHA, CDN trả HTTP 200 ảnh WebP đúng 4x3, public list và soft unlink.

Evidence ngoài Git: `mobile-qa-evidence/cloudinary-20261103/`:

- `targeted-final.log`: 43 test targeted.
- `mysql-cloudinary-live-final.log`: 4 test MySQL/cloud, bao gồm migration mới.
- `live-asset.json`: định danh ảnh QA, folder thực và các kiểm tra đã làm, không chứa secret.
- `typecheck-final.log`, `build-final.log`, `lint.log`.

Trong các bài HTTP cũ dùng AppModule với Prisma mock còn có log TripDepartureService
do mock không có findMany; test vẫn qua. Test HTTP media mới chỉ mount AuthModule +
MediaModule, không chạy worker lịch chuyến. Không gọi các bài mock HTTP là live E2E.

## Phạm vi bảo mật và backup

- API Secret chỉ lưu trong cấu hình riêng ngoài repo, không xuất trong tài liệu,
  log hoặc Git. Production cần credential được quản lý riêng và quy trình rotation;
  nhập secret trực tiếp tại môi trường triển khai, không trao đổi qua chat.
- Ảnh QA nhỏ được giữ trong `vexgo/test/bus-companies/1/vehicles/1/`. Không xóa file
  Cloudinary để giả lập gỡ liên kết. Không có thao tác tạo/xóa ở `prod`.
- Gỡ ảnh là gỡ hiển thị, không xóa vật lý. URL version + UUID tránh overwrite.
  Chưa làm purge hoặc diễn tập restore binary/version Cloudinary. Backup DB chứa
  registry sau khi migration được áp dụng; **chưa là backup đầy đủ tài nguyên ngoài DB**.

## Tiếp theo

1. Lead review migration và contract API trong `MEDIA_CLOUDINARY_API.md`.
2. Sau khi chốt, backup DB chính rồi apply migration và cấu hình API thực tế.
3. Nối UI gallery Admin và ảnh xe thật ở Web/Mobile; kiểm thử người dùng xuyên suốt.
4. Bổ sung job sao lưu tài nguyên Cloudinary, manifest đi cùng DB snapshot, bản sao
   ngoài máy và restore drill. Chốt retention trước khi làm xóa vật lý.
5. Avatar/ảnh hàng/chat sẽ có use case và quyền riêng; file riêng tư không dùng API
   ảnh xe công khai hiện tại.

Trước khi chuẩn bị PR đã tạo lại GitNexus index cho đúng worktree tại base
`713d775`: 20.096 nodes, 45.973 edges. Detect staged diff ghi nhận 23 file,
234 symbols và 7 execution flows, mức **HIGH**. Bản structured đầy đủ lưu ngoài
repo ở `pr-graph-full.json`, không có cờ partial/truncated ở kết quả detect.
Các flow được chỉ ra là upload, kiểm tra owner/config/metadata và attach; đã có
test bao phủ quyền tenant, retry, uncertainty/reconcile và ngăn gắn lại ảnh đã gỡ.

Analyzer vẫn có giới hạn ngân sách suy diễn execution flows toàn repo và liên
kết field giữa JavaScript/TypeScript; không lấy việc thiếu một flow làm bằng chứng
không có tác động. Đã đối chiếu schema/source và kiểm thử FK/vehicle delete bằng
MySQL. Lượt kiểm tra lại trước PR: 43 test targeted qua; 3 test MySQL qua, 1 ca
Cloudinary live chủ động skip vì không nạp credential. Bằng chứng live 4/4 trước
đó vẫn được giữ riêng; không tạo thêm ảnh chỉ để lặp lại kết quả.
