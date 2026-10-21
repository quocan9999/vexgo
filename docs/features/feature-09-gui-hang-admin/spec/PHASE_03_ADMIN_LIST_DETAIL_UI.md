# PHASE 03 — Admin Shipment List / Detail / History UI

**Dependency:** Phase 02 GET APIs pass, local commit + handoff. **Checkpoint demo sớm:** list/detail DB-backed, chưa có nút mutation.

## Goal

Admin tenant xem danh sách và chi tiết phiếu gửi từ API thực trên `http://localhost:4003`; dữ liệu MySQL DB `vexgo_feature09`. Không render danh sách/chi tiết bằng mock, fixture JSON hoặc client-side filtering giả.

## Mandatory audit trước khi tạo UI

Đọc `apps/admin/AGENTS.md`, `apps/admin/DESIGN.md`, `docs/ADMIN_TENANCY_AND_OPERATIONS.md`; quét tối thiểu:

- `apps/admin/src/components/admin/`, `src/components/ui/`, `src/components/data-filters/`, `src/styles/admin-components.css`, tokens;
- Admin sidebar/menu/session/permission gate và route đang dùng;
- Feature danh sách khách hàng/chuyến, shared `ViewDetailButton` (hoặc tên component đang có), Detail Sheet, Badge, Search, Status filter, Pagination, Refresh, Skeleton/Empty/Error, Card responsive;
- API client `apps/admin/src/lib/admin-api-client.ts`, `getApiBaseUrl`, formatter ngày giờ/tiền, shared fetch conventions.

Ghi `Component audit: Reused / Extended / New` trong handoff. Reuse thật, không tạo `ShipmentDetailButton`, `shipment-pagination`, `shipment-dialog` nếu shared equivalent có thể dùng. Khi component thiếu API, mở rộng shared component tổng quát (và test regression) hoặc giải thích lý do tạo mới. **UI-UX Pro Max** để audit consistency/contrast/accessibility, không override DESIGN.md.

## UI / state

- Route theo App Router hiện hữu, dự kiến `/shipments`, với Admin session gate và menu chỉ hiện có `shipment:read`; không expose cross-tenant aggregate cho SUPER_ADMIN mặc định.
- List desktop table, mobile card fallback; ít nhất có waybill, trạng thái, ngày gửi, người gửi/nhận, chuyến, điểm giao/nhận, tổng cước và nút chi tiết shared.
- Search theo waybill (và tên/số điện thoại nếu API support), filter trạng thái, page/pageSize, refresh. Server-side query; reset page khi filter đổi; chống response stale khi search nhanh; không tự filter một page duy nhất rồi cập nhật total giả.
- Chi tiết dùng **shared right-side Detail Sheet** trừ khi codebase có pattern tốt hơn theo DESIGN.md: thông tin sender/receiver, chuyến/tuyến, 2 điểm (tên/địa chỉ), cargo item(s), chi tiết cước theo loại, tổng cước, người trả cước, timeline `LichSuTrangThaiPhieuGuiHang`.
- Timeline chỉ từ backend; status enum mapped tập trung, lịch sử rỗng thể hiện `Chưa có lịch sử trạng thái`, không dựng các bước ảo.
- Loading skeleton, empty/no-match, network error/retry, 401/403, missing detail, stale/abort, success on refresh. Tránh lộ raw error, PII log, raw server exception.
- Chưa hiển thị nút PATCH trong Phase 03. Không auto update trạng thái chỉ vì mở sheet.

## Routing & UX gates

- Menu permission phải dùng cùng nguồn truth session hiện có; đổi role/tenant gây invalidate hoặc ẩn/hủy yêu cầu cũ phù hợp, không giữ data tenant trước.
- Body 13px trong bảng, Inter theo DESIGN, các mã vận đơn/IDs mono đúng token; action order, spacing, badge và responsive theo shared layer.
- Layout checked `1440×900`, `375×667`; không horizontal overflow toàn page, focus trap sheet, accessible title/label, close bằng Escape, `aria` phù hợp.

## Tests & acceptance

- UI test service/hook state list: filter/search/page query gửi đúng API, refresh thực hiện lại GET, result count từ `meta`; test chuyển trang nhanh không stale.
- Mock `fetch` chỉ ở **unit component/service** để xác nhận UI behavior; smoke trình duyệt phải gọi NestJS/MySQL thật.
- Nhân viên `shipment:read` thấy menu/dữ liệu; thiếu permission không thấy menu; backend vẫn 403 nếu gọi trực tiếp.
- Sheet hiển thị đủ nhiều loại hàng + chi tiết cước; missing actor và timeline rỗng không crash.
- Browser 1440×900 / 375×667 thật; nếu không có browser capability ghi NOT VERIFIED, không tự tick.

## Deliverable / commit

Các file Admin shipment được cấu trúc theo `features/shipments/components`, `services`, `types`, `hooks` nếu cần. Không sửa Customer Web.  
Targeted Admin tests, lint/typecheck/build, GitNexus impact/detect, diff self-review.  
`handoff/PHASE_03_HANDOFF.md` ghi URL, các screenshot/observation thật (không commit artifact thừa).  
Commit subject gợi ý: `feat(admin): thêm danh sách và chi tiết phiếu gửi hàng` + body dạng gạch đầu dòng.  
**Checkpoint sau Phase 03:** demo đọc/list/detail nếu thực sự kiểm chứng; vẫn chưa gọi MVP READY.
