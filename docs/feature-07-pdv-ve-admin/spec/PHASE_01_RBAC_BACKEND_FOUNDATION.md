# Phase 01 Spec — RBAC + Backend Foundation

**Feature:** 07 Quản lý phiếu đặt vé & vé (Admin nhà xe)  
**Trạng thái:** Ready for Agent sau khi môi trường worktree độc lập được kiểm tra  
**Prerequisite:** Đọc `../ENVIRONMENT_WORKTREE.md`, `MASTER_SPEC.md`, `AGENTS.md` và các file RBAC hiện tại; không coding trước khi setup worktree/DB xong.

## 1. Goal

Bổ sung permission `booking:read` thuộc tenant; đảm bảo nó được nhận diện qua catalog → DB role-permission → session effective permissions → frontend typing/route menu foundation, đồng thời giữ nguyên tenant override và Super Admin protection. Chuẩn bị foundation cần thiết cho Phase 02 tạo Admin booking/ticket GET API; **Phase 01 không implement danh sách/detail/history thật**.

## 2. In scope

1. Backend permission catalog: thêm `{ key: 'booking:read', scope: 'tenant', description: ... }` trong `apps/api/src/auth/permissions/permission-catalog.ts`.
2. `ADMIN_ROLE_DEFAULT_PERMISSION_KEYS`: thêm vào `NHA_XE_ADMIN`. Không thêm cho `SUPER_ADMIN`, không cấp mặc định cho các nhân viên nếu chưa có quyết định. Admin nhà xe có thể cấp quyền cho các role tenant theo cơ chế existing.
3. Đảm bảo DB `Quyen` có bản ghi và mapping `VaiTroQuyen` cho default `NHA_XE_ADMIN` trên **database worktree** qua rollout idempotent, audit `prisma/seed.mjs` hiện có trước khi dùng. Không lạm dụng seed toàn bộ demo nếu có nguy cơ ghi đè tài khoản/phiếu đã tồn tại. Nếu viết script chuyên biệt, cần scoped, re-runnable, không đụng dữ liệu nghiệp vụ và có test phù hợp.
4. Có cơ chế xác minh quyền mới được resolver/load từ DB session (không tin permissions từ client/JWT stale). Kiểm tra tenant override: override của role đang tồn tại là quyền effective chính xác, **không tự bổ sung `booking:read` vào override** nếu người quản trị chưa cấp; tránh ghi đè các override.
5. Frontend authorization types thêm `booking:read` ở `apps/admin/src/features/admin-auth/services/admin-access.ts`; không cần hoàn thiện UI hai tab cho tới Phase 03. Nếu Phase 01 cập nhật route guard/shell, chỉ cập nhật foundation gọn, không tạo route trống dẫn đến link chết. UI navigation/menu activation khi route được làm ở Phase 03.
6. Module/controller foundation có thể chuẩn bị khi thực sự giúp Phase 02, nhưng không tạo unused empty code chỉ để đủ file; API endpoint GET thật thuộc Phase 02.
7. Đọc và reuse `TENANT_PRINCIPAL_ROLES`, `requireTenantPrincipal`, `RequirePermissions`/`RequireRoles` có sẵn. Không chế tạo policy bypass cho `SUPER_ADMIN`.

## 3. Out of scope

- Không thêm enum `HUY_MOT_PHAN`, thay đổi DB schema `PhieuDatVe/Ve` hoặc history tables.
- Không thêm Prisma migration schema chỉ để lưu permission row nếu schema không đổi. Dữ liệu RBAC có thể cần **data sync** riêng, không trộn với schema migration.
- Không xây 6 GET endpoints, UI list/detail/timeline, Customer cancellation, shipment cancellation, refund logic.
- Không đổi port trong tracked `apps/admin/package.json`/`apps/web/package.json`; dùng CLI + `.env` local như `ENVIRONMENT_WORKTREE.md`.
- Không push, PR, merge hoặc sửa repo/database gốc.

## 4. Grounding trong develop

Các file cần kiểm tra, đối chiếu HEAD thực tế trước implement:

- `apps/api/src/auth/permissions/permission-catalog.ts`: catalog + default role keys (chưa có `booking:read` tại snapshot `f2edf7f`).
- `apps/api/src/auth/permissions/effective-role-permission-loader.service.ts`: tenant override thay thế global mappings của role.
- `apps/api/src/auth/permissions/permission-resolver.service.ts`: lọc catalog theo `platform`/`tenant`.
- `apps/api/src/auth/principal-scope.ts`, `tenant-scope.ts`, decorators/guards.
- `apps/api/src/admin-rbac/tenant-role-permissions.service.ts`: validate tenant catalog, quản lý overrides.
- `prisma/schema.prisma`: `Quyen`, `VaiTroQuyen`, `CauHinhQuyenVaiTroNhaXe`, `CauHinhQuyenVaiTroNhaXeChiTiet`.
- `prisma/seed.mjs`: `seedPermissionCatalog` và `seedDefaultRolePermissions`; đánh giá tác động trước khi chạy.
- `apps/admin/src/features/admin-auth/services/admin-access.ts`, `admin-scope.ts`, component `admin-session-guard.tsx`, sidebar layout.
- Các tests RBAC/auth/permissions hiện hữu; `apps/admin/AGENTS.md` và `DESIGN.md` nếu sửa frontend.

