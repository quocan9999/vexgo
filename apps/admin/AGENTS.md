<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Admin UI reuse

### Source of truth

- MUST đọc `DESIGN.md` trước khi sửa Admin UI.
- MUST inspect `src/components/admin/`, `src/components/ui/`, `src/components/data-filters/` và `src/styles/admin-components.css` trước khi tạo hoặc sửa UI pattern dùng lại được.
- Với CRUD management, Feature 01 `/bus-companies` là golden reference về visual/interaction khi use case tương đương.
- Thứ tự ưu tiên khi quyết định UI:
  1. `DESIGN.md`
  2. Shared Admin components / shared UI primitives
  3. CRUD golden reference đã duyệt
  4. Feature-specific UI khi interaction model thực sự khác
  5. UI/UX skills chỉ dùng để review consistency/accessibility/responsive

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

Nếu shared equivalent tồn tại:

- MUST reuse nó;
- MUST NOT tạo bản sao theo feature;
- MUST NOT tạo class visual riêng chỉ để đổi cùng một pattern.

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

Nếu một pattern đã được approve ở golden reference và cần dùng lại ở từ hai nơi trở lên, SHOULD extract thành shared component thay vì copy JSX/CSS.

Domain callback, label resource, API call, validation và business state vẫn nằm trong feature. Shared component chỉ sở hữu visual, interaction chung và accessibility contract.

### Feature-specific UI

- MUST NOT tạo design language riêng cho từng feature.
- Feature-specific workspace MAY tồn tại khi nghiệp vụ cần interaction khác CRUD, ví dụ seat map, scheduler, dashboard/report hoặc content editor.
- Feature-specific workspace vẫn MUST reuse design tokens, typography, Button/Input/Badge/Dialog primitives, loading/error/success language và accessibility conventions chung.
- Không được ép workflow đặc thù vào CRUD pattern nếu làm giảm usability.

### Shared component ownership

- MUST reuse shared component khi use case tương đương.
- MUST NOT tạo feature-specific Button, Dialog, Table, Pagination, Badge hoặc CRUD action khi shared equivalent tồn tại.
- Nếu shared component chưa đáp ứng use case tương đương, SHOULD mở rộng API của shared component trước.
- Chỉ tạo component feature-specific khi interaction model thực sự khác; code review/report MUST nêu lý do rõ ràng.

### CSS ownership

- CSS của Admin shell và shared component MUST nằm trong `src/styles/admin-components.css` hoặc stylesheet colocated của shared component theo convention project.
- Stylesheet của dashboard/feature chỉ được chứa style riêng cho layout/domain của feature đó.
- MUST NOT để shared component phụ thuộc vào CSS của một feature.
- Khi extract shared component, MUST xóa dead/duplicate feature CSS tương ứng.

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

### UI/UX skills

- UI/UX skills chỉ dùng để review consistency, accessibility, responsive và usability.
- MUST NOT để UI/UX skill override `DESIGN.md`, shared component contract hoặc golden reference đã duyệt.
