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

Unit dashboard dùng service/guard thật với dependency Prisma được mock. Assertions kiểm tra phân quyền, query filters, projection/mapping, transaction isolation và boundary tháng/timezone; không chứng minh hành vi SQL thật. Test UI không chạy local; workflow CI hiện có đã thực thi các suite đầy đủ và được giữ nguyên. Kết quả từng revision phải đọc riêng trên PR #43.

## Nghiệm thu và giới hạn

- Người dùng đã duyệt các màn, báo smoke 11 form và RBAC, duyệt dashboard Super Admin. Không có kết quả chi tiết từng viewport/scenario nên không gán PASS toàn bộ visual/keyboard/runtime.
- GitNexus index cũ: graph có thể còn consumer trước migration hoặc thiếu module dashboard mới. Pre-edit impact và source references đã được đối chiếu; không coi UNKNOWN hoặc zero edges là an toàn.
- Không đổi env, cổng, schema, migration, seed hoặc dữ liệu DB trong bước chốt này. Không sửa CI gates, không merge hoặc resolve review conversation.
- Migration date-only DTO/API legacy sang DD-MM-YYYY là hạng mục riêng cần chuyển đồng bộ consumer, không âm thầm đổi wire format trong migration UI.

## Điểm bàn giao

Phần triển khai UI được duyệt và kiểm tra kỹ thuật local được phép đã hoàn tất. PR ở trạng thái draft để reviewer đọc diff và kết quả CI; không cần mở vòng redesign mới cho các route đã duyệt. Các kiểm chứng runtime hoặc suite bị loại trừ ở trên vẫn phải được ghi nhận riêng trước khi kết luận release-ready.

## CI follow-up — 25/10/2026

CI ban đầu trên bdeb1b8: API CI và Web CI PASS; Admin CI FAIL do môi trường JSDOM/mocks và assertion markup legacy. Đã cập nhật media-query API test setup, partial icon mocks, timestamp fixture, file path resolution và các role/label/variant assertions theo canonical contract; giữ business/callback/permission assertions. Không đổi workflow hoặc chạy UI suite local. Kết quả rerun CI được cập nhật trên PR #43.

## Khép các regression sau migration

- Các vòng CI trên branch giữ nguyên 481 test Admin; không skip test hoặc nới CI gates. Đã sửa mock icon thiếu export, media-query API của JSDOM, fixture thiếu timestamp, đọc file Node trong JSDOM, và assertion theo contract UI được duyệt.
- Select được thao tác qua popup; checkbox native và primitive được kiểm tra theo đúng contract; portal được render trên DOM. Modal đang mở phải ẩn phần nền khỏi accessibility tree. Toast thao tác được tách khỏi lỗi tải/validation inline.
- Regression cuối ở form bảng giá: Base UI SelectPositioner.onMapChange phát giá trị null với reason none khi các option tạm unmount để reload. Callback này từng xóa lựa chọn/lỗi server. Form nay hủy callback đồng bộ đó; các thay đổi do người dùng vẫn được xử lý. Test cũ được giữ và siết thêm selected label, aria-invalid và aria-describedby sau reload.
- Các assertion danh sách/thẻ mobile giữ kiểm tra cả hai detail actions, không chỉ kiểm tra một Card bất kỳ.
- Typecheck/lint/build Admin sau sửa PASS; trạng thái CI mới nhất và lịch sử kết quả nằm tại https://github.com/quocan9999/vexgo/pull/43. Không suy rộng thành PASS dashboard authenticated HTTP/SQL runtime.
- Lệnh refresh GitNexus tiếp tục dừng tiến triển tại Analyzer, đã ngắt đúng invocation sau khi chờ; index cũ vẫn là giới hạn được đối chiếu bằng source và diff.