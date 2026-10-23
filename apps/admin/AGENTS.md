<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Admin UI reuse

### Source of truth

- MUST đọc `apps/admin/DESIGN.md` trước khi sửa Admin UI.
- Typography, line-height, spacing, màu, radius và control sizes MUST theo contract trong `DESIGN.md`; table body mặc định 13px. Giá trị CSS hiện tại chưa khớp target được xem là legacy, không tự động là chuẩn thiết kế.
- Line-height MUST theo các role ratios trong `DESIGN.md`; các mức chính là 1.2, 1.35 và 1.5.
- Trong từng lát cắt migration, MUST đi theo token mapping → shared primitive → shared pattern → feature styles → kiểm tra consumer → dọn legacy. Không đổi toàn bộ token runtime của Admin trước khi kiểm chứng màn mẫu.
- Feature-specific spacing exception MUST được ghi trong `DESIGN.md` và chỉ dùng cho data visualization hoặc workflow có layout đặc thù.
- Chỉ map undefined custom property khi xác định được intended existing value.
- MUST inspect `src/components/admin/`, `src/components/ui/`, `src/components/data-filters/` và `src/styles/admin-components.css` trước khi tạo hoặc sửa UI pattern dùng lại được.
- Thứ tự ưu tiên khi quyết định UI:
  1. `DESIGN.md`
  2. Contract và component registry trong `DESIGN.md`
  3. Shared components đã đạt contract; adapter migration được ghi rõ
  4. Feature-specific UI khi interaction model thực sự khác
  5. UI/UX skills để audit và đề xuất cải tiến; thay đổi chuẩn phải cập nhật tài liệu trước khi nhân rộng

- Target là shadcn/ui theo cấu hình `base-nova`/Base UI hiện có, custom theo nhận diện VexGo; không mặc định đổi sang Radix hoặc thêm hệ primitive khác.
- Không route nào là golden reference. Màn mẫu dùng để nghiệm thu contract, không thay thế `DESIGN.md`.

### Mandatory shared-first workflow

Trước khi tạo **bất kỳ** component hoặc CSS mới cho CRUD action/state, agent MUST search codebase để xác minh shared equivalent đã tồn tại hay chưa.

Ít nhất phải kiểm tra các nhóm sau:

- page header / page actions;
- create action;
- refresh action;
- detail action;
- loading / skeleton;
- result count / summary;
- search / filter controls;
- table / mobile card fallback;
- pagination;
- status badge;
- detail sheet;
- create/edit form dialog;
- status/destructive confirmation.

Nếu shared equivalent tồn tại và đã đạt contract (`approved`):

- MUST reuse nó;
- MUST NOT tạo bản sao theo feature;
- MUST NOT tạo class visual riêng chỉ để đổi cùng một pattern.

Nếu equivalent là `legacy` hoặc `migrating`, MUST kiểm tra registry trong `DESIGN.md`: sửa canonical component hoặc dùng adapter đã ghi rõ, không nhân bản theo feature. Việc tồn tại implementation cũ không bắt buộc tiếp tục dùng behavior sai. Chỉ chuyển trạng thái sang `approved` sau khi có bằng chứng nghiệm thu; cài package hoặc sinh file bằng CLI chưa đủ.

Ví dụ các pattern kiểu sau là không được phép nếu shared equivalent đã có:

```text
.company-open-button
.vehicle-detail-button
.vehicle-type-detail-button
.vehicle-button
.vehicle-type-button
.vehicle-dialog
.vehicle-pagination
.vehicle-loading
```

Tên class ở trên chỉ là ví dụ. Rule áp dụng cho mọi feature mới.

### CRUD consistency rules

Với CRUD management có interaction tương đương, MUST dùng cùng shared pattern cho:

- create action;
- refresh action;
- detail action;
- initial table/list skeleton;
- result summary;
- pagination;
- status badge;
- detail sheet;
- create/edit dialog;
- destructive/status confirmation.

Không được để `/bus-companies`, `/vehicle-types`, `/vehicles` hoặc các CRUD feature tương lai có visual khác nhau chỉ vì nằm ở feature khác.

Nếu một pattern đã được approve trong design system và cần dùng lại ở từ hai nơi trở lên, SHOULD extract thành shared component thay vì copy JSX/CSS.

Domain callback, label resource, API call, validation và business state vẫn nằm trong feature. Shared component chỉ sở hữu visual, interaction chung và accessibility contract.

### Feature-specific UI

- MUST NOT tạo design language riêng cho từng feature.
- Feature-specific workspace MAY tồn tại khi nghiệp vụ cần interaction khác CRUD, ví dụ seat map, scheduler, dashboard/report hoặc content editor.
- Feature-specific workspace vẫn MUST reuse design tokens, typography, Button/Input/Badge/Dialog primitives, loading/error/success language và accessibility conventions chung.
- Không được ép workflow đặc thù vào CRUD pattern nếu làm giảm usability.

### Shared component ownership

- MUST reuse shared contract đã đạt chuẩn khi use case tương đương; component legacy chuyển theo registry.
- MUST NOT tạo feature-specific Button, Dialog, Table, Pagination, Badge hoặc CRUD action khi shared equivalent tồn tại.
- Nếu shared component chưa đáp ứng use case tương đương, SHOULD mở rộng API của shared component trước.
- Chỉ tạo component feature-specific khi interaction model thực sự khác; code review/report MUST nêu lý do rõ ràng.
- `src/components/ui/` sở hữu primitive shadcn, variants và accessibility cơ bản; `src/components/admin/` sở hữu pattern Admin; `src/components/data-filters/` sở hữu filter composition. Feature giữ API, permissions, validation và domain state.
- Adapter chỉ chuyển API cũ sang canonical implementation mới, có consumer list và điều kiện xóa; không duy trì hai bộ style/focus engine độc lập cho cùng component đã migrate.

