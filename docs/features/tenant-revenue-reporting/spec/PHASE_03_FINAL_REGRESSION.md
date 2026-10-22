# PHASE 03 — Final static review, targeted unit tests & bàn giao người dùng smoke UI

**Điều kiện:** Phase 00–02 DONE. Đọc `MASTER_SPEC.md`, `handoff/PROGRESS.md`, handoff gần nhất và **chỉ spec phase này**. Đây là phase đóng việc, không triển khai subfeature mới.

## Mục tiêu

Đảm bảo feature đủ đúng theo kiến trúc và các logic không quan sát được qua UI. **Không viết/chạy integration test hoặc E2E/browser/UI automated test**, không mở suite full không cần thiết. Người dùng tự chạy và kiểm tra giao diện thật sau khi nhận handoff.

## Checklist agent tự làm

1. Kiểm tra `git status`, branch F12 trong repo gốc, commit từng phase/handoff; không đang ở develop, không tự `git reset/stash/clean` làm mất thay đổi có sẵn; tài liệu nằm đúng `docs/features/tenant-revenue-reporting/`.
2. Đọc source đường tính tiền và mọi truy vấn theo tenant: chắc chắn không dựa vào current order status để xóa doanh thu lịch sử; không count thu muộn/đối soát; không double join theo `Ve` và `PhieuGuiHang`; không cộng phí hủy lần hai; tiền promo chỉ giảm một lần.
3. Soát logics `completedAt`/refund completion và source truth. Nếu `RefundProcessorService` chưa cấu hình provider, refund pending không được hiển thị là hoàn thực tế; hiện trạng cấu hình phải được nêu trong handoff.
4. Chạy lại **targeted unit tests** thực sự kiểm tra money, split, VND rounding, odd remainder, cross-tenant, authorization, 401/403 ở guard, invalid query, calendar 23:59/00:00 VN, group month/quarter, zero total, no-data. Thêm unit test **chỉ khi** phát hiện lỗ hổng logic backend khó test qua UI; không đổi mock chỉ để pass.
5. Chạy typecheck/lint/build trên các workspace chạm tới, `git diff --check`, kiểm tra file rác/untracked secrets, eslint exceptions, lazy mocks, hardcoded revenue, unsafe cast, duplicate code. Không mở full test suites/integration/e2e.
6. Nếu có migration, áp dụng vào **DB app F12** và generate Prisma; trước thao tác ghi DB, kiểm tra `DATABASE_URL`, `MIGRATION_URL`, `SHADOW_DATABASE_URL` kết thúc đúng tên DB F12. Đây là kiểm tra triển khai local, **không** gọi là automated integration test. Không chạy rollback/test migration trên DB khác.
7. Soát UI **bằng static review** để bảo đảm 6 KPI, 1 chart, 2 bảng, filter, CSV placeholder/tenant guard xuất hiện đúng source, follow `DESIGN.md`. Không chạy browser tool, UI tests hoặc tự tuyên bố đã nhìn thấy layout chạy đúng.
8. Viết checklist **cho người dùng tự smoke** với URL `http://localhost:3018`, API `http://localhost:4019`, Web `http://localhost:3017`; gồm account tenant A/B, employee granted/denied, empty/refund/zero/mixed/coupon, filter/day/month/quarter, toast, chart/table, responsive 1440×900 & 375×667. Nếu người dùng phát hiện lỗi thì sửa theo kết quả họ báo sau.
9. Tạo commit Conventional tiếng Việt cho sửa lỗi cuối (nếu có), kiểm tra lại self-review; cập nhật `handoff/PHASE_03_HANDOFF.md` và `handoff/PROGRESS.md`.

## Acceptance criteria / status trung thực

- [ ] Không có chỗ frontend/backend mock số tiền báo cáo, không tạo export thật hay dashboard F13; UI điều hướng/perms đầy đủ.
- [ ] Tất cả unit tests mục tiêu đã chạy PASS hoặc được ghi `SKIPPED/BLOCKED` với lý do; không dùng kết quả suite cũ để claim kết quả mới.
- [ ] Không cần integration/E2E; **không có chứng cứ runtime DB-backed/HTTP/UI automated** thì không thể tuyên bố các phần đó PASS.
- [ ] Security static/unit cover tenant predicate, role/permission và lỗi lọc; không claim full security verified.
- [ ] Phép cộng tổng đạt invariant trong unit cases; refund đúng ngày, nguồn và chưa thực hoàn không trừ.
- [ ] `git diff --check`, scoped typecheck/lint/build phù hợp (nếu lỗi môi trường ghi rõ).
- [ ] Handoff riêng Phase 03 chứa manual UI checklist, known limitations, các lệnh chạy thực tế, trạng thái `READY_FOR_USER_SMOKE` hoặc `BLOCKED`.
- [ ] Không tự push, PR, merge; không sửa code/DB không liên quan F12; không tự bắt đầu F13.

## Bàn giao cuối phải có

1. `origin/develop` baseline SHA thực khi bắt đầu + current branch/HEAD trong **repo gốc**.
2. Tóm tắt Phases 00–03, paths/commit SHA (không tự bịa) và migrations đã tạo.
3. Revenue source và timestamp/eligibility/attribution policy; trường hợp chưa hỗ trợ (cash nếu chưa có API, refund provider nếu thiếu cấu hình).
4. Lệnh unit test/typecheck/lint/build thực chạy + kết quả cụ thể; ghi rõ **`integration/E2E/UI automation: NOT RUN (theo yêu cầu)`**.
5. Danh sách manual UI smoke cases để người dùng kiểm tra; không đánh PASS thay người dùng.
6. Giới hạn bảo mật còn chưa kiểm tra runtime; dependency còn tồn tại; những chỗ cần user xác nhận.
7. Kết luận chính xác: **`READY_FOR_USER_SMOKE`** (static/unit gates đạt; UI/API runtime do user xác nhận) hoặc **`BLOCKED`** (lỗi/thiếu chứng cứ cốt lõi).

**Dừng sau handoff.** Không push/PR/merge và không tự động nhận F13.