## 5. Database permission rollout (quan trọng)

- `Quyen.tenQuyen='booking:read'` là duy nhất, phải tạo/idempotent upsert.
- `VaiTroQuyen` với `NHA_XE_ADMIN` được thêm nếu thiếu, không xóa mapping khác, tuyệt đối không thêm vào `SUPER_ADMIN`.
- Tenant roles đã có hàng override: không tự thay đổi/append override khi feature deploy. Nếu override không chứa `booking:read`, người dùng trong role **chưa có quyền** theo thiết kế; cần admin cấp qua chức năng phân quyền hiện hữu. Document thao tác này trong handoff.
- Catalog là source of truth cho validation/permission types; DB là source of truth cho effective assignment. Không giả lập permission trong UI hoặc hard-code bypass.
- Không seed vào database original `vexgo` tại port3306. Cần kiểm tra tên DB `vexgo_feature07` / port3307 và shadow riêng trước mọi thao tác. Đánh giá seed đầy đủ có tác dụng phụ; ưu tiên data rollout tối thiểu, idempotent.
- Nếu cần thay logic bootstrap để production sau merge có quyền mới: phải có cách rollout tài liệu hóa và được review; migration deploy đơn thuần **không tự thêm permission row** khi schema không đổi.

## 6. Error/security contract dự bị Phase 02

Expected Phase 02: controller `@RequireRoles(...TENANT_PRINCIPAL_ROLES)` và `@RequirePermissions('booking:read')`; service dùng `requireTenantPrincipal(principal)` rồi hạn chế bằng `donGiaoDich.nhaXeId` trong Prisma; cross-tenant detail/history trả 404. Phase 01 có thể test policy guard qua controller fixture/test harness có sẵn, không báo đã test tenant DB queries khi endpoints chưa có.

## 7. Tests — không chỉ pass cho có

**Đơn vị/integration của RBAC hiện hữu:**

1. New catalog key `booking:read` là `tenant`, không `platform`.
2. `NHA_XE_ADMIN` default có key, `SUPER_ADMIN` không có; other staff default không tự có.
3. Permission resolver chỉ xuất key trong scope `tenant` khi role assignment hợp lệ; không xuất cho platform.
4. DB-backed default role mapping được đọc từ `VaiTroQuyen` sau data rollout trên DB feature; idempotency: chạy lại rollout không nhân bản, không xóa quyền cũ.
5. Override giữ nguyên tập permission cũ sau rollout; override chứa key được effective, override không chứa key thì vẫn bị từ chối.
6. Revoke permission qua tenant RBAC => session/guard cập nhật sau refresh theo cơ chế DB-backed; không dựa vào stale token client.
7. Test để lộ thiếu dữ liệu catalog/mapping: bỏ mapping sẽ bị deny thay vì UI giả vẫn pass.
8. Test unauthorized role, role-scope-conflict và missing tenant identity fail đóng.

Dùng ít nhất một integration DB-backed thực tế trên test DB **thuộc Docker feature**, không dùng mock Prisma để thay thế chứng minh quyền effective. Không test trên DB gốc; không dùng test code xóa các phiếu đang có. Test isolation dữ liệu phiếu/vé được làm ở Phase 02.

**Gates:** targeted RBAC/auth/api tests, Admin permission tests (nếu chỉnh frontend), affected lint, typecheck/build, `git diff --check`. Chỉ báo test pass khi chạy thật; ghi lệnh và số lượng test trong handoff.

## 8. Definition of Done

- Worktree, branch, ports, DB isolation verified và đã ghi `handoff/ENVIRONMENT_HANDOFF.md` không chứa secrets.
- Catalog, default role, DB mapping, resolver, tenant overrides, frontend types nhất quán.
- `booking:read` có hiệu lực sau đăng nhập/refresh theo DB trên worktree, không có ở SUPER_ADMIN.
- Chạy lại rollout không làm thay đổi tenant override, không nhân bản DB record.
- Đủ negative/integration tests; targeted checks pass; không có endpoint giả/mock và không leak tenant.
- Tự đọc `git diff` và `git status`, không có `.env`, secret, local container files, generated code, logs, unused files trong commit.
- Conventional Commit local bằng tiếng Việt, handoff Phase 01 ghi changed files, test logs, commit SHA, blockers/dependencies, hướng triển khai Phase 02.

## 9. Giao Agent Phase 01

Agent chỉ làm đúng Phase 01 sau khi hoàn thành environment preflight. Không lập trình Phase 02–05 sớm, không tự sửa Customer cancellation. Khi thấy thay đổi mới trên `develop`, báo impact, làm việc theo code hiện tại thay vì áp snapshot máy móc. Tự kiểm tra từng test có bắt được bug thực tế nào; nếu không, cải thiện test.
