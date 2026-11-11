# Feature 12 — Dashboard & Báo cáo doanh thu theo nhà xe

**Phiên bản tài liệu:** 2026-10-22 · **Trạng thái:** SPEC_READY / NOT_IMPLEMENTED
**GitHub baseline tham khảo:** `origin/develop` = `bc863de26fe9787f91e2078475f97c16d2f6423f` (kiểm tra lại lúc triển khai).
**Nơi làm việc:** **repo VexGo gốc trên branch feature riêng** — KHÔNG tạo git worktree, KHÔNG code trên `develop`.

## 1. Đã chốt, không cần brainstorming lại

- F12 **chỉ** là dashboard/báo cáo doanh thu **từng nhà xe**, không phải báo cáo tài chính toàn VexGo, không phải dashboard vận hành. **F13** dành cho Dashboard vận hành nhà xe, làm riêng sau F12.
- Mọi phương thức thanh toán hợp lệ được ghi `THANH_CONG` và **thực sự quyết toán bán dịch vụ** đều có thể góp doanh thu; không phân biệt online/thu trực tiếp nếu có bản ghi hợp lệ. Không tự bổ sung tính năng thu tiền mặt nếu chưa có.
- Vé xe + gửi hàng độc lập + gửi hàng kèm vé; giá đã giảm khuyến mãi; refund chỉ âm khi **thành công**, trong ngày refund thành công; các khoản đối soát và payment attempts không được cộng trùng.
- Dashboard: **6 KPI, 1 biểu đồ, 2 bảng**, ngày/tháng/quý/khoảng thời gian tùy chọn, CSV **chỉ nút và thông báo**, chưa export thực.
- Quyền: `revenue:read` thuộc tenant. `NHA_XE_ADMIN` có quyền mặc định; nhân viên có quyền được cấp; `SUPER_ADMIN` platform không được xem dữ liệu tenant qua API này.
- **Chỉ viết unit test** cho logic backend khó quan sát bằng UI (money, allocations, timezone, refunds, duplication, tenant/RBAC, DTO). KHÔNG viết/chạy integration, E2E, automation browser, UI component test. Người dùng **tự smoke test** giao diện; agent bàn giao checklist, không nhận vơ kết quả PASS.

## 2. Cách chạy tại repo gốc — KHÔNG có bước setup worktree

1. Người dùng đặt ZIP cạnh repo hoặc giải nén trực tiếp tại root repo VexGo, giữ nguyên prefix `docs/features/tenant-revenue-reporting/`. Cung cấp ZIP/path cho agent nếu cần agent tự giải nén.
2. Mở agent tại **repo gốc** VexGo; dùng **một** prompt `PROMPT_GOAL.txt`. Agent kiểm tra git status, fetch `origin/develop` và tạo/chuyển sang branch feature trong **cùng repository working directory** (xem `SETUP_REPO.md`). Không xóa/stash/reset thay đổi người dùng khi branch chưa sạch.
3. Agent cấu hình DB **`vexgo_feature12`** và shadow **`vexgo_feature12_shadow`** trên MySQL chia sẻ `3306`; phpMyAdmin chia sẻ `8091`; Web `3017`, Admin `3018`, API `4019`. Chỉ được xóa/reseed demo DB của F12; bảo vệ DB khác. Không tự tạo một stack MySQL đè server shared.
4. Đọc `MASTER_SPEC.md`, `handoff/PROGRESS.md`, handoff gần nhất, và **chỉ** file `spec/PHASE_XX_*.md` của phase đang làm. Phải đọc root `AGENTS.md` và quy chuẩn nội bộ có liên quan; sửa UI Admin thì đọc `apps/admin/AGENTS.md` và `apps/admin/DESIGN.md`.
5. Làm tuần tự **00 → 01 → 02 → 03**. Mỗi phase: thực hiện đúng phạm vi → **targeted unit tests** (nếu có logic cần test) → typecheck/lint/build trong phạm vi phù hợp → self-review kỹ → commit local → handoff + PROGRESS → mới chuyển phase. Nếu không có test áp dụng, ghi rõ vì sao chứ không tạo test hời hợt.
6. Phase 03 chốt code review và lập checklist smoke UI/HTTP thủ công để người dùng tự thử. Không tự push, tạo PR hay merge.

## 3. Danh mục file

| File | Mục đích |
|---|---|
| `MASTER_SPEC.md` | Nguyên tắc nghiệp vụ, định nghĩa tiền, công thức, security, API contract, scope F12/F13 |
| `spec/PHASE_00_BASELINE_AND_DATA_CONTRACT.md` | Audit code thật và sửa tối thiểu dữ liệu/timestamps/settlement nếu cần |
| `spec/PHASE_01_REVENUE_API_AND_AUTH.md` | Read API, SQL/Prisma aggregation và RBAC theo tenant |
| `spec/PHASE_02_ADMIN_DASHBOARD.md` | 6 KPI, chart, 2 bảng, filter và CSV placeholder |
| `spec/PHASE_03_FINAL_REGRESSION.md` | Targeted unit/quality/static review, bàn giao manual smoke checklist |
| `handoff/INITIAL_HANDOFF.md` | Tóm tắt tiền đề và baseline đã kiểm tra |
| `handoff/PROGRESS.md` | Phase hiện tại, commit và tình trạng; khôi phục ngữ cảnh sau compact |
| `handoff/PHASE_HANDOFF_TEMPLATE.md` + `PHASE_XX_HANDOFF.md` | Template và handoff thật mỗi phase |
| `SETUP_REPO.md` | Branch repo gốc, env, 2 DB riêng, ports, seed/Prisma an toàn |
| `PROMPT_GOAL.txt` | Prompt dùng được với Codex, Claude Code, Antigravity (CLI/Desktop) |

## 4. Các quyết định KHÔNG tự đổi

- Không thêm dashboard F13, thống kê chi phí/lợi nhuận, KPI vận hành (lấp đầy, số chuyến), drilldown từng tuyến/chuyến, xuất CSV thật, báo cáo platform, data warehouse/cron/cache.
- Không giả dữ liệu runtime; ví dụ fixture chỉ nằm trong unit test hoặc DB demo riêng. Demo data có thể chuẩn hóa/reset khi an toàn, nhưng không sửa/truncate DB `vexgo` hay feature khác.
- Không chạy integration/E2E/browser tests dưới bất kỳ tên khác. **Migration deploy/generate/seed là thao tác môi trường, không phải integration test**; chỉ thực hiện nếu liên quan và an toàn.
- Không tạo worktree; không chạy Setup Prompt của bản ZIP cũ; mọi tham chiếu kiểu `SETUP_WORKTREE.md`, `PROMPT_SETUP_WORKTREE.txt` trong bản cũ đã bị loại bỏ.

**Đọc tiếp:** `MASTER_SPEC.md` rồi `SETUP_REPO.md`; agent xem thêm current phase spec theo `handoff/PROGRESS.md`.
