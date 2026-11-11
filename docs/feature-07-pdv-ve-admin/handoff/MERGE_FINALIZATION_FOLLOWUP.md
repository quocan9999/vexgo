# PR #35 — Merge finalization follow-up

Date: 2026-10-19
Branch: `feature/admin-bookings-tickets`
Merge commit: `ef659c3852dfadff00b98462ff7bb0ee78373327` (parents `7bf5adbcb59ca6cf30c5ffa5dda53d8183b291e7` and `8b339250a95b6825cef591b1d10ae537ba1068f4`)

## CI result for the merge commit

| Event | Run | Web CI | Admin CI | API CI |
| --- | --- | --- | --- | --- |
| `push` | [39237118175](https://github.com/quocan9999/vexgo/actions/runs/39237118175) | PASS | PASS | FAIL |
| `pull_request` | [39237123516](https://github.com/quocan9999/vexgo/actions/runs/39237123516) | PASS | PASS | FAIL |

Both API runs failed only in `API tests`. The failing cases were `booking:read rollout target guard > allows the test mode only on its explicitly configured isolated DB` and `promotion integration database isolation > accepts the explicitly configured, isolated Feature 07 test database on port 3010`.

## Root cause and correction

The two unit-test fixtures represented local mode with a port-3010 Feature 07 test target but inherited GitHub Actions' process-level `CI=true`. The guard correctly applied the stricter CI contract, which only permits the scoped CI database on port 3306 or 3307. The production guard is unchanged. Both fixtures now set `CI: 'false'` explicitly to model local mode; their separate CI cases still test the CI restrictions.

## Verification after the merge commit

- Reproduced before the correction with `CI=true npm run test -- test/unit/admin-rbac/booking-read-rollout-guard.spec.ts test/unit/promotions/promotion-test-database.spec.ts`: 2 failed, 32 passed, 0 skipped.
- Re-ran the same command after the correction under `CI=true`: 34 passed, 0 failed, 0 skipped.
- `npm run typecheck` in `apps/api`: PASS.
- `npm run lint` in `apps/api`: PASS.
- No database tests were run locally for this test-fixture correction; no database was modified. The original CI runs completed the build and DB regression preparation before reporting the two unit-test failures.

The two test-fixture changes and this handoff are included in the follow-up commit immediately after the merge commit. CI must be checked on that commit before treating PR #35's checks as green.
