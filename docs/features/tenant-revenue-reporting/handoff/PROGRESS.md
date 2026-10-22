# F12 — PROGRESS pointer & session recovery

**Hồ sơ này là pointer duy nhất cho phase hiện tại.** Placeholder phase files không chứng minh phase hoàn thành.

- STATE: READY_FOR_USER_SMOKE
- CURRENT_PHASE: DONE
- LAST_COMPLETED_PHASE: 03
- LAST_COMPLETED_HANDOFF: handoff/PHASE_03_HANDOFF.md
- BASE_SHA_REFERENCE: bc863de26fe9787f91e2078475f97c16d2f6423f
- ACTUAL_ORIGIN_DEVELOP_SHA: bc863de26fe9787f91e2078475f97c16d2f6423f
- WORKING_MODE: ROOT_REPOSITORY_FEATURE_BRANCH_NO_WORKTREE
- BRANCH: feature/tenant-revenue-reporting
- DB_APP: vexgo_feature12
- DB_SHADOW: vexgo_feature12_shadow
- KNOWN_BLOCKER: none for user smoke; Codex has not run runtime API/DB/browser/UI checks; GitNexus Phase 03 reported CRITICAL/broad unrelated graph reach and stale-index metadata (retained in handoff); shared phpMyAdmin listens on 9090 rather than requested 8091 and was left untouched; current source has no shipment-refund or cash-payment writer; REFUND_PROVIDER_URL is empty

## Nguyên tắc đọc theo phase (bắt buộc)

1. Sau compact/new session đọc MASTER_SPEC.md, file này, LAST_COMPLETED_HANDOFF và CHỈ file spec/PHASE_<CURRENT_PHASE>_*.md.
2. Xem git status, current branch, commit/hash và evidence trước khi triển khai; không reset/stash thay đổi người khác.
3. Một phase DONE sau khi implement phạm vi (nếu cần), targeted unit tests/quality gates, self-review, local commit, handoff của phase. Không giả PASS cho test chưa chạy.
4. Update LAST_COMPLETED_PHASE, handoff, CURRENT_PHASE sang phase kế tiếp; 03 done → CURRENT_PHASE=DONE, STATE=READY_FOR_USER_SMOKE. Nếu blocker, giữ phase hiện tại, ghi nguyên nhân, không tự qua phase khác.
5. Test policy: unit only; user tự UI smoke; no integration/e2e/browser/UI auto.

## Ledger

| Phase | Status | Commit | Targeted unit/quality | Handoff |
|---|---|---|---|---|
| 00 | DONE | ca578c8 | Final targeted unit 58/58 PASS; API typecheck/lint/build PASS; diff/migration status PASS | PHASE_00_HANDOFF.md |
| 01 | DONE | 775492e | Targeted UNIT 50/50 PASS; API typecheck/lint/build PASS; F12 permission migration/status PASS | PHASE_01_HANDOFF.md |
| 02 | DONE | c64501c | Targeted API UNIT 17/17 PASS; Admin/API typecheck, scoped Admin lint, API lint, Admin/API build and diff checks PASS; integration/E2E/UI NOT RUN BY REQUEST | PHASE_02_HANDOFF.md |
| 03 | DONE | 07e6158 | Targeted API UNIT 91/91 PASS; Admin/API typecheck, scoped Admin lint, API lint, Admin/API build and diff checks PASS; integration/E2E/UI NOT RUN BY REQUEST; READY_FOR_USER_SMOKE | PHASE_03_HANDOFF.md |

## Final status

- Implementation code commit: `07e6158 fix(f12): bổ sung chú giải và kiểm chứng chính xác VND`.
- A Vietnamese Conventional documentation commit immediately follows for this handoff and progress record.
- Automated checks listed above are static/unit evidence only; no Admin/API/database runtime or browser/UI behavior is reported as PASS.
- User action: execute the checklist in `handoff/PHASE_03_HANDOFF.md`; stop this goal after the handoff. Do not push, open a PR, merge, or start F13.
