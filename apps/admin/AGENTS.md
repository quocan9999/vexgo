<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Admin UI reuse

- MUST đọc `DESIGN.md` trước khi sửa Admin UI và inspect `src/components/admin/` cùng `src/components/ui/` trước khi tạo primitive/component mới.
- MUST reuse shared component khi use case tương đương; MUST NOT tạo feature-specific Button, Dialog, Table, Pagination hoặc Badge khi shared equivalent tồn tại.
- MUST NOT tạo design language riêng cho từng feature. Feature-specific workspace MAY tồn tại khi nghiệp vụ cần interaction khác CRUD, nhưng MUST reuse tokens và primitives chung.
- Nếu shared component chưa đáp ứng, SHOULD mở rộng shared component; nếu tạo component mới, MUST có lý do use case khác biệt rõ ràng.
- UI/UX skill chỉ dùng để review consistency, accessibility và responsive; MUST NOT override `DESIGN.md` hoặc golden reference đã duyệt.
- CSS của Admin shell và shared component MUST nằm trong `src/styles/admin-components.css`; stylesheet của dashboard/feature chỉ chứa style riêng cho view/feature đó.
