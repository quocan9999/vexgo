# Handoff sửa Finding F3 — Feature 07

**Trạng thái:** Đã bổ sung regression tests DB-backed và kiểm tra local; chờ reviewer xác nhận PASS.
**Branch:** feature/admin-bookings-tickets
**Worktree:** E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07
**Baseline SHA:** 866071e228ce8635b09a4b829bec273b4ff27d07 (đã có reviewer xác nhận F4 PASS)

## Gate và phạm vi

- Reviewer xác nhận **F4 PASS** tại commit 866071e228ce8635b09a4b829bec273b4ff27d07; review thread F4 đã được reviewer resolve. F3 và F6 vẫn mở.
- F3 là thiếu regression test qua DB thật; chưa có bằng chứng production search đang sai. Không sửa production code, API contract, schema hoặc migration.
- Chỉ kiểm tra hai list API: GET /api/v1/admin/bookings và GET /api/v1/admin/tickets.

## Thay đổi

- **apps/api/test/integration/bookings/admin-bookings-tickets-db.spec.ts**
  - Fixture builder có thể tạo booking/ticket code chứa chuỗi test dành riêng cho wildcard.
  - Test tìm kiếm thông thường được siết lại để kiểm tra đúng IDs, codes và meta.totalItems, thay cho kiểm tra totalItems > 0.
  - Thêm MySQL-backed HTTP test với literal %, _, \; mỗi trường hợp có lookalike âm tính trong tenant A và bản ghi cùng chuỗi trong tenant B.
  - Gửi request qua NestJS, service, Prisma và MySQL thật cho cả hai endpoint, dưới quyền tenant A và B; kiểm tra chính xác ID/code và meta.totalItems = 1. Lookalike và dữ liệu tenant còn lại không được xuất hiện.
  - Fixture dùng marker ngẫu nhiên F07-READ-...; afterAll xóa dữ liệu theo marker và xác minh không còn transaction/tenant fixture.
- Không sửa apps/api/src, prisma/schema.prisma, migrations, scripts CI hoặc dữ liệu nghiệp vụ.

## Database isolation

- Trước khi chạy test, đã phân tích URL mà không in credentials:
  - FEATURE07_TEST_DATABASE_URL → 127.0.0.1:3307/vexgo_feature07_test.
  - DATABASE_URL và MIGRATION_URL → 127.0.0.1:3307/vexgo_feature07.
  - SHADOW_DATABASE_URL → 127.0.0.1:3307/vexgo_feature07_shadow.
- Test URL khác runtime và shadow DB. Read-only query xác nhận kết nối tới vexgo_feature07_test, có 45 bảng và 24 migration đã áp dụng; MySQL mode không bật NO_BACKSLASH_ESCAPES.
- Container MySQL đang healthy trong Docker Compose project vexgo_feature07, publish host port 3307 và dùng volume vexgo_feature07_mysql_data.
- Không chạy migration, seed, database reset/drop hoặc thao tác lên DB runtime. Các lần chạy integration test chỉ tạo và cleanup fixture riêng có marker.

## RED / GREEN

- RED: tạm thời thay escapeSqlLike() bằng hàm trả nguyên chuỗi, chạy lại integration test trên cùng test DB. Test mới thất bại đúng tại wildcard %: meta.totalItems nhận 2, kỳ vọng 1; 9 test còn lại pass. Điều này chứng minh lookalike bị coi là wildcard khi bỏ escape.
- GREEN: khôi phục utility nguyên trạng; xác nhận git diff không có thay đổi ở apps/api/src/common/escape-sql-like.ts; chạy lại targeted integration và unit tests thành công.

## Verification

- npm run test --workspace=@vexgo/api -- test/integration/bookings/admin-bookings-tickets-db.spec.ts test/unit/common/escape-sql-like.spec.ts — 2 files, 16 tests PASS.
- npm run typecheck --workspace=@vexgo/api — PASS.
- npm run lint --workspace=@vexgo/api — PASS.
- npm run build --workspace=@vexgo/api — Prisma Client 7.10.0 generate và Nest build PASS; không phát sinh thay đổi tracked/generated trong Git.
- npx prettier --check apps/api/test/integration/bookings/admin-bookings-tickets-db.spec.ts — PASS.
- git diff --check — PASS.
- Không chạy toàn bộ API test suite: suite còn có migration test dùng DATABASE_URL runtime để tạo/xóa bảng và history DB test cần BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL chưa cấu hình. Để giữ đúng giới hạn DB, chỉ chạy DB-backed test liên quan F3 và utility unit test.

## Tự review và trạng thái còn lại

- Bản ghi lookalike thực sự được tạo trong MySQL cùng với bản ghi mục tiêu; test so sánh exact IDs/codes và total, không chỉ kiểm tra helper escape hoặc HTTP 200.
- Tenant B có dữ liệu cùng search string để xác nhận kết quả của tenant A không rò sang tenant khác; chạy ngược bằng token tenant B cũng chỉ trả bản ghi B.
- Chỉ thay đổi integration test và handoff này. POST_REVIEW_FINDINGS_F4_F3_F6.md không được stage/commit.
- F3 đang chờ reviewer kiểm tra commit và xác nhận PASS. Không tự resolve review conversation. F6 chưa thực hiện.
