# Cấu hình Cloudinary local — không gửi secret qua chat

Đợt đầu: ảnh xe công khai, upload qua Backend. Chưa tích hợp UI Admin/Flutter,
avatar hay file chat riêng tư. Không bật unsigned upload preset.

1. Mở Cloudinary Console của tài khoản VexGo. Vào API Keys để lấy Cloud name,
   API Key và API Secret. Chỉ điền tại máy của bạn, không gửi ảnh/chụp màn hình chứa secret.
2. Mở file riêng ngoài repo tại workspace:
   `lead-handoff/cloudinary-private.env`. Điền ba trường trên, giữ
   `CLOUDINARY_ENVIRONMENT=dev` cho chạy local.
3. Kiểm tra Console Dashboard → Folder mode. Tài khoản mới thường là Dynamic
   folders: giữ `CLOUDINARY_FOLDER_MODE=dynamic`. Chỉ chọn `fixed` nếu tài khoản
   xác nhận đang dùng legacy Fixed folders.
4. Chạy lệnh tại gốc worktree `vexgo_cloudinary_media_worktree`:

```powershell
node --env-file=../lead-handoff/cloudinary-private.env scripts/cloudinary/verify.mjs
```

Lệnh này chỉ xác thực với Cloudinary, không upload/xóa ảnh hoặc sửa DB. Thành công
in `CLOUDINARY_AUTH_OK`; lỗi chỉ in mã HTTP an toàn. Không gửi nội dung file env.
Sau khi cấu hình xong báo “Cloudinary sẵn sàng”.

## Cấu trúc folder đã chốt

```text
vexgo/
  dev/
    bus-companies/<tenantId>/vehicles/<vehicleId>/<UUID>
  test/
    bus-companies/<tenantId>/vehicles/<vehicleId>/<UUID>
  prod/
    bus-companies/<tenantId>/vehicles/<vehicleId>/<UUID>
```

Tất cả đường dẫn do Backend tính từ tenant trong phiên và xe đã xác thực quyền;
không nhận folder/public_id/cloud_name từ client. Không dùng tên khách, SĐT, email
hoặc biển số làm đường dẫn. UUID tránh ghi đè giữa các lượt upload. Không tự chuyển
hoặc đổi tên folder sau khi đã có dữ liệu liên kết.

Dynamic mode: `asset_folder` xác định folder hiển thị trong Console, `public_id`
được đặt tường minh cùng prefix. Fixed mode: `folder` + UUID tạo public_id cùng
cấu trúc. Chọn sai mode có thể upload lỗi hoặc tổ chức sai folder; kiểm thử thật
phải kiểm tra cả `asset_folder` và `public_id` theo mode.

Ảnh này là công khai. Folder không phải cơ chế phân quyền file riêng tư. Khi làm
avatar hoặc chat sẽ có nhánh riêng và kiểm soát truy cập phù hợp; không đưa giấy tờ
cá nhân vào nhánh ảnh xe công khai.

## Triển khai API thật

Cấu hình mẫu trong `.env.example`; các giá trị thật chỉ ở env triển khai Backend.
Không ghi đè env hiện tại hoặc restart API chính trong lúc chuẩn bị. Migration mới
cần review và thử DB riêng trước khi áp dụng DB dùng chung. Web/Mobile không cần
Cloudinary API Secret.

Tài liệu: [Folder modes](https://cloudinary.com/documentation/folder_modes),
[Node upload](https://cloudinary.com/documentation/node_image_and_video_upload).
