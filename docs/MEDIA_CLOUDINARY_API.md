# Cloudinary media — giai đoạn 1: ảnh xe công khai

## Phạm vi và triển khai

- Worktree `vexgo_cloudinary_media_worktree`, branch `feature/cloudinary-vehicle-media`,
  base develop `713d775`. Backend NestJS dùng chung Web/Admin/Flutter.
- Đã làm provider Cloudinary, validation, registry DB, API gallery ảnh xe. Chưa sửa
  UI Admin/Customer Web/Flutter, chưa tích hợp avatar/branding/file chat/ảnh hàng.
- Mặc định `CLOUDINARY_ENABLED=false`. API khởi động được khi chưa có Cloudinary.
  Cấu hình thật ở Backend, mẫu trong `.env.example`; xem `CLOUDINARY_LOCAL_SETUP.md`.
- Migration thêm **một bảng** `TaiNguyenMedia`; không đổi cột/giá trị dữ liệu cũ,
  không reset/seed. Chưa áp dụng lên DB chính; phải review rồi backup và deploy
  migration trước khi chạy bản API mới trên DB chung.

## Folder và phạm vi tài nguyên

```text
vexgo/<dev|test|prod>/bus-companies/<tenantId>/vehicles/<vehicleId>/<UUID>
```

Backend lấy tenant từ phiên đã xác thực, kiểm tra xe thuộc tenant rồi mới tạo
reservation/upload. Client không được gửi folder, cloud_name, public_id hoặc URL
thay cho file. Không đưa biển số, tên khách, email, SĐT vào tên file.

Dynamic mode dùng `asset_folder` cùng full `public_id`; fixed mode dùng `folder`
và UUID cuối đường dẫn. Đối chiếu cả folder thực và public_id khi kiểm thử.
Không di chuyển/đổi tên tài nguyên từ Console sau khi có liên kết DB. Folder không
phải ACL: ảnh xe này công khai, không được dùng API này để gửi giấy tờ hoặc tệp chat.

## Contract API

Prefix `/api/v1`, envelope `{ data: ... }` theo chuẩn hiện có.

| Method | Endpoint                                               | Quyền                                                         |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| GET    | `/media/vehicles/:vehicleId/images`                    | Public; chỉ SAN_SANG, nhà xe hoạt động                        |
| GET    | `/media/vehicles/:vehicleId/images/manage`             | Tenant + `vehicle:read`, xe thuộc tenant                      |
| POST   | `/media/vehicles/:vehicleId/images`                    | Tenant + `vehicle:update`, multipart                          |
| POST   | `/media/vehicles/:vehicleId/images/:mediaId/reconcile` | Tenant + `vehicle:update`, chỉ đọc Cloudinary rồi xác nhận DB |
| DELETE | `/media/vehicles/:vehicleId/images/:mediaId`           | Tenant + `vehicle:update`, gỡ liên kết, trả 204               |

SUPER_ADMIN không được tự vượt scope nhà xe để upload. Nếu cần quản trị toàn hệ
thống, bổ sung use case/quyền riêng đã được lead chốt; không dùng tài khoản lead
để né guard.

### Upload

`multipart/form-data`, đúng hai phần:

- `file`: một file JPEG/PNG/WebP, tối đa 5 MiB. Kiểm tra byte header, giải mã thật,
  MIME khớp nội dung, không động, tối đa 20 megapixel.
- `requestId`: UUID v4 do client tạo **một lần cho một lượt chọn ảnh**, giữ khi retry.

Backend bỏ metadata, áp orientation, resize tối đa 1600x1600, không phóng to,
chuyển WebP quality 82. Không nhận URL từ xa, SVG/PDF/raw/video.
Throttling 10 request/phút theo IP/handler cho upload và reconcile, giới hạn
multipart 1 file/1 field. Hạ tầng production cần giới hạn request/rate phù hợp
reverse proxy; không lưu secret trong request log.

Ví dụ kết quả quản lý (upload trả 201, reconcile 200):

```json
{
  "data": {
    "mediaId": "83bf055f-f6c4-46b8-9270-63cfc9442aee",
    "requestId": "d568978a-1c5e-4c67-90ab-b823201098e6",
    "vehicleId": 14,
    "status": "SAN_SANG",
    "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v<version>/vexgo/dev/bus-companies/3/vehicles/14/<UUID>.webp",
    "width": 1200,
    "height": 800,
    "format": "webp",
    "bytes": 123456,
    "createdAt": "2026-11-03T00:00:00.000Z",
    "removedAt": null
  }
}
```

Public GET chỉ trả `mediaId/imageUrl/width/height/format`, tối đa 10 ảnh, không lộ
requestId, account tạo, SHA, Cloudinary API key/secret hoặc asset registry nội bộ.
Manage GET trả tối đa 100 record mới nhất, gồm record đã gỡ và đang chờ. Chưa có
phân trang lịch sử đầy đủ; không dùng màn này như audit export toàn hệ thống.

## Idempotency, timeout và gỡ ảnh

```text
DANG_TAI -> SAN_SANG
    |           |
    v           v
CHO_DOI_SOAT -> DA_GO
```

- Transaction khóa row `Xe`, kiểm tra số lượng và tạo reservation; Cloudinary call
  luôn ở ngoài transaction. Tối đa 10 record active gồm DANG_TAI/CHO_DOI_SOAT/SAN_SANG.
