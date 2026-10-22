# F12 — PROGRESS pointer & session recovery

**Hồ sơ này là pointer duy nhất cho phase hiện tại.** Placeholder phase files không chứng minh phase hoàn thành.

- `STATE`: `IN_PROGRESS`
- `CURRENT_PHASE`: `01`
- `LAST_COMPLETED_PHASE`: `00`
- `LAST_COMPLETED_HANDOFF`: `handoff/PHASE_00_HANDOFF.md`
- `BASE_SHA_REFERENCE`: `bc863de26fe9787f91e2078475f97c16d2f6423f`
- `ACTUAL_ORIGIN_DEVELOP_SHA`: `bc863de26fe9787f91e2078475f97c16d2f6423f`
- `WORKING_MODE`: `ROOT_REPOSITORY_FEATURE_BRANCH_NO_WORKTREE`
- `BRANCH`: `feature/tenant-revenue-reporting`
- `DB_APP`: `vexgo_feature12`
- `DB_SHADOW`: `vexgo_feature12_shadow`
- `KNOWN_BLOCKER`: `none; shared phpMyAdmin listens on 9090 rather than requested 8091 and was left untouched; shipment-refund and cash-payment writers are not present in current source`

## Nguyên tắc đọc theo phase (bắt buộc)

1. Sau compact/new session đọc `MASTER_SPEC.md`, file này, `LAST_COMPLETED_HANDOFF` và **CHỈ** file `spec/PHASE_<CURRENT_PHASE>_*.md`.
2. Xem `git status`, current branch, commit/hash và evidence trước khi triển khai; không reset/stash thay đổi người khác.
3. Một phase DONE sau khi implement phạm vi (nếu cần), targeted unit tests/quality gates, self-review, local commit, handoff của phase. Không giả PASS cho test chưa chạy.
4. Update `LAST_COMPLETED_PHASE`, handoff, CURRENT_PHASE sang phase kế tiếp; `03` done → `CURRENT_PHASE=DONE`, `STATE=READY_FOR_USER_SMOKE`. Nếu blocker, giữ phase hiện tại, ghi nguyên nhân, không tự qua phase khác.
5. Test policy: **unit only**; user tự UI smoke; no integration/e2e/browser/UI auto.

## Ledger

| Phase | Status | Commit | Targeted unit/quality | Handoff |
|---|---|---|---|---|
| 00 | DONE | `ca578c8` | Final targeted unit 58/58 PASS; API typecheck/lint/build PASS; diff/migration status PASS | `PHASE_00_HANDOFF.md` |
| 01 | IN_PROGRESS | — | — | `PHASE_01_HANDOFF.md` placeholder |
| 02 | NOT_STARTED | — | — | `PHASE_02_HANDOFF.md` placeholder |
| 03 | NOT_STARTED | — | — | `PHASE_03_HANDOFF.md` placeholder |
