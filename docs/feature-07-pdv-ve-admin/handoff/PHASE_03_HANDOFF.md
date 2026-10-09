# Handoff Phase 03 — Admin list UI

**Trạng thái:** PASS — đã xác minh bằng unit/component test và API thật trên DB test riêng.
**Branch:** `feature/admin-bookings-tickets`
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`
**Commit UI P03/P04:** `33c97be5ec74e9fc8151e08f0bd9cfd8310cd717` (implementation được giao cùng commit để các link detail luôn trỏ tới route thật).

## Thay đổi

- Thêm `/booking-management` với hai tab Phiếu đặt vé/Vé, query state độc lập `b*` và `t*`, debounce search, status/date filters, sort, page/page size và reset filter.
- Gọi hai list API GET Phase 02 qua Admin API client; không dùng dữ liệu fixture làm nguồn runtime.
- Thêm sidebar/route access theo `booking:read`; Super Admin không nhận quyền này mặc định.
- Có trạng thái loading, error/retry, empty/no-match; keyboard tabs, debounce, stale-response protection và mobile card layout.
- Link từ danh sách mở route booking/ticket detail thật; phần route được giao nguyên tử cùng P04 để không có giai đoạn link tới trang 404.

## Kiểm tra

- Admin targeted Vitest — 5 files, 33 tests passed, gồm query URL state, access control, keyboard tab, search/filter/sort, pagination, loading/error và detail rendering.
- Admin lint — PASS.
- Admin typecheck — PASS.
- Admin production build — PASS; manifest có list và hai dynamic detail route.
- API DB integration — 2 files, 10 tests passed trên `vexgo_feature07_test`.
- Browser smoke dùng API thật trỏ tạm tới `vexgo_feature07_test`: đăng nhập tenant admin, mở list phiếu và list vé; dữ liệu hiển thị khớp fixture trong MySQL.
- Visual: list và detail được xem ở 1440×900 và 375×667; mobile document width không vượt viewport. Semantic snapshot xác nhận tablist, table/card list, headings, regions, labels và named links.
- Fixture tạo bằng Prisma trong test DB đã đăng xuất và được dọn theo marker; cuối kiểm tra app/test DB không còn account, booking hoặc vé fixture.
- Không chạy seed/reset/drop. Không sửa Customer flow.

## Môi trường trình duyệt

Next.js 16 dev server được chạy bằng CLI `next dev --hostname 127.0.0.1 --port 3002`. Bind hostname rõ ràng giúp tải dev resources trên origin 127.0.0.1 mà không sửa `next.config.ts` hoặc script port Git-tracked.
