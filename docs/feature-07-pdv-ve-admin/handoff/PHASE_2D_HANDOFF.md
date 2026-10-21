# PR #35 — Phase 2D Loopback Alias Handoff

## Finding and change

`sameDatabaseTarget()` compared hostnames literally. As a result, `localhost`, `127.0.0.1`, and `::1` could be treated as separate MySQL instances even when they reach the same local server. Phase 2D normalizes those aliases only for isolation comparisons, mapping them to one comparison key. It leaves the parsed URL and connection hostname untouched.

Regression tests cover a test/runtime schema collision across aliases, a runtime/shadow collision across aliases, acceptance of distinct schemas on aliases at the same port, operator rollout validation across aliases, and rejection of CI test DB use on local-only port 3010. Existing tests still cover valid local port 3010 and CI ports 3306/3307. The operator test verifies that its original `localhost` hostname remains on the connection URL.

## Verification

The test-first run reproduced the issue: 3 expected alias/operator failures, with the other 31 tests in the two targeted files passing. After the fix, all 34 tests in those files passed.

All 76 Phase 2B/2C tests were rerun with the 5 new Phase 2D tests: **81 passed, 0 failed, 0 skipped**. The breakdown was 56 guard/unit tests, 14 Feature 07 bookings/tickets DB tests, 1 booking-permission rollout DB test, 6 promotions API DB tests, and 4 promotion schema DB tests. DB suites ran sequentially.

API `typecheck`, `lint`, and `build` all passed. Build regenerated the Prisma Client and completed Nest build.

## Database isolation

The only DB target used for DB-backed tests was the dedicated worktree test schema `127.0.0.1:3010/vexgo_feature07_test`, with scoped account `vexgo_feature07_test`. Its verified grants were `USAGE ON *.*` and `ALL PRIVILEGES ON vexgo_feature07_test.*`. Runtime and migration URLs point to schema `vexgo_feature07`; shadow points to `vexgo_feature07_shadow`. Credentials are omitted.

Integration tests wrote only test fixtures to the test schema and cleaned them up. No rollout was executed against an operator/runtime target. No migration, seed, reset, or drop was run against runtime or shadow databases.

## Patch and Git state

`PHASE_2D_REVIEW.patch` at the worktree root contains the helper change, regression tests, and this handoff report. The patch passes a reverse applicability check against the working tree. The worktree remains on `feature/admin-bookings-tickets`, with `HEAD=7bf5adbcb59ca6cf30c5ffa5dda53d8183b291e7` and `MERGE_HEAD=8b339250a95b6825cef591b1d10ae537ba1068f4`; there are no unmerged paths. No report or patch was staged. No commit, push, merge abort/reset, or GitHub conversation action was performed.

No blocker remains for reviewer inspection.
