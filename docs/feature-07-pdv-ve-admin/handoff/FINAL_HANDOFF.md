# Final handoff — Feature 07 Admin booking/ticket

**Tình trạng:** MVP Phase 01–05 đã triển khai trong phạm vi Admin read-only. CI push/PR của implementation baseline PASS; F4, F3, F6 được reviewer xác nhận PASS và 4/4 review conversations đã resolved. **Browser smoke CHƯA XÁC MINH** vì Admin không thể kết nối API tại địa chỉ IPv4 cấu hình và chưa có tài khoản tenant test hợp lệ. PR #35 tiếp tục ở trạng thái Draft; chưa đủ bằng chứng để tuyên bố READY TO MERGE.

**Branch:** `feature/admin-bookings-tickets`

**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`

**Base:** `origin/develop` — `f2edf7f8562a2e397f58b7c88568e7f1e6bd40c5`

**PR:** [#35](https://github.com/quocan9999/vexgo/pull/35) — `develop` ← `feature/admin-bookings-tickets`

**Implementation baseline:** `91ac27618d694400a08562c19a5ac9c99fe8cf90`

**Repo gốc:** checkout `develop` không bị sửa.

> Bản handoff cũ trỏ tới `9a62e7dbbece5defa214913af38d78173623be8b`; SHA này không xuất hiện trong `git log origin/develop..HEAD`. Implementation baseline đúng trước finalization là `91ac27618d694400a08562c19a5ac9c99fe8cf90`.

## MVP đã hoàn thành

Feature cung cấp giao diện Admin nhà xe để đọc phiếu đặt vé và vé thuộc tenant được xác thực. API dùng chung và MySQL/Prisma hiện có; truy cập tenant và quyền `booking:read` được kiểm tra ở backend.

- **Phase 01:** quyền RBAC `booking:read`, phạm vi tenant và migration rollout idempotent.
- **Phase 02:** sáu GET API cho list, detail và history của phiếu đặt vé/vé.
- **Phase 03:** hai tab danh sách với tìm kiếm, filter, sort, pagination và đồng bộ URL.
- **Phase 04:** trang chi tiết riêng cho phiếu/vé, timeline riêng, tóm tắt thanh toán/hoàn tiền và hàng gửi liên quan khi có dữ liệu.
- **Phase 05:** tích hợp API thật, loading/error/empty và các regression tests liên quan; không thêm thao tác tạo/sửa/hủy/hoàn tiền/soát vé.

## Commit map thực tế

Danh sách được đối chiếu từ `git log --reverse origin/develop..HEAD` trước finalization, cũ → mới:

| Phạm vi | Commit |
| --- | --- |
| Đặc tả Feature 07 | `5ced98f6a01918512b7f24f46ab95302ee4a53d1` |
| Phase 01 — quyền xem phiếu đặt vé | `83ea8f43a57723732720574f5cbcd47954b78cb8` |
| Phase 02 — API tra cứu phiếu đặt vé/vé | `075ea917996655d9e808f673dfd087d039f2e3b7` |
| Handoff Phase 02 | `90afb3035e9dfd8f779cf05eef3497b9520f51a0` |
| Phase 03/04 — UI quản lý phiếu đặt vé/vé | `33c97be5ec74e9fc8151e08f0bd9cfd8310cd717` |
| Kiểm tra dữ liệu Feature 07 | `8a1a30506394140cc81f977b76dcc74ab86a12c0` |
| Handoff UI và môi trường | `f94c42ac3c40a740c1752f8ae9857f19d68b3f44` |
| Handoff nghiệm thu Phase 05 | `c041685c09dd97e39b489f5f3271df8b04e0dae9` |
| Implementation baseline trước hậu review | `e4837f3a40184c651dc73319e77bbc387e1d28ff` |
| F4 — draft date range và accessible validation | `866071e228ce8635b09a4b829bec273b4ff27d07` |
| F3 — DB-backed wildcard regression tests | `77af7fc4f9c4b83a87baec36b1cd2a21855324de` |
| F6 — pagination boundaries và Admin/API limit | `91ac27618d694400a08562c19a5ac9c99fe8cf90` |

### Handoff riêng và reviewer confirmation

- [FIX_F4_HANDOFF.md](FIX_F4_HANDOFF.md), commit `866071e228ce8635b09a4b829bec273b4ff27d07` — [reviewer xác nhận F4 PASS](https://github.com/quocan9999/vexgo/pull/35#discussion_r4228372948).
- [FIX_F3_HANDOFF.md](FIX_F3_HANDOFF.md), commit `77af7fc4f9c4b83a87baec36b1cd2a21855324de` — [reviewer xác nhận F3 PASS](https://github.com/quocan9999/vexgo/pull/35#discussion_r4228811369).
- [FIX_F6_HANDOFF.md](FIX_F6_HANDOFF.md), commit `91ac27618d694400a08562c19a5ac9c99fe8cf90` — [F6-A PASS](https://github.com/quocan9999/vexgo/pull/35#discussion_r4229041388) và [F6-B PASS](https://github.com/quocan9999/vexgo/pull/35#discussion_r4229041883).
- GitHub review threads: **4/4 resolved**. Coder không tự resolve.

## CI và kiểm tra tự động

Implementation baseline `91ac27618d694400a08562c19a5ac9c99fe8cf90` có cả hai workflow thành công, mỗi workflow PASS API/Admin/Web (3/3 jobs):

- [CI `push`](https://github.com/quocan9999/vexgo/actions/runs/37916194886) — PASS 3/3.
- [CI `pull_request`](https://github.com/quocan9999/vexgo/actions/runs/37916201562) — PASS 3/3.

Reviewer kiểm tra log CI thật: API DB suite có 14/14 tests và toàn API 1372/1372 PASS; Admin 390/390 tests, typecheck/lint/build PASS. Kiểm tra local F6 cũng đã chạy API integration 14/14, Admin query/component 35/35, lint/typecheck/build hai workspace và `git diff --check` đều PASS. Các chi tiết và lệnh cụ thể ở handoff F3/F6.

## Browser smoke test — CHƯA XÁC MINH

Đã thử bằng Chrome thật với worktree Feature 07, không dùng mock browser:

- Admin Next dev server khởi chạy tại port `3002`; các route trả HTTP 200.
- API Nest khởi chạy tại port `4001`; `GET http://localhost:4001/api/v1/health` trả HTTP 200.
- Worktree `.env` và `apps/admin/.env.local` cấu hình Admin/API bằng `127.0.0.1`. Trên máy này Nest chỉ listen tại `[::]:4001`: request tới `127.0.0.1:4001` bị từ chối, trong khi `localhost:4001` hoạt động. Vì vậy Admin session bootstrap không truy cập được API và trang chỉ hiện “Đang kiểm tra phiên quản trị…”.
- Đã mở list booking và deep link `?bPage=10001` ở viewport 1440×900; đã mở login và deep link tickets `?tab=tickets&tPage=10001` ở viewport 375×667. Hai viewport được xác nhận trong Chrome. Chỉ thấy trạng thái kiểm tra phiên; list/detail/history không render. Deep link chưa đi qua parser của trang nên không thể dùng lần mở này để xác nhận F6 runtime.
- `scrollWidth` bằng viewport width cho trạng thái loading shell ở cả hai kích thước; điều này **không** xác nhận layout nội dung list/detail không tràn ngang. Không có warning/error trong browser console; Next dev server có cảnh báo HMR cross-origin cho host `127.0.0.1` (`allowedDevOrigins`), không sửa config trong lượt finalization này.
- Không tìm thấy tài khoản test tenant hoặc credential hợp lệ trong tài liệu Feature 07. Không gửi login, không thực hiện thao tác nghiệp vụ, không chạy migration/seed/reset/drop; refund provider bị giữ trống khi API chạy để ngăn processor tự chạy. DB/volume không bị thay đổi.

