# Phase 03 Spec — Admin List UI: Hai tab Phiếu đặt vé & Vé

**Feature:** 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)  
**Trạng thái:** Spec triển khai; **phụ thuộc Phase 02 API thật đã pass**.  
**Tham chiếu:** `MASTER_SPEC.md`, `PHASE_02_ADMIN_READ_APIS.md`, handoff Phase 01/02, Admin `AGENTS.md` + `DESIGN.md`.

## 1. Goal

Tạo **một trang quản lý** với 2 tab `Phiếu đặt vé` và `Vé` trên `/booking-management`; danh sách thực từ Admin GET APIs Phase 02 với search/filter/sort/page và URL state. Trang chỉ đọc, không tạo/hủy/sửa vé hoặc mở Customer cancellation.

## 2. Các file/khu vực cần inspect

- `apps/admin/src/features/admin-auth/services/{admin-access.ts,admin-scope.ts}`, `components/admin-session-guard.tsx`, `super-admin-layout/components/super-admin-layout.tsx`.
- `apps/admin/src/components/{admin,ui,data-filters}/`, `src/styles/admin-components.css`, `src/styles/admin-tokens.css`, `apps/admin/DESIGN.md` và `apps/admin/AGENTS.md`.
- Một page management có pagination/filter thật đã có, ví dụ `features/fare-prices`, `features/trips` và `apps/admin/src/app/trips/page.tsx`; không copy CSS pattern mà đã có shared.
- `apps/admin/src/lib/admin-api-client.ts`, `getApiBaseUrl()` và backend response/error contract Phase 02.

## 3. Routes, RBAC và điều hướng

- `apps/admin/src/app/booking-management/page.tsx`; `tab=bookings` (default), `tab=tickets`.
- Sidebar một mục **Quản lý phiếu đặt vé & vé** ở scope tenant, chỉ khi session có `booking:read`. Route guard `getRequiredAdminPermissions('/booking-management')` yêu cầu quyền trên cho cả trang list và các routes con (Phase 04). `SUPER_ADMIN` và Customer không thấy menu/không vào tenant page.
- Không tạo page detail trống/link chết. Nếu Phase 03 chưa có detail của Phase 04: link chi tiết chỉ bật khi route thật được triển khai hoặc đồng thời tạo placeholder có trạng thái rõ ràng; ưu tiên triển khai cùng transition kế tiếp để không ship link chết. Không tạo dữ liệu mock cho UI production.
- Role/permission UI là cải thiện UX, **backend guard là security boundary**. Khi revoke quyền/đổi tenant/logout, không giữ lại dữ liệu cũ trong view/cache.

## 4. Server-side filtering và URL state

Tab Phiếu và Tab Vé có **filter độc lập**:

- `search`: mã phiếu/vé, tên khách, số điện thoại (debounce hợp lý + nút clear/reset; không tải dropdown toàn bộ khách).
- `status`: đúng domain của từng tab, giá trị đến từ catalog/status contract đã audit.
- `bookedFrom`, `bookedTo`: date picker dạng date-only; `departureFrom`, `departureTo` tương tự; validate from <= to trước khi gửi và hiển thị lỗi 400 server.
- `page`, `pageSize`, `sortBy`, `sortDirection`. Sắp xếp cột có affordance và `aria-sort`; reset page=1 khi đổi các filter khác.
- Khi đổi tab **không mất filter/sort/page của tab kia**; forward/back, refresh, link copy/paste phải render đúng tab và query. Có thể dùng query key namespaced (ví dụ `bSearch/bPage/bStatus` và `tSearch/tPage/tStatus`) trên URL; khi gọi từng API map thành các key `search`, `page`, `status` chuẩn Phase 02. Nếu dùng cách khác phải viết test chứng minh việc giữ hai state độc lập và tính đồng bộ URL.
- URL query không được chứa token/secrets. Sanitize malformed/unknown parameters, tránh vô hạn navigation/URL-sync loop. Search/filter/pagination gửi API chỉ chứa params được định nghĩa; không client-side lọc page hiện tại giả thành lọc toàn hệ thống.

## 5. Bảng dữ liệu

