# PHASE 01 — Shipment RBAC / permission foundation

**Dependency:** Environment verified; docs trong đúng worktree. **Không viết UI/Shipment CRUD trong phase này.**

## Goal

Cấp quyền tenant-scoped để Admin/nhân viên có thể quản lý shipment ở các phase kế tiếp, giữ nguyên security boundary và quyền tenant tùy chỉnh.

## Scope và code cần inspect

- `apps/api/src/auth/permissions/permission-catalog.ts`, default permissions, dữ liệu bảng `Quyen`, `VaiTroQuyen` / tenant override nếu có; các guard `@RequireRoles`, `@RequirePermissions`, session principal và tenant helpers.
- Chỗ seed/bootstrap/sync permission đang có; thực trạng permissions trong DB Feature 09 sau seed; các test RBAC chính của repo.
- Admin session/menu permission contract chỉ **inspect**, chưa đổi UI ở phase này.

## Implementation

1. Thêm đúng hai permission catalog `shipment:read` và `shipment:update`, scope `tenant`, description tiếng Việt hợp lý.
2. Đặt mặc định cho `NHA_XE_ADMIN` và `NHAN_VIEN_DIEU_HANH` theo policy đã chốt; roles khác không tự có. `SUPER_ADMIN` là platform-only, không lấy tenant operational scope.
3. Đồng bộ dữ liệu quyền ở DB Feature 09 theo cơ chế của repo **idempotent** (cả lần seed ban đầu và DB đã seed trước khi permission mới được thêm). Không revoke/replace các gán quyền đã tùy chỉnh của tenant. Không cấp quyền theo email, user-provided role/tenant ID hoặc phép join thiếu phạm vi.
4. Khi thay quyền session đang dùng, tuân thủ cách backend refresh DB-backed permission của repo, không tin claim JWT stale. Không hạ guard global/public endpoint.
5. Không thêm Prisma migration chỉ để có permission catalog khi schema RBAC đã có; nếu model bắt buộc sửa, báo blocker, không tự mở rộng.

## Tests có ích (ưu tiên)

- Tenant Admin/operator mặc định có quyền đúng; SUPER_ADMIN và các role khác **không tự được gán**.
- Permission catalog và seed/sync chạy lặp không tạo duplicate hoặc reset tenant override.
- Employee có quyền được nhận session permission đúng; khi bị thu hồi thì backend từ chối mutation dù UI đang hiển thị stale.
- Không giả định test pass chỉ vì helper trả mảng mới; kiểm tra DB-backed khi có thể.
- Không tạo test trivial `toBeDefined`/`status 200` thiếu assertion.

## Gate / handoff

- Targeted RBAC tests, API typecheck/lint/build affected; GitNexus impact trước sửa/detect-changes trước commit; self-review security và diff.
- Viết `handoff/PHASE_01_HANDOFF.md` theo template; phải nêu permission DB sync thực tế và blockers.
- Commit logic (có body gạch đầu dòng) với subject gợi ý: `feat(auth): bổ sung quyền quản lý gửi hàng theo nhà xe`.
- Phase 02 chỉ bắt đầu khi quyền đọc/ghi có thể được guard hiện tại nhận diện.
