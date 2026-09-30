## 📌 Mô tả

Mô tả ngắn gọn những thay đổi trong Pull Request này.

Ví dụ:

- Thêm chức năng đăng nhập bằng email/password.
- Thêm API lấy danh sách chuyến xe.
- Fix lỗi giữ ghế sau khi hết thời gian giữ chỗ.

---

## 🔗 Related Issue / Task

Closes #

<!--
Ví dụ:
Closes #12
Fixes #15

Nếu không có Issue thì ghi:
N/A
-->

---

## 🏷️ Loại thay đổi

- [ ] ✨ Feature
- [ ] 🐛 Bug Fix
- [ ] 🔥 Hotfix
- [ ] ♻️ Refactor
- [ ] 🎨 UI/UX
- [ ] 🗄️ Database
- [ ] 📝 Documentation
- [ ] 🔧 Configuration / Chore

---

## 🛠️ Những thay đổi chính

<!-- Liệt kê các thay đổi quan trọng -->

- 
- 
- 

---

## 🧾 Các commit trong PR

<!-- Liệt kê các commit theo thứ tự từ cũ đến mới; cập nhật mục này khi push thêm commit. -->

- `hash` Mô tả commit

---

## 🧪 Cách kiểm tra

<!-- Ghi lệnh có thể sao chép và chạy từ root repo. Giữ workspace liên quan, xóa các lệnh không áp dụng. -->

Ví dụ Admin:

```bash
npm run test --workspace=@vexgo/admin
npm run typecheck --workspace=@vexgo/admin
npm run lint --workspace=@vexgo/admin
npm run build --workspace=@vexgo/admin
```

Ví dụ API:

```bash
npm run test --workspace=@vexgo/api
npm run typecheck --workspace=@vexgo/api
npm run lint --workspace=@vexgo/api
npm run build --workspace=@vexgo/api
```

Ví dụ Customer Web:

```bash
npm run typecheck --workspace=@vexgo/web
npm run lint --workspace=@vexgo/web
npm run build --workspace=@vexgo/web
```

Thao tác kiểm tra thủ công (route, viewport, dữ liệu và kết quả mong đợi):

1. 
2. 

### Kết quả mong đợi

- 

---

## 📸 Screenshots / Video

<!-- Nếu có thay đổi giao diện thì thêm ảnh/video tại đây -->

N/A

---

## ⚠️ Ảnh hưởng / Lưu ý

<!--
Ví dụ:
- Có thay đổi database schema.
- Cần chạy migration.
- Thêm biến môi trường mới.
- Có breaking change API.
-->

N/A

---

## ✅ Checklist

- [ ] Code đã chạy và hoạt động đúng ở local.
- [ ] Đã tự review code trước khi tạo PR.
- [ ] Không còn code debug / `console.log` không cần thiết.
- [ ] Không commit thông tin nhạy cảm (`.env`, password, secret, API key...).
- [ ] Đã xử lý các trường hợp lỗi liên quan.
- [ ] Đã kiểm tra không làm hỏng chức năng hiện tại.
- [ ] Đã cập nhật documentation nếu cần.
- [ ] Branch đã được cập nhật với branch đích mới nhất.

---

## 👀 Ghi chú cho Reviewer

<!-- Những phần muốn reviewer chú ý đặc biệt -->

N/A
