# PHASE 02 — Admin Dashboard doanh thu (6 KPI · 1 biểu đồ · 2 bảng)

**Bắt đầu sau Phase 01 DONE.** Đọc `MASTER_SPEC.md`, `handoff/PROGRESS.md`, `handoff/PHASE_01_HANDOFF.md` và **chỉ** spec này. BẮT BUỘC đọc `apps/admin/DESIGN.md`, `apps/admin/AGENTS.md`, kiểm tra shared components/tenant rules thực tế. Dùng skill **`ui-ux-pro-max`** (không override DESIGN.md) và Context7 MCP khi cần Next.js/chart lib đúng phiên bản.

## Phạm vi

Một route tenant Admin, gợi ý `/revenue-reports`, không làm Super Admin overview và không làm F13 vận hành. Dữ liệu **chỉ** từ API thật Phase 01 (`NEXT_PUBLIC_ADMIN_DATA_SOURCE=api`), KHÔNG có doanh thu fixture/mock ở runtime, ngay cả khi API lỗi.

## Thiết kế layout

1. **Header:** “Thống kê & Báo cáo doanh thu”, khoảng thời gian đang lọc, nút `Xuất CSV` (placeholder, nhấn chỉ toast “Tính năng xuất báo cáo đang được triển khai”; không gọi API/khởi tạo file).
2. **Filter:** `fromDate/toDate` (date range tùy chọn) + `groupBy` ngày/tháng/quý. Lựa chọn `groupBy` chỉ thay **cách gom kỳ**, không làm mất phạm vi đã chọn nếu không có chủ đích rõ ràng. Default tháng hiện tại và groupBy day; timezone `Asia/Ho_Chi_Minh`, ngày inclusive. Filter params phải nhất quán với API. Không nhận hoặc gửi `nhaXeId`.
3. **KPI grid — đúng 6 cards:**
   - (1) **Doanh thu ròng:** `netRevenue`; có thể âm.
   - (2) **Doanh thu vé:** `netTicketRevenue` (sau refund).
   - (3) **Doanh thu gửi hàng:** `netShipmentRevenue` (sau refund).
   - (4) **Tiền đã hoàn:** `refundAmount` (hiện dương, có chú giải là tiền đã hoàn).
   - (5) **Thanh toán thành công:** `successfulPayments` (không gồm refund, đơn 0đ hoặc đối soát).
   - (6) **Vé đã bán / Vận đơn:** hai count `soldTicketCount / issuedShipmentCount` trong **một** card, ghi rõ là đã phát hành/quyết toán trong kỳ, **không** phải số còn hiệu lực.
4. **Chỉ 1 chart:** “Biến động doanh thu ròng” theo `series[].period`, VND và tick labels dễ đọc, có tooltip, âm/zero bình thường, không phụ thuộc chỉ màu. Chọn chart lib hiện có nếu thích hợp, tránh cài dependency nặng nếu có giải pháp nhẹ.
5. **Bảng 1: Cơ cấu doanh thu dịch vụ.** Đúng ba dòng `Vé xe`, `Gửi hàng độc lập`, `Gửi hàng kèm vé`, và hàng tổng cộng; cột: nguồn thu, tiền đã thu, tiền hoàn, doanh thu ròng. `serviceBreakdown` từ backend, không tính tiền riêng ở frontend (trừ sum hiển thị đã có dữ liệu).
6. **Bảng 2: Báo cáo theo thời gian.** Kỳ, vé ròng, gửi hàng ròng, thu trước hoàn, hoàn tiền, ròng, số payment; cùng **series** với chart. Khi group day → ngày, month → tháng, quarter → quý. Không làm màn giao dịch từng order, vì có module quản lý vé/gửi hàng riêng.
7. **State:** loading/skeleton, no data = KPI 0 + empty chart, 401/403 access denied, API/network error + retry, stale response khi đổi filter nhanh, mobile responsive; số tiền format VND, code tiền không dùng font monospace nếu DESIGN.md không yêu cầu.

## Tích hợp Admin hiện tại (sau merge PR #35/#37)

- Inspect `apps/admin/src/features/admin-auth/services/admin-access.ts`: `ADMIN_OPERATION_SECTIONS`, `AdminPermission`, `getRequiredAdminPermissions`, `getFirstAccessibleAdminPath`, `canAccessTenantPath`. Thêm mapping route đúng, không duplicate quyền.
- Inspect `apps/admin/src/features/super-admin-layout/components/super-admin-layout.tsx`: `SuperAdminLayoutProps.activeSection`, `OPERATION_NAVIGATION_DETAILS`, điều kiện sidebar tenant, mobile nav; giữ chat, booking management, promotions, shipments đúng vị trí hiện hành.
- Reuse Admin session guard/client API/format tiền, filters, `AdminPageHeader`, Empty/Error/Loading, shared Table, shared button. Dùng `apps/admin/src/styles/admin-tokens.css` và `DESIGN.md`; không copy CSS của route khác làm shared.
- Link chỉ hiện khi có `revenue:read` và scope tenant; deep link denied; response lỗi tenant phải fail closed, không dùng dummy chart khi API không chạy.

## Test và kiểm tra theo yêu cầu người dùng

**Không viết/chạy UI unit/component tests, integration tests, E2E tests hoặc browser automation.** Phần UI, layout, filter, click và responsive **người dùng tự test**. Agent chuẩn bị **manual smoke checklist**, tối thiểu:

| ID | Người dùng tự kiểm | Kỳ vọng |
|---|---|---|
| M02-01 | Nhà xe A login → mở F12 | Chỉ revenue A, có menu |
| M02-02 | Nhân viên không quyền, Super Admin → đi thẳng URL | Không được xem nội dung; thiếu quyền đúng |
| M02-03 | 6 KPI trong 1 kỳ | Ticket + shipment = net, refund + gross = gross receipts (theo phép trừ) |
| M02-04 | Đổi day/month/quarter, chọn từ–đến | Labels, totals, chart và bảng cùng kỳ, không stale |
| M02-05 | Khoảng có refund lớn hơn thu | Số âm không bị thành 0 |
| M02-06 | Khoảng không có giao dịch | State rỗng và KPI 0, không fake data |
| M02-07 | API down/403 và bấm thử lại | Hiện lỗi rõ ràng, không lộ số từ session cũ |
| M02-08 | Nhấn Xuất CSV | Chỉ toast thông báo, không download |
| M02-09 | Desktop 1440×900, mobile 375×667 | Không vỡ layout/tràn bất thường, touch/keyboard dùng được |
| M02-10 | Refresh/deep-link/thay filter nhanh | Không hiện data của request cũ |

### Acceptance criteria

- [ ] Đủ **6 KPI**, 1 chart, **2 bảng**, date filters day/month/quarter/custom; số khớp API contract; money formatting và net âm đúng.
- [ ] UI chỉ dùng authenticated tenant API thật, không mock; không thêm revenue cho super admin; không làm KPI vận hành F13.
- [ ] Route/menu/permission/server deny bám patterns sau PR #35/#37 và `DESIGN.md`/shared components.
- [ ] CSV placeholder không request server/export thật.
- [ ] `npm run typecheck --workspace=@vexgo/admin`, targeted lint/build nếu áp dụng, `git diff --check` và **static self-review**; ghi rõ **UI behavior NOT VERIFIED BY AGENT**, đính manual checklist cho người dùng.
- [ ] Commit local tiếng Việt, viết phase handoff và cập nhật PROGRESS.

### Out of scope

Full UI automation, snapshot/component tests, analytics theo tuyến/chuyến/ghế, report builder, export CSV/PDF thật, Super Admin report, F13.
