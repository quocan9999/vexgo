# Admin Design Language

Feature 01 – Quản lý nhà xe là chuẩn tham chiếu cho CRUD quản trị đơn giản. Tài liệu này mô tả design language chung; nó không ép mọi feature Admin dùng cùng một bố cục.

## Tokens

- Font: `var(--font-sans)`, với fallback `Segoe UI, Arial, sans-serif`.
- Cỡ chữ: 9px metadata, 10px helper, 11px label/button, 12px form/table header, 13px control và dữ liệu thường, 14px dữ liệu cần nhấn mạnh.
- Trọng số: 450 regular, 600 medium, 650 semibold, 700 bold.
- Màu: `--admin-navy` cho vùng điều hướng; `--admin-blue` cho hành động chính; `--admin-text-strong` cho dữ liệu chính; `--admin-text-muted` cho dữ liệu phụ; `--admin-border` cho đường viền; `--admin-canvas` cho nền; `--admin-success-*` cho trạng thái hoạt động.
- Khoảng cách, bo góc và chiều cao control dùng token `--admin-*`. Control chuẩn cao 37px, radius control 8px và panel 10px.

Không hard-code token theo tên feature. Thêm token vào `src/styles/admin-tokens.css` khi nó mô tả một giá trị dùng chung, đã có trong UI duyệt.

## Shared components và CSS ownership

Các component tại `src/components/ui/` là implementation riêng của dự án, dùng API/convention nhất quán; chúng không phải bộ shadcn primitives hoàn chỉnh. Style của Admin shell và shared component nằm trong `src/styles/admin-components.css`; `dashboard.css` chỉ chứa style Tổng quan, còn `bus-companies.css` chỉ chứa style Quản lý nhà xe.

- `Button`: `primary` và `secondary`.
- `Badge`: nền cho nhãn trạng thái.

Các pattern Admin tại `src/components/admin/`:

- `AdminPageHeader`: eyebrow, tiêu đề và nhóm action.
- `AdminCreateAction`, `AdminRefreshAction`: hai page action cùng kích thước theo mẫu `/bus-companies`.
- `AdminDetailAction`: nút Eye + “Xem chi tiết” dùng chung cho bảng và thẻ mobile.
- `AdminTableSkeleton`: năm hàng shimmer cho lần tải danh sách đầu tiên.
- `AdminResultSummary`: định dạng `meta.totalItems` thành `{N} kết quả` trong `FilterToolbar`.
- `AdminStatusBadge`: nhãn trạng thái `active` hoặc `muted`.
- `AdminPagination`: range, trang hiện tại và điều hướng.
- `AdminDetailSheet`, `AdminFormDialog`, `AdminConfirmDialog`: dialog pattern có ngữ nghĩa và kiểu trình bày cố định.
- `AdminDialogPrimitive`: primitive native dialog nội bộ; view dùng các wrapper theo pattern thay vì tự chọn class hoặc kiểu dialog.

Shared component chỉ chứa pattern hiển thị và accessibility. Domain label, API call, validation và state nghiệp vụ nằm trong feature.

## Interaction patterns

### CRUD management

List/table, toolbar search/filter, detail sheet bên phải, create/edit form dialog và confirmation dialog cho status/destructive action. Dùng cho resource đơn giản như Nhà xe.

Page actions theo thứ tự: `[Primary action] [Refresh]`.

CRUD list MUST dùng `AdminCreateAction`, `AdminRefreshAction`, `AdminDetailAction` và `AdminTableSkeleton`. `FilterToolbar` nhận `meta.totalItems` từ response để hiển thị `{N} kết quả`; trước khi có dữ liệu hiển thị `Đang tải kết quả`. Khi tải lại, dữ liệu đã có tiếp tục hiển thị.

### Dedicated workspace

Dùng cho workflow dài, nhiều tab hoặc subresource cần không gian lớn. Không ép vào table/detail sheet, nhưng vẫn dùng token và primitive chung.

### Dashboard/report

Dùng cards, chart và filter theo thời gian. Giữ typography, màu, spacing, loading/error/success language chung.

### Spatial/configuration UI

Dùng cho sơ đồ ghế hay cấu hình không gian. Chọn canvas/workspace theo nghiệp vụ; không biến thành CRUD table khi làm giảm khả năng thao tác.

### Content/editor

Dùng editor, preview và history khi nội dung có versioning. Reuse token và control chung.

### Confirmation/destructive action

Dùng dialog có title, mô tả tác động, hành động hủy và xác nhận. Khóa dismiss/double submit khi request đang chạy.

## Component conventions

- Button chính dùng `Button`; button phụ dùng `Button variant="secondary"`.
- Form control giữ label rõ ràng, state `aria-invalid`, mô tả lỗi liên kết bằng `aria-describedby` và lỗi chung dùng `role="alert"`.
- Table desktop có header/sort rõ ràng; mobile có card fallback khi table không còn dễ đọc.
- Filter toolbar gồm search trước, filter sau; số kết quả chỉ hiện một nơi.
- Pagination luôn hiển thị range, total, page và nút trước/sau có `aria-label`.
- Status badge dùng `AdminStatusBadge`; status domain tự map label trong feature/backend contract.
- Detail CRUD đơn giản mở từ phải; form ngắn/trung bình dùng dialog; workflow phức tạp có thể dùng page riêng.
- Loading dùng status rõ ràng, empty state giải thích ngắn, success dùng `role="status"`, spinner là `aria-hidden` và tôn trọng `prefers-reduced-motion`.

## Responsive và accessibility

Kiểm tra tối thiểu ở 1440×900 và 375×667. Không được có overflow không chủ ý, action phải chạm được, dialog/sheet không tràn viewport, và table phải có fallback phù hợp.

Dialog/sheet phải có title và description khi có mô tả. Icon button cần `aria-label`; focus visible, Esc và backdrop phải hoạt động khi không submit; reduced motion phải tắt animation không thiết yếu.

## Khi tạo component mới

Tạo shared component khi pattern có từ hai điểm dùng trở lên hoặc được DESIGN.md xác định là primitive chung. Không tạo abstraction cho một layout/domain đơn lẻ. Nếu shared component chưa phù hợp, mở rộng API của nó khi use case tương đương; feature-specific workspace được phép tồn tại khi interaction model khác, nhưng không được tự tạo design language mới.
