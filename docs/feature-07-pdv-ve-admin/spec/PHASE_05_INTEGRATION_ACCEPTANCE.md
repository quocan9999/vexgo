# Phase 05 Spec — Full Integration, Security Hardening & Acceptance

**Feature:** 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)  
**Trạng thái:** Spec nghiệm thu, không được tự tuyên bố DONE nếu chưa có bằng chứng.  
**Prerequisites:** Phase 01–04 completed, đủ handoff + commits, environment isolation còn hiệu lực.

## 1. Goal

Kiểm chứng Feature 07 thực sự hoạt động qua toàn luồng **Admin UI → Admin API → Prisma → MySQL feature DB**. Phát hiện và sửa bugs nội phạm vi Feature 07 (auth/tenancy, dữ liệu, UI, performance, race/error, tests), không kéo mutation Customer/gửi hàng vào feature hoặc viết fake test để đạt GREEN.

## 2. Preflight và review dependency

1. `git branch --show-current` phải là `feature/admin-bookings-tickets`, worktree riêng; `git status`, `git worktree list` không cho thấy code đang ghi vào root `develop`. Không hard reset/clean code sẵn có.
2. Revalidate `DATABASE_URL`, `MIGRATION_URL`, `SHADOW_DATABASE_URL`, names, port `3307`, Compose project `vexgo_feature07`; test destructive bắt buộc ở **test DB riêng** `vexgo_feature07_test` nếu harness cần seed/truncate. Không chạy test destructive trong application feature DB, tuyệt đối không dùng DB `vexgo` gốc.
3. Verify Admin `3002`, API `4001`, CORS/refresh origin đúng; không kill app/DB ở port gốc, không chỉnh tracked port scripts vì local worktree.
4. Đọc `spec/MASTER_SPEC.md`, các spec Phase 01–04 và toàn bộ handoff. Audit HEAD so với `origin/develop`: permission, schema/history và customer API có thay đổi gì mới? **Không tự merge/cherry-pick/reset** nhánh khác; ghi nhận conflicts/dependencies để người dùng quyết định nếu cần.
5. Customer authenticated cancellation + history writer là dependency độc lập; chỉ tuyên bố có end-to-end **history transition thực** nếu code đó đã merge/được xác minh. Không thêm Customer timeline. Feature 09 detail link chỉ có khi route thực tồn tại và permission đảm bảo.

## 3. End-to-end journeys bắt buộc

**Journey A — Tenant happy path:** Admin tenant A có `booking:read`, vào sidebar `/booking-management`, tìm mã phiếu/tên/SĐT, filter trạng thái và range ngày, sort/paginate, mở phiếu, link sang vé, xem timeline riêng, quay về bộ lọc cũ; refresh page, tab URL persisted. Data thực từ test fixture/API.

**Journey B — Security:** Staff A không có `booking:read` bị chặn cả UI và cả sáu API; Super Admin không vào area; Tenant A cố đọc list/search/detail/history ID của B => không có record B/không tiết lộ counts; `404` cho foreign detail/history. Test thay session/revoke permission để không show data stale.

**Journey C — Partial cancellation:** Phiếu 3 vé cùng một `ChuyenXe`, một vé `HUY`, hai vé vẫn hiệu lực => phiếu không có status `HUY_MOT_PHAN`, badge "Hủy 1/3", chỉ vé hủy có status `HUY`. Timeline chỉ chứa rows lịch sử có thật, không dựng record để minh họa.

**Journey D — Combined order + refund:** Một `DonGiaoDich` có booking và `PhieuGuiHang` cùng chuyến; xe máy không gắn vé/chủ sở hữu. Hiển thị tiền vé và tổng đơn đúng, hàng trạng thái độc lập, refund pending vs success đúng. Nếu Customer đang chưa có nghiệp vụ hủy đồng bộ vé cuối + hàng, ghi known dependency; **không sửa mutation Customer trong Phase 05**.

**Journey E — Edge/error:** Empty/no results, 400 invalid dates/sort/status/page, 401 expired session, 403 revoked, 404 foreign ID, 500/timeout/retry, null payment/cargo/history, request race và deep-link trực tiếp. Không để màn hình hiển thị dữ liệu từ request/session cũ.

## 4. Backend security + data integrity tests

- **DB-backed multi-tenant integration** (>=2 nhà xe, >=2 khách, >=3 vé/phiếu, >=1 shipment): Controller guards + real Prisma where query; mock chỉ dùng unit tests thuần và không thay thế integration isolation.
- Tests tenant list/count/search/query fields + detail/history, `SUPER_ADMIN` deny, role-without-permission deny, invalid identity deny, override RBAC giữ chính xác tập quyền DB và revoke có hiệu lực.
- Check `bookedFrom/To` và `departureFrom/To` inclusive đúng timezone, timestamp trùng sort/page ổn định, request page vượt tổng và search đặc biệt không làm crash/SQL injection.
- Check một booking phải cùng chuyến; dữ liệu inconsistent/legacy phản ánh rõ, không gán chuyến của vé đầu cho các vé khác hoặc âm thầm mutation DB.
- Check history isolation, baseline, no history, ordering tie-break, actor privacy; GET không thay đổi số rows/history/status; không lộ thông tin Customer ngoài nhu cầu quản trị.
- Check payment original vs refunds pending/succeeded, nhiều refund attempts và `veId` nullable; tránh tính trùng, sai allocation và cộng nhầm `DonGiaoDich.tongTien` cho tiền vé.
- Check không có route Admin POST/PATCH/DELETE/PUT cho booking/ticket trong scope; không vô tình cấp quyền Customer API hủy.

