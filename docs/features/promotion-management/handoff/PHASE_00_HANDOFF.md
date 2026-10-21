# PHASE 00 HANDOFF — Baseline & contract

- Status: **DONE**; handoff/spec/contract đã rà soát, Phase 01 là bước tiếp theo.
- Worktree: E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10
- Branch: feature/tenant-promotions
- Baseline HEAD: 0a2888f9e836fc40c6b5f057cce517802dd7d6fb, trùng origin/develop và SHA trong MASTER_SPEC; không có delta code trước Phase 00.
- Files giao phase: docs/features/promotion-management/CONTRACT_FREEZE.md, docs/features/promotion-management/handoff/PHASE_00_HANDOFF.md.
- Không sửa source nghiệp vụ, migration, seed, database, container/volume khác hay repo gốc. .env đã được kiểm tra nhưng không cần sửa. ZIP vexgo_feature10_promotions_specs_v3_overnight.zip trong root worktree giữ nguyên; tài liệu trong ZIP khớp byte-for-byte với thư mục docs hiện có; không commit ZIP.
- Handoff ban đầu ghi setup chưa xác nhận; phase này đã kiểm tra lại worktree/env/ports/DB và thay trạng thái stale đó bằng bằng chứng hiện tại.

## Evidence

- git rev-parse HEAD, git branch --show-current, git worktree list: đúng worktree/branch; repo gốc và các worktree khác không sửa.
- git status: trước Phase 00 không có tracked changes; chỉ untracked ZIP v3. Env files tồn tại và bị ignore.
- .env: DATABASE_URL/MIGRATION_URL → 127.0.0.1:3306/vexgo_promotion; SHADOW_DATABASE_URL → 127.0.0.1:3306/vexgo_promotion_shadow. Username là các account feature riêng đã cấu hình trong URL; không in credential.
- Customer .env.local: port 3010, VEXGO_API_URL và NEXT_PUBLIC_API_URL là http://localhost:4010/api/v1.
- Admin .env.local: port 3011, NEXT_PUBLIC_API_URL là http://localhost:4010/.
- Root .env: API port 4010, MySQL port 3306, phpMyAdmin port 8090; CORS origins http://localhost:3010,http://localhost:3011; Admin refresh-cookie origin http://localhost:3011 (giá trị raw không có dấu / cuối).
- Port 8090 đang do phpMyAdmin Feature 10 hiện hữu giữ; 3010, 3011, 4010 trống ở lần audit. Shared MySQL container vexgo-mysql-1 map 127.0.0.1:3306 và volume hiện hữu vexgo_mysql_data. Container đã dừng lúc kiểm tra đầu nên được start lại; không tạo container/volume mới.
- Metadata MySQL chỉ đọc: schemas vexgo và vexgo_shadow tồn tại; vexgo_promotion và vexgo_promotion_shadow không tồn tại. Không đọc/thay đổi nội dung DB khác. mysql.user hiện chỉ có root, vexgo_app và system accounts; chưa thấy vexgo_promotion_app hoặc vexgo_promotion_migrator. Không có grant/DDL nào được thực hiện.
- Read-only prisma migrate status --schema=prisma/schema.prisma FAIL/CHƯA XÁC MINH: Prisma schema engine báo Unknown authentication plugin sha256_password. Không chạy migration/seed/reset. Phase 01 phải tạo schema và user feature-scoped bằng auth plugin MySQL hiện hành, rồi xác minh connection/grants trước migration.
- Port check: 8090 active; 3010/3011/4010 free. No app server started.
- apps/admin/DESIGN.md, apps/admin/AGENTS.md, apps/web/AGENTS.md, prisma.config.ts, master spec và Phase 00 spec đã đọc.
- GitNexus CLI index riêng worktree: 11,727 nodes, 27,001 edges, 376 clusters, 828 flows. Index cảnh báo cross-language unresolved refs và process truncation; các impact cụ thể nêu dưới đây là exact, nhưng không dùng absence-of-caller làm bằng chứng duy nhất.
- Literal search /promotions/validate trong apps không tìm thấy client; promotionCode chỉ tồn tại trong API; apps hiện chỉ có api/admin/web.
- ApiResponseInterceptor tự bọc resource {data}; ApiExceptionFilter output error envelope; booking quote hiện chưa nhận phone/principal, và promotion code invalid hiện silent fallback.
- Seed hiện tạo 15 promotion records với DANG_HOAT_DONG, SAP_DIEN_RA, HET_HAN, TAM_NGUNG; validation service chỉ tìm HOAT_DONG. verify-seed.mjs assert cũ status/count, giaNiemYet = giaThucTe, booking gross bằng tổng giaThucTe, và không coupon trên booking/shipment.
- Ticket cancellation quote hiện dùng Prisma.Decimal(ticket.giaThucTe) để tính phí/refund; vì vậy Phase 04 phải lưu giá vé ròng sau phân bổ discount vào Ve.giaThucTe và sửa verifier/assertions tương ứng.

## GitNexus impact — trước khi sửa code

- PromotionsService.validatePromotion: HIGH, exact; 5 impacted symbols; callers BookingsService.getBookingQuote, PromotionsController.validatePromotion, và tests; process CreateBooking → ValidatePromotion.
- BookingsService.getBookingQuote: HIGH, exact; 2 direct + 1 indirect caller; process createBooking; modules Bookings, Bus-companies, Shipments.
- BookingsService.createBooking: LOW upstream; controller caller; vẫn là booking transaction critical path.
- isPermissionAllowedForRole: HIGH, exact; 12 impacted symbols; 3 processes cho replace/reset tenant permissions và default role permissions.
- Không hạ HIGH bằng riskSharedAxes. Trước Phase 02/04, chạy lại impact trên index hiện hành; nếu UNKNOWN, xác minh literal/call sites trước khi sửa.

## Self-review / Phase 00 checks

- Đã audit schema fields/legacy shipment relation, promotions controller/service/DTO, booking quote/create DTO, seed/verifier, customer API/payment discount, permission catalog, Admin access/design, customer phone verification, refund calculation.
- Đã rà logic examples trong CONTRACT_FREEZE: guest→register phone, tài khoản đổi contact phone, 1 code/2 tickets, ngày cuối, quote/rollback, cạnh tranh quota cuối, cancellation/refund, cargo booking/standalone.
- Không chạy full tests vì Phase 00 spec giới hạn ở static check và contract examples; phase này không đổi code.
- git diff --check và graph detect_changes sẽ chạy sau khi stage đúng hai tài liệu phase này, trước commit.

## Next: Phase 01 — schema, quota, ledger

1. Đọc chỉ spec/PHASE_01_DATABASE_QUOTA.md, tiếp tục từ commit Phase 00.
2. Trước DDL/migration/reset: xác minh cwd/branch và cả ba URL đúng host/port/schema; xác minh connection thực tế là hai DB Feature 10. Hiện hai DB và hai user feature-scoped chưa tồn tại trên shared container; chỉ tạo đúng hai DB này và accounts giới hạn quyền tương ứng.
3. Không đụng vexgo, vexgo_shadow, database khác, repo gốc, container/volume khác. Không chạy migrate reset nếu schema hiện trống; reset chỉ khi có legacy xung đột và preflight target được ghi lại.
4. Dùng Context7 để tra tài liệu Prisma 7.10 trước migration/generate; tạo migration forward-only, schema, seed/verifier và test DB thật theo spec.
5. Sau phase: test targeted, self-review, handoff evidence, commit Conventional Commit tiếng Việt rồi tự tiếp tục Phase 02.

SHA: commit chứa handoff (sẽ báo SHA thực sau khi commit)