**Tab Phiếu:** mã phiếu, khách hàng/SĐT, ngày đặt, chuyến xe (tuyến + ngày khởi hành), tổng số vé và số vé đã hủy, `PhieuDatVe.trangThai`, nhãn "Hủy x/y vé" nếu partial, số tiền vé ban đầu, link xem chi tiết.

**Tab Vé:** mã vé, mã phiếu, khách/SĐT, chuyến (tuyến + ngày giờ), ghế, giá thực tế, `Ve.trangThai`, link chi tiết.

- Phân biệt trạng thái phiếu, vé, đơn giao dịch; không biến trạng thái payment thành status vé.
- Date/time theo `BUSINESS_TIME_ZONE` và định dạng nhất quán. Tiền VND đúng định dạng; null/unknown hiển thị `—` hoặc nhãn rõ, **không** mặc định giá `0` khi dữ liệu thiếu.
- Status badge/format responsive dùng shared components, status mapping đúng từ API; không tạo class/button/pagination tương đương nếu đã có shared.
- Hiển thị `totalItems` từ `meta` scoped; no hard-coded demo counts.

## 6. Loading, errors, accessibility và responsive

- Skeleton khi load lần đầu, loading nhẹ cho fetch tiếp; không giật về dữ liệu cũ của tenant khác khi đổi principal.
- Empty DB khác với no matches filter; trong no matches có thao tác xóa filter.
- Lỗi mạng/500 có Retry; 401 theo session refresh flow hiện có; 403 trình bày thiếu quyền và clear sensitive data; 404 của detail sẽ thuộc Phase 04.
- Hỗ trợ abort/cancel request cũ, tránh stale response ghi đè kết quả mới khi nhập search nhanh hoặc đổi tab/page.
- Desktop `1440x900`: readable table + sticky/scroll đúng patterns; Mobile `375x667`: card hoặc overflow có chủ đích, **không page-level horizontal overflow**, thao tác đủ vùng chạm và có label.
- Keyboard chuyển tab, focus indication, semantic tabs (`role=tablist`, `aria-selected`, panels...) nếu shared equivalent; search input có accessible label; sort công bố hướng sort; skeleton/error dùng aria phù hợp.
- Sử dụng `ui-ux-pro-max` để audit nếu có, nhưng `DESIGN.md` + shared design primitives là ưu tiên cao nhất.

## 7. Tests tìm bug thật

1. Admin có `booking:read` thấy đúng một sidebar item, cả hai tab; user thiếu quyền/SUPER_ADMIN không thấy và truy cập direct URL cũng bị chặn.
2. Search cả bốn loại dữ liệu mapping sang API; filter trạng thái mỗi tab đúng enum; date range `from/to` đúng; page/sort/pageSize truyền đúng và UI hiển thị meta thực.
3. Bắt đầu tab phiếu có filter A/page 3, đổi vé filter B/page 2, quay lại phiếu vẫn A/page 3. Refresh/back/forward/deep link vẫn đúng; invalid tab về default an toàn.
4. Đổi filter reset page của **tab đang active** nhưng không reset tab kia. Sort cùng timestamp không tạo trùng hàng khi page change (kiểm tra API integration ở Phase 02).
5. Request A chậm rồi request B nhanh; response A không ghi đè UI B; đổi account/tenant không render stale data từ account trước.
6. API 401/403/500, empty/no matches, retry. Không dùng fixture/mock ở runtime; unit/component test có thể stub HTTP **để kiểm tra UI state**, nhưng phải có integration chứng minh API thật ở Phase 02/05.
7. Desktop/mobile visual; tab keyboard, aria-sort, label, focus. Test link sang detail tồn tại khi giao cho user.

## 8. Completion và handoff

- Phase 02 API thật ở database feature đã được xác nhận; không tạm thay bằng JSON mock.
- Targeted Admin tests, typecheck, lint, build và `git diff --check`; nếu thay shared component, chạy tất cả target tests liên quan shared.
- Không sửa script tracked port 3001. Chạy Admin local theo `ENVIRONMENT_WORKTREE.md` port **3002**, API **4001**, DB riêng.
- Self-review tránh copy-paste CSS/primitives, dead code, excessive fetching, PII leak và regression của menu các features khác.
- Commit local Conventional Commits, handoff `handoff/PHASE_03_HANDOFF.md` có routes, query state contract, test counts, visual evidence/báo cáo viewport, SHA, blocker cho Phase 04.