- Cùng tenant/requestId/xe/hash đã SAN_SANG: trả lại record, không upload tiếp.
  Khác xe/hash: 409 MEDIA_REQUEST_REUSED. Đang chờ hoặc đã gỡ: 409
  MEDIA_REQUEST_PENDING_OR_REMOVED, không cấp lượt upload mới từ requestId cũ.
- Timeout/provider error sau reservation: **409 MEDIA_UPLOAD_UNCERTAIN**. DB link
  lỗi sau upload: **409 MEDIA_LINK_UNCERTAIN**. Giữ requestId và input, mở manage
  để tìm record theo requestId, gọi reconcile trên mediaId. Không auto tạo UUID mới.
- Với network failure/mọi 5xx bất kỳ, cũng coi kết quả chưa xác định cho tới khi
  kiểm tra lại. Không suy ra "chưa tạo" rồi POST với requestId mới.
- Reconcile không upload lại, không tự coi provider 404 là không tồn tại vĩnh viễn:
  upload trước có thể còn đang hoàn tất. Giữ record chờ, retry có giới hạn hoặc hỗ trợ.
- Provider chưa cấu hình/lỗi đọc lại trả 503 được global filter chuẩn hóa
  `SERVICE_UNAVAILABLE`; không phụ thuộc mã nội bộ của provider trong UI.
- Bad file 400, quá dung lượng 413; 413 từ multipart có thể mang mã chung HTTP_ERROR,
  UI dùng HTTP status để hiển thị giới hạn 5 MiB. Không ghi raw provider error ra client.
- DELETE là **gỡ khỏi xe**, không xóa file Cloudinary. Compare-and-set khi attach
  ngăn callback chậm/reconcile đưa ảnh đã gỡ trở lại danh sách công khai.
- Xe hoàn toàn chưa có ràng buộc nghiệp vụ vẫn xóa được theo API cũ: FK gallery
  cascade xóa các liên kết của xe, không gọi Cloudinary destroy. Không nới quy tắc
  xóa xe đã có chuyến/vé. Bản backup DB cũ vẫn chứa xe và các liên kết cũ.

## Database và backup

Registry lưu owner tenant/xe, request ID, hash file gốc, cloud name, public ID,
immutable asset ID, version, URL, định dạng, kích thước, trạng thái và timestamps.
Composite FK `(nhaXeId, xeId)` ngăn liên kết ảnh sang xe nhà xe khác. Unique
`(nhaXeId, yeuCauId)` chặn duplicate requests; CHECK constraints bảo vệ trạng thái và
metadata khi SAN_SANG. Tạo bảng mới không yêu cầu migrate lại dữ liệu ảnh mẫu cũ.

Ảnh có UUID riêng, `overwrite=false`, URL có version. Provider yêu cầu `backup=true`
cho upload, nhưng **chưa diễn tập restore tài nguyên Cloudinary**, không coi đó là
bản sao độc lập ngoài nhà cung cấp. Không có job purge/xóa vật lý trong giai đoạn này.

Backup DB hiện có sẽ chứa registry sau khi migration được áp dụng. Để bảo vệ toàn
hệ thống còn phải làm job sao lưu binary/version Cloudinary và manifest tương ứng
với snapshot DB, mã hóa và giữ bản thứ hai ngoài máy. Cần chốt retention trước khi
thêm purge; không xóa file mà backup DB còn tham chiếu. Giữ Cloudinary asset cũ là
điều kiện để restore DB cũ vẫn hiển thị ảnh, chưa thay thế backup file.

## Gợi ý nối UI ở đợt tiếp theo

- Admin: gallery trong quản lý xe; upload file với requestId, khóa gửi trùng,
  lỗi giữ lựa chọn, hiển thị pending/uncertain và nút kiểm tra; nhãn gỡ ảnh rõ nghĩa.
- Web/Mobile: GET danh sách ảnh thật theo vehicleId để hiển thị chi tiết xe;
  empty/error state rõ, không thay ảnh mẫu cũ thành dữ liệu thật giả định.
- Không truyền secret/token qua URL. Mobile cần multipart có phiên hiện tại và
  kiểm tra session trước/sau request; xóa dữ liệu quản lý của phiên cũ khi logout.
- Chưa có sửa thứ tự, đặt ảnh bìa hoặc thao tác thay ảnh nguyên tử trong API đợt này.
  Không tự thêm các hành vi đó chỉ ở UI.

## Kiểm thử đã làm

- Unit validation, provider, lifecycle và HTTP contract/real authorization guard.
- Regression quyền quản lý xe hiện có.
- MySQL riêng: deploy toàn bộ migrations từ đầu, metadata/idempotency, tenant FK,
  CHECK chống ready thiếu metadata, 12 requests đồng thời chỉ 10 thành công,
  xóa xe chưa dùng không bị gallery chặn.
- Cloudinary thật + DB riêng + CDN: upload/readback, folder/publicId/context hash,
  tải ảnh HTTP 200 WebP đúng kích thước, public listing rồi gỡ liên kết.
- Không gọi kết quả này là Mobile/Web UI E2E hoặc JWT login E2E. DB chính chưa đổi.
  Evidence local: `mobile-qa-evidence/cloudinary-20261103/` ngoài repo.