Do blocker kết nối IPv4 ở trên và không có tài khoản tenant hợp lệ, chưa xác minh bằng browser các tương tác search/filter/sort/pagination/tab, F4 date validation và recovery, F6 canonicalization, detail/history, tenant/permission, empty/error states hay nội dung responsive. Không có screenshot/video Feature 07 hợp lệ để đính kèm. Cần chạy lại smoke sau khi API lắng nghe đúng host `127.0.0.1:4001` và có tài khoản test tenant `booking:read` được phê duyệt.

## Dependency ngoài scope và lưu ý triển khai

- Feature 07 chỉ đọc. Customer cancellation/ownership và runtime history writer thuộc luồng khác.
- Chính sách hủy vé kèm shipment, phí hủy hàng, refund provider/`REFUND_PROVIDER_URL` và mutation shipment không thuộc phạm vi PR này.
- Chi tiết shipment Feature 09 chỉ được liên kết nếu route tồn tại và người dùng có quyền; không thuộc nghiệm thu của PR này.
- Không tự động chuyển booking sang `HOAN_THANH`; UI hiển thị trạng thái thật từ DB.
- Migration `20261008050000_add_booking_read_permission` rollout quyền `booking:read`; deploy bằng Prisma migration theo quy trình của repository. CI DB-backed dùng schema riêng `vexgo_feature07_ci_test` và `FEATURE07_TEST_DATABASE_URL`.
- Không đưa `.env`, `.env.local`, password, secret, token, logs, generated artifacts hoặc `POST_REVIEW_FINDINGS_F4_F3_F6.md` vào commit.

## Kết luận

MVP functionally complete; F4/F3/F6 đã được reviewer xác nhận PASS và mọi review conversation đã resolve. Tuy nhiên browser smoke chưa xác minh do API host mismatch và thiếu tài khoản tenant test. Giữ PR #35 ở Draft; không tuyên bố READY TO MERGE.
