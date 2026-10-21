# Handoff sửa Finding F4 — Feature 07

**Trạng thái:** Đã sửa và kiểm tra local; chờ reviewer xác nhận PASS.<br>
**Branch:** `feature/admin-bookings-tickets`<br>
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`<br>
**Baseline SHA:** `e4837f3a40184c651dc73319e77bbc387e1d28ff`

## Nguyên nhân

`changeDateRange()` trước đây ghi trực tiếp vào URL state. Khi hai ngày bị đảo, handler xóa ngày đối diện rồi vẫn phát sinh request theo một mốc ngày, làm kết quả rộng hơn ý định người dùng. Các date input còn đặt `min`/`max` chéo nhau nên hành vi chọn ngày có thể xung đột với thông báo lỗi cần hiển thị.

## Giải pháp

- Tách draft của bốn trường ngày theo từng tab khỏi bộ lọc đã áp dụng trên URL/API.
- Khi khoảng ngày đảo, giữ nguyên cả hai giá trị trong form, đánh dấu hai input bằng `aria-invalid`, liên kết thông báo lỗi bằng `aria-describedby`, và thông báo rõ kết quả hiện tại vẫn theo bộ lọc ngày hợp lệ trước đó. Không ghi URL và không gọi API cho draft sai.
- Khi sửa thành hợp lệ (kể cả hai ngày bằng nhau) hoặc xóa một đầu mốc, áp dụng hai giá trị draft vào tab đang dùng và đặt page về 1.
- Khi xóa bộ lọc, chỉ xóa draft của tab đang dùng. Khi browser back/forward, khôi phục draft từ URL được duyệt; deep link có khoảng ngày đảo được canonicalize về state an toàn.
- Bỏ `min`/`max` ngày chéo nhau để native date input không cản trở thao tác sửa khoảng ngày.

## Files thay đổi

- `apps/admin/src/features/booking-management/components/booking-management.tsx`
- `apps/admin/src/features/booking-management/components/booking-management.module.css`
- `apps/admin/test/booking-management.spec.tsx`
- `apps/admin/test/booking-management-query.spec.tsx`
- `docs/feature-07-pdv-ve-admin/handoff/FIX_F4_HANDOFF.md`

## Kiểm tra

### RED trước khi sửa

- `npm run test --workspace @vexgo/admin -- test/booking-management.spec.tsx` — 12 test mới thất bại và 13 test cũ pass. Các lỗi tái hiện việc mất một mốc, không có accessible error, và update URL/request ngoài ý muốn.

### GREEN sau khi sửa

- `npm run test --workspace @vexgo/admin -- test/booking-management.spec.tsx test/booking-management-query.spec.tsx` — 2 files, 32 tests pass.
- `npm run test --workspace @vexgo/admin` — 50 files, 387 tests pass.
- `npm run lint --workspace @vexgo/admin` — pass.
- `npm run typecheck --workspace @vexgo/admin` — pass.
- `npm run build --workspace @vexgo/admin` — pass.
- `npx prettier --check apps/admin/src/features/booking-management/components/booking-management.tsx apps/admin/src/features/booking-management/components/booking-management.module.css apps/admin/test/booking-management.spec.tsx apps/admin/test/booking-management-query.spec.tsx` — pass.
- `git diff --check` — pass.

## Self-review và giới hạn

- Component tests bao phủ hai hướng khoảng ngày đảo, Ngày đặt/Ngày khởi hành, cả hai tab, giữ hai ngày, accessible error, không fetch/URL mutation khi sai, sửa về ngày bằng nhau, xóa một đầu mốc, reset, cô lập tab, back/forward và deep link canonicalization không lặp URL.
- Thay đổi chỉ ở Admin Feature 07; không đổi API contract, nghiệp vụ, database hay migration.
- GitNexus index không có worktree Feature 07; impact trên index `develop` trả `risk: UNKNOWN` vì không thấy symbol `changeDateRange`. Đã kiểm tra trực tiếp trong worktree: bốn callsite đều là date input trong component đang sửa.
- Visual review tại 1440×900 và 375×667 **chưa thực hiện được**: cổng Admin `3002` và API `4001` không lắng nghe, Chrome trả `ERR_CONNECTION_REFUSED`; không có runtime xác thực read-only để render trang. Không có screenshot được cung cấp.
- Finding F4 chờ reviewer xác nhận PASS. Các finding khác ngoài phạm vi handoff này.
- Commit SHA sẽ được báo sau khi tạo commit.
