# Bàn giao chuyển hệ component Admin — 25/10/2026

## Phạm vi hoàn tất

- Thống nhất primitives shadcn/ui base-nova trên Base UI và các Resource patterns; contract tại DESIGN.md, workflow tại AGENTS.md.
- Migrate các màn quản trị đã được người dùng duyệt, gồm danh sách/chi tiết, cấu hình ghế, RBAC, đăng nhập, shell/sidebar/header và dashboard Super Admin.
- Toast thao tác ở góc dưới bên phải. Mười một form dùng ResourceSheetForm với vùng field cuộn riêng, footer không che field.
- Dashboard Super Admin dùng API toàn nền tảng thật, tách khỏi doanh thu/vận hành từng nhà xe; không còn fixture làm nguồn dữ liệu chính.
- Xóa 13 file component legacy và stylesheet filter không còn consumer trực tiếp. Giữ các layout styles còn được sử dụng và ngoại lệ workspace theo DESIGN.md.
- Sửa lỗi type của fixture Sheet; suy ra loading/error dashboard từ request identity/refresh, giữ hủy request cũ và binding snapshot theo tài khoản; xử lý hai lint warning.

## Kết quả kiểm chứng local

| Kiểm tra | Kết quả |
| --- | --- |
| Admin typecheck | PASS |
| Admin ESLint | PASS — 0 error, 0 warning |
| Admin production build | PASS |
| API typecheck | PASS |
| API lint | PASS |
| API build, gồm Prisma generate | PASS |
| Backend unit regression được chọn | PASS — 9 files, 116 tests |
| git diff --check | PASS |
| integration/E2E/UI/component/browser automation | NOT RUN BY REQUEST tại local |
| Authenticated HTTP và SQL runtime dashboard | NOT RUN; không suy ra PASS từ unit/build |

Lệnh unit regression, chạy từ root:

```powershell
npm run test --workspace=@vexgo/api -- test/unit/platform-dashboard test/unit/auth/access-token.guard.spec.ts test/unit/auth/tenant-scope.spec.ts test/unit/auth/permission-resolver.spec.ts test/unit/auth/permission-catalog.spec.ts test/unit/revenue-reports/revenue-reports.authorization.spec.ts test/unit/revenue-reports/revenue-reports.service.spec.ts test/unit/admin-accounts/admin-accounts.service.spec.ts
```

Unit dashboard dùng service/guard thật với dependency Prisma được mock. Assertions kiểm tra phân quyền, query filters, projection/mapping, transaction isolation và boundary tháng/timezone; không chứng minh hành vi SQL thật. Test UI đã cập nhật source nhưng chưa thực thi. CI hiện có được giữ nguyên; kết quả CI phải đọc riêng trên PR.

## Nghiệm thu và giới hạn

- Người dùng đã duyệt các màn, báo smoke 11 form và RBAC, duyệt dashboard Super Admin. Không có kết quả chi tiết từng viewport/scenario nên không gán PASS toàn bộ visual/keyboard/runtime.
- GitNexus index cũ: graph có thể còn consumer trước migration hoặc thiếu module dashboard mới. Pre-edit impact và source references đã được đối chiếu; không coi UNKNOWN hoặc zero edges là an toàn.
- Không đổi env, cổng, schema, migration, seed hoặc dữ liệu DB trong bước chốt này. Không sửa CI gates, không merge hoặc resolve review conversation.
- Migration date-only DTO/API legacy sang DD-MM-YYYY là hạng mục riêng cần chuyển đồng bộ consumer, không âm thầm đổi wire format trong migration UI.

## Điểm bàn giao

Phần triển khai UI được duyệt và kiểm tra kỹ thuật local được phép đã hoàn tất. PR ở trạng thái draft để reviewer đọc diff và kết quả CI; không cần mở vòng redesign mới cho các route đã duyệt. Các kiểm chứng runtime hoặc suite bị loại trừ ở trên vẫn phải được ghi nhận riêng trước khi kết luận release-ready.