## 5. Admin UI functional + visual regression

- Tab independent filter state, URL deep-link/back/forward/refresh, page reset khi filter thay đổi, search debounce race, sort `aria-sort`, pageSize, loading skeleton và empty/no-match riêng.
- Detail list ↔ booking ↔ ticket ↔ back, không link chết Feature 09; branch khác thiếu Feature 09 thì chỉ hiển thị shipment summary.
- Test 401/403/404, expired refresh flow, retry after network error, graceful rendering optional fields, no stale cached content after role/tenant change.
- **Bắt buộc** browser/manual visual trên viewport `1440×900` và `375×667`, chụp/ghi nhận layout issues: không tràn ngang toàn page, status badge hợp lý, timeline không che khuất, keyboard focus rõ, tap targets, aria labels, reduced motion nếu có.
- Đối chiếu `apps/admin/DESIGN.md` và shared-first patterns; ui-ux-pro-max chỉ để audit, không override design system.
- Không nói đã test browser nếu không thật sự mở browser; nếu môi trường thiếu công cụ kiểm tra trực quan, ghi giới hạn và **không tự đánh dấu đã đạt visual gate**.

## 6. Targeted tests, CI và self-review

- Trong từng phase/Phase 05: chạy **targeted relevant tests** + lint/typecheck/build affected, format check relevant, `git diff --check`. Không bắt buộc full local suite mỗi vòng; **CI toàn repo sẽ kiểm tra khi PR**. Khi target fail, sửa nguyên nhân; không xóa/sửa test để bỏ assertion, không skip test và không dựng service mock cho end-to-end.
- Nếu cần test mạnh hơn, test phải bắt bug có thể xảy ra: bỏ `nhaXeId` filter phải làm test đỏ, trả refund pending thành success phải làm test đỏ, trộn status phiếu/đơn phải làm test đỏ, history cross-tenant phải làm test đỏ.
- Review independent changed code + staged and unstaged diffs để tìm security, XSS, missing guards, N+1, payload lớn, timezone, nullable, SQL, UI parity, leftover stub, dead files, generated Prisma Client, `.env`, `.env.local`, node_modules/logs/temp/test screenshots, leaked credentials.
- Không thay đổi workflow CI hiện có chỉ để ép pass; nếu CI cũ fail bởi regression, phân loại và sửa bug trong scope hoặc báo blocker rõ.

## 7. Acceptance checklist / DoD

Chỉ đạt khi tất cả nhóm tiêu chí chính thỏa mãn:

1. Hai tab và hai trang detail sử dụng API thật, tìm kiếm/filter/sort/page server-side đúng.
2. `booking:read` tenant-scoped; user không có quyền/SUPER_ADMIN bị deny; Tenant A không đọc được B kể cả nested history và meta counts.
3. Không có mutation Admin, không Customer timeline, không `HUY_MOT_PHAN`, không auto `HOAN_THANH`.
4. Data booking/ticket/shipments/payment/refund đúng, không giả định chủ xe máy, không nhầm `DonGiaoDich` và booking/shipments statuses.
5. Timeline Admin từ hai bảng thật, không bịa event; Customer backend history writer phải được **ghi rõ dependency hoặc verified source**.
6. Server validation + Date/Time edge, pagination stable, nullable, race/error tested.
7. Targeted tests + affected lint/typecheck/build pass, browser 2 viewport được kiểm chứng hoặc báo blocker thay vì DONE.
8. Worktree DB/ports vẫn cô lập, no secret/temp/generated files trong Git diff, docs đầy đủ dưới `docs/feature-07-pdv-ve-admin/`.
9. Unknown external Customer/shipment dependency **không được sửa lén**. Báo `Feature 07 Admin read-only READY` nếu đạt riêng scope, kèm `Customer/shipment dependency OPEN` khi chưa xong; không tuyên bố end-to-end cancellation toàn hệ thống DONE.

## 8. Final handoff & Git

- Mỗi phase phải có SHA + `handoff/PHASE_0X_HANDOFF.md`. Ghi `handoff/FINAL_HANDOFF.md` gồm git log base→HEAD, kết quả 6 API GET, routes, snapshot schema, permission rollout, DB/ports isolation, commands/tests pass/fail thật, visual review, findings và fixes, dependencies + mức độ ready.
- Đảm bảo handoff được **commit** (commit phase riêng hoặc amend an toàn nếu phù hợp), không để file handoff chưa tracked nhưng báo đã hoàn tất. Không push, tạo PR hay merge; chờ reviewer kiểm tra độc lập trước.
- Khi phát hiện blocker không khắc phục an toàn: lưu trạng thái/handoff, **STOP** thay vì tự mở rộng nghiệp vụ hoặc tự chọn chính sách phí hủy hàng.
