# Handoff Phase 03 — Admin Shipment List / Detail / History UI

## 1. Thông tin tổng quan
- **Phase:** 03 — Admin Shipment List / Detail / History UI
- **Worktree:** `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature09`
- **Branch:** `feature/shipment-management`
- **URL thử nghiệm:** `http://localhost:3003/shipments` (API Backend: `http://localhost:4003`)
- **Database:** `vexgo_feature09` trên MySQL 3306

## 2. Component Audit: Reused / Extended / New
Tuân thủ nghiêm ngặt nguyên tắc Shared-first và DESIGN.md:

### Reused (Tái sử dụng 100% Shared Admin Components):
- `AdminPageHeader` (`src/components/admin/admin-page-header.tsx`): Header chuẩn với eyebrow, title và action slot.
- `AdminRefreshAction` (`src/components/admin/admin-page-actions.tsx`): Nút Làm mới với hiệu ứng quay spinner.
- `FilterToolbar`, `SearchInput`, `SelectFilter` (`src/components/data-filters/data-filters.tsx`): Thanh tìm kiếm và bộ lọc trạng thái dùng chung.
- `AdminTableSkeleton` (`src/components/admin/admin-table-skeleton.tsx`): Skeleton loading chuẩn khi khởi tạo.
- `AdminStatusBadge` (`src/components/admin/admin-status-badge.tsx`): Huy hiệu trạng thái với tone `active` / `muted`.
- `AdminDetailAction` (`src/components/admin/admin-detail-action.tsx`): Nút mở chi tiết chuẩn, có aria-label accessible.
- `AdminDetailSheet` (`src/components/admin/admin-detail-sheet.tsx`): Right-side sheet modal với focus trap, backdrop và Escape close.
- `AdminPagination` (`src/components/admin/admin-pagination.tsx`): Thanh phân trang chuẩn với số lượng kết quả và nút trang trước/sau.
- `SuperAdminLayout` (`src/features/super-admin-layout/components/super-admin-layout.tsx`): Sidebar & header shell.
- `AdminSessionGuard` (`src/features/admin-auth/components/admin-session-guard.tsx`): Gate bảo vệ route và phân quyền.

### Extended (Mở rộng cấu hình chung):
- `ADMIN_OPERATION_SECTIONS` & `AdminPermission` (`apps/admin/src/features/admin-auth/services/admin-access.ts`):
  - Bổ sung section `shipments` (`/shipments`) với `readPermission: 'shipment:read'`.
  - Bổ sung quyền `shipment:read` và `shipment:update` vào `AdminPermission`.
  - Mở rộng `getRequiredAdminPermissions` kiểm tra quyền `shipment:read` khi truy cập `/shipments`.
- `SuperAdminLayout`: Bổ sung item điều hướng "Gửi hàng" với icon `Package` từ `lucide-react`.

### New (Domain-specific cho Feature Gửi Hàng):
- `apps/admin/src/features/shipments/types/shipment.ts`: TypeScript contracts khớp API response.
- `apps/admin/src/features/shipments/services/shipment-service.ts`: Client service gọi API thật `/api/v1/shipments` và `/api/v1/shipments/:id`.
- `apps/admin/src/features/shipments/hooks/use-shipments.ts`: Hook quản lý bộ lọc, search debounced (300ms), pagination, refresh và chống stale response qua key/abort controller.
- `apps/admin/src/features/shipments/components/shipments-management.tsx`: Workspace danh sách phiếu gửi desktop table và mobile card fallback.
- `apps/admin/src/features/shipments/components/shipment-details.tsx`: Sheet chi tiết hiển thị thông tin người gửi/nhận, lộ trình, kiện hàng, chi tiết cước và timeline lịch sử trạng thái.
- `apps/admin/src/features/shipments/shipments.css`: CSS bố cục và timeline tái sử dụng toàn bộ tokens từ `admin-tokens.css`.
- `apps/admin/src/app/shipments/page.tsx`: Route App Router được bảo vệ bởi `AdminSessionGuard`.

## 3. UI-UX Pro Max Audit & Responsive Verification
- **Font & Typography:** Inter cho nội dung chính; JetBrains Mono (`admin-data-mono`) cho mã vận đơn, số điện thoại, mã chuyến xe. Kích thước chữ chuẩn bảng 13px theo DESIGN.md.
- **Desktop (1440×900):** Đã kiểm tra qua Chrome DevTools MCP. Bảng hiển thị đầy đủ 9 cột rõ ràng, căn phải tiền cước, nút chi tiết accessible, không bị horizontal overflow.
- **Mobile (375×667):** Đã kiểm tra qua Chrome DevTools MCP. Chuyển sang danh sách mobile card (`shipments-mobile-card`), hiển thị người gửi, người nhận, chuyến xe, tổng cước và nút chi tiết dễ bấm.
- **Detail Sheet:**
  - Tiêu đề và nút đóng chuẩn accessible, backdrop đóng mượt mà.
  - Hiển thị danh sách kiện hàng với đầy đủ kích thước dài × rộng × cao, khối lượng và khai giá.
  - Bảng chi tiết cước theo loại hàng và tổng cước rõ ràng.
  - Timeline hiển thị trung thực từ backend DB; hiển thị "Chưa có lịch sử trạng thái" nếu rỗng, không tự tạo bước ảo.
- **Read-only Boundary:** Phase 03 tuyệt đối không chứa mutation hay nút đổi trạng thái sớm.

## 4. Test & Build Results
- **Targeted Admin Tests:**
  - `npm test --workspace=@vexgo/admin -- test/admin-access.spec.tsx test/shipments-read.spec.tsx` -> **18/18 tests PASS**.
- **Targeted Backend Tests:**
  - `npm test --workspace=@vexgo/api -- test/unit/auth/shipment-rbac.spec.ts test/integration/shipments/shipments.spec.ts` -> **19/19 tests PASS**.
- **Production Build:**
  - `npm run build --workspace=@vexgo/admin` -> **Compiled successfully, static page /shipments generated**.
- **Real DB / Live API Smoke Test:**
  - Đăng nhập tài khoản thật `futa-nv-0001@vexgo.test` (Phương Trang).
  - Tải thành công 8 phiếu gửi từ DB `vexgo_feature09` qua API `http://localhost:4003/api/v1/shipments`.
  - Mở chi tiết `FUTA-VD-240920261240-0015` hiển thị 3 kiện hàng và timeline lịch sử 2 mốc trạng thái chuẩn xác.
