# F12 — Handoff sau phase (template)

> Không được lấy template/pending làm bằng chứng thực thi. Dừng nếu blocker không được giải quyết. Nếu đang compact/new session, agent đọc PROGRESS + last completed handoff.

- Phase:
- Status: DONE / BLOCKED
- Repo root (không worktree):
- Branch/HEAD/actual `origin/develop` SHA:
- Commits (hash + subject Vietnamese Conventional):
- Files / API / Prisma schema & migrations changed:
- Money source, eligibility, timestamps, refund rules verified:
- Decimal/reconciliation invariant evidence:
- Tenant isolation / RBAC implications:
- Database target confirmed (`vexgo_feature12` + `_shadow`; **không để lộ secrets**):
- Targeted UNIT test commands and PASS/FAIL/SKIPPED (no fabricated results):
- Typecheck/lint/build/diff checks with outcomes:
- Integration/E2E/browser/UI automation: **NOT RUN (requested)**
- Static self-review findings and fixes:
- Manual UI smoke items handed to user (user will execute, do not report PASS):
- Open gaps / risks / blockers:
- Git status after commit:
- Next phase (chỉ nếu DONE):
- Resume instructions after compaction:

## Check before marking DONE

- [ ] Kiểm tra unit tests có thể **bắt bug thật**, không test lại giá trị mock.
- [ ] Chỉ thay code nghiệp vụ phase, không đưa secret/log/DB dump/screenshots/generated junk lên git.
- [ ] `git diff --check` và self-review; không auto push/PR.
- [ ] Commit theo định dạng Conventional tiếng Việt: **một dòng trống sau subject**, bullet body liên tục không có dòng trống giữa các gạch đầu dòng.
- [ ] Viết handoff thật và cập nhật PROGRESS.
- [ ] Không nói UI đã test thành công nếu người dùng chưa cung cấp bằng chứng; trạng thái cuối `READY_FOR_USER_SMOKE`.