### Date filter reuse

- Với filter một ngày, MUST tìm và dùng shared component `SingleDateFilter` trong `src/components/data-filters/single-date-filter.tsx`.
- Với filter khoảng ngày bắt đầu–kết thúc, MUST tìm và dùng shared component `DateRangeFilter` trong `src/components/data-filters/data-filters.tsx`; cấu hình label qua props hiện có hoặc mở rộng API dùng chung nếu cần.
- Source of truth là date contract trong `DESIGN.md`; API composition hiện có là điểm xuất phát, implementation/styles bên trong được thay trong migration. Các màn hình sử dụng chỉ là ví dụ; MUST NOT sao chép date picker theo route.
- MUST NOT tạo date filter riêng theo feature khi interaction tương đương với hai shared component trên.
- Target date-only UI và DTO/API là `DD-MM-YYYY` theo root `AGENTS.md`. Khi endpoint còn legacy `YYYY-MM-DD`, service giữ wire contract cũ và ghi migration pending; chuyển UI/DTO/consumers theo cùng endpoint, không gửi format mới vào DTO cũ. Timestamp ISO có offset không đổi. Không parse bằng `new Date('DD-MM-YYYY')`.

### CSS ownership

- Primitive shadcn sở hữu styling tại component; theme semantic mapping ở `src/app/globals.css`/`src/styles/admin-tokens.css` theo `DESIGN.md`. Shell/pattern dùng stylesheet của owner; `admin-components.css` là nơi chuyển tiếp, không tiếp tục gom mọi feature vào đó.
- Stylesheet của dashboard/feature chỉ được chứa style riêng cho layout/domain của feature đó.
- MUST NOT để shared component phụ thuộc vào CSS của một feature.
- Khi extract shared component, MUST xóa dead/duplicate feature CSS tương ứng.
- Chỉ xóa selector/token/adapter sau khi kiểm kê consumer. Không dùng global selector `.button`, `input`, `select`, `dialog` để ép style của primitive mới; không thêm `!important` để che xung đột legacy.

### Visual regression

Sau khi sửa shared CRUD UI hoặc tạo CRUD feature mới, MUST kiểm tra tối thiểu:

- desktop `1440×900`;
- mobile `375×667`.

Phải đối chiếu consistency của:

- header hierarchy;
- create/refresh actions;
- filter toolbar;
- result count;
- initial loading skeleton;
- table/card typography;
- detail action;
- pagination;
- detail sheet;
- form/confirm dialogs;
- loading/error/empty/success states.

Không được kết luận UI READY nếu chưa kiểm tra visual ở hai viewport này khi task có thay đổi layout/interaction.

### Accessibility

- Icon-only button MUST có `aria-label`.
- Sort control MUST công bố direction bằng `aria-sort` hoặc contract accessibility tương đương.
- Dialog/sheet MUST có accessible title; description khi có nội dung mô tả.
- Focus MUST không thoát khỏi modal dialog khi mở; Tab/Shift+Tab, Escape và backdrop behavior phải đúng theo shared dialog contract.
- Loading/success/error state phải dùng semantic phù hợp (`role="status"`, `role="alert"`, `aria-busy` khi cần).
- Animation không thiết yếu MUST tôn trọng `prefers-reduced-motion`.
- Tabs MUST có tab–panel linkage, roving focus và phím mũi tên/Home/End; inputs MUST có label bền vững, placeholder không thay label.
- Form validation MUST giữ inline errors liên kết field và điều hướng focus tới lỗi đầu tiên hoặc error summary có liên kết khi submit thất bại. Loading khác disabled; badge label/tone phải map đúng enum thật trong feature.

### UI/UX skills

- UI/UX skills dùng để audit, thiết kế và review consistency, accessibility, responsive, usability trong scope người dùng yêu cầu.
- Có thể đề xuất sửa chuẩn chưa hợp lý bằng bằng chứng; cập nhật `DESIGN.md` và registry cùng thay đổi. Không âm thầm override contract theo từng feature.
- Sử dụng ui-ux-pro-max skill khi làm việc với frontend UI/UX

### Admin tenancy / operational scope

- MUST đọc `docs/ADMIN_TENANCY_AND_OPERATIONS.md` trước khi sửa Admin shell, sidebar, dashboard hoặc UI của resource thuộc nhà xe.
- MUST phân biệt platform scope (Super Admin) và tenant scope (nhà xe).
- MUST NOT thiết kế operational CRUD như danh sách aggregate của tất cả nhà xe.
- MUST NOT dùng frontend filtering làm tenant security boundary.
- MUST inspect tenant ownership và API scope trước khi thêm lookup, filter hoặc relation selector.
- Khi chưa có backend-trusted tenant identity, tenant presentation MUST NOT tải dữ liệu operational aggregate rồi tự lọc; giữ UI ở trạng thái chờ auth/authorization thay vì trình bày dữ liệu cross-tenant.

### Filters có label phía trên

- Khi cần select filter có label hiển thị phía trên, MUST tái sử dụng `LabeledSelectFilter` từ `src/components/data-filters/data-filters.tsx` (implementation: `src/components/data-filters/labeled-select-filter.tsx`).
- Cấu hình `label`, `accessibleLabel` khi cần, `options`, `value`, `onChange` và `disabled` theo use case; không sao chép markup/CSS sang feature hoặc tự tạo pattern tương đương.
- Size và spacing theo contract `DESIGN.md`; implementation chung thực thi contract và có thể thay trong migration. Dùng trong `FilterToolbar` cho CRUD; dashboard/workspace có thể composition khác khi nghiệp vụ cần, vẫn reuse primitives và size variants.
