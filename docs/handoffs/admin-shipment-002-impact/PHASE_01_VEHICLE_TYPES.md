# Phase 1 — Vehicle Types: default cargo capacities

## BASELINE

- Branch: `fix/admin-shipment-002-impact` (do not switch branches).
- Base `HEAD`: `538d947f6bad99d360b45b40bdc37aed7c8718cb`, merge commit for PR #31 from `origin/develop`.
- The worktree was clean before Phase 1 edits.
- `LoaiXe` already contains `sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, and `sucChuaHangNheMacDinh` as `Int` fields with database default `0`. No schema or migration change is needed.
- Scope is Phase 1 only. Trip behavior and Phase 2 are untouched.

## COMPLETED

- Exposed all three existing `LoaiXe` defaults on vehicle type list and detail responses.
- Added create support with omitted values defaulting to zero, and update support where omitted values preserve the stored values.
- Added backend validation for integer values from `0` through signed Int32 max (`2147483647`).
- Added Admin create/edit fields, defaults, client validation, accessible field errors, and the required explanatory copy.
- Fixed the duplicate dialog-description and textarea IDs; the dialog now describes its header paragraph and the “Mô tả” label resolves to the textarea.
- Kept tenant scoping, authorization, endpoint paths, response envelopes, and existing description behavior unchanged.
- Added targeted API and Admin regression coverage.

## CHANGED_FILES

- `apps/api/src/vehicle-types/dto/vehicle-type-write-fields.dto.ts`
- `apps/api/src/vehicle-types/vehicle-types.service.ts`
- `apps/api/test/integration/vehicle-types/vehicle-types.spec.ts`
- `apps/api/test/integration/vehicle-types/vehicle-types-write.spec.ts`
- `apps/api/test/unit/vehicle-types/vehicle-types.service.spec.ts`
- `apps/api/test/unit/vehicle-types/vehicle-types-write.service.spec.ts`
- `apps/admin/src/features/vehicle-types/types/vehicle-type.ts`
- `apps/admin/src/features/vehicle-types/services/vehicle-type-service.ts`
- `apps/admin/src/features/vehicle-types/components/vehicle-type-form-dialog.tsx`
- `apps/admin/src/features/vehicle-types/vehicle-types.css`
- `apps/admin/test/vehicle-type-capacities.spec.tsx`
- `apps/admin/test/feature-02-ui-regressions.spec.tsx`
- `apps/admin/test/vehicle-type-permissions.spec.tsx`
- `docs/handoffs/admin-shipment-002-impact/PHASE_01_VEHICLE_TYPES.md`

## API_CONTRACT_AFTER_PHASE

Endpoints remain shared and unchanged:

- `GET /api/v1/vehicle-types` and `GET /api/v1/vehicle-types/:id` return the three fields on every resource in the existing `{ data, meta? }` envelope:

  ```json
  {
    "motorbikeCapacityDefault": 0,
    "bulkyCargoCapacityDefault": 0,
    "lightCargoCapacityDefault": 0
  }
  ```

- `POST /api/v1/vehicle-types` accepts those optional integer fields; omission persists `0`.
- `PATCH /api/v1/vehicle-types/:id` accepts those optional integer fields; omission leaves each stored value unchanged.
- Negative, decimal, null, or greater-than-`2147483647` values fail request validation with the existing `VALIDATION_ERROR` response contract.
- Prisma fields map as follows: `sucChuaXeMayMacDinh` → `motorbikeCapacityDefault`, `sucChuaHangCongKenhMacDinh` → `bulkyCargoCapacityDefault`, `sucChuaHangNheMacDinh` → `lightCargoCapacityDefault`.

## TESTS_RUN

- API targeted tests:
  `npm test --workspace=@vexgo/api -- test/integration/vehicle-types/vehicle-types.spec.ts test/integration/vehicle-types/vehicle-types-write.spec.ts test/unit/vehicle-types/vehicle-types.service.spec.ts test/unit/vehicle-types/vehicle-types-write.service.spec.ts`
- Admin targeted tests:
  `npm test --workspace=@vexgo/admin -- test/vehicle-type-capacities.spec.tsx test/feature-02-ui-regressions.spec.tsx test/vehicle-type-permissions.spec.tsx`
- Accessibility review regression test:
  `npm test --workspace=@vexgo/admin -- test/vehicle-type-capacities.spec.tsx`
- `npm run typecheck --workspace=@vexgo/api`
- Post-review Admin typecheck:
  `npm run typecheck --workspace=@vexgo/admin`
- `npm run lint --workspace=@vexgo/api`
- Targeted Admin ESLint on the three changed feature files and three vehicle type test files.
- Prettier check on all changed TypeScript, TSX, and CSS files.
- `node .gitnexus/run.cjs detect-changes --scope all --repo .`
- Browser inspection of `/vehicle-types` at 1440×900 and 375×667.

## TEST_RESULTS

- API: 4 targeted files passed, 84 tests passed.
- Initial Phase 1 Admin run: 3 targeted files passed, 17 tests passed; after adding the review regression, `vehicle-type-capacities.spec.tsx` passed all 11 tests.
- API and Admin typechecks passed.
- API lint, targeted Admin lint, and Prettier check passed.
- GitNexus detected 14 changed files, 48 symbols, and 17 affected execution flows. It reports `CRITICAL` risk because the shared `isVehicleType` response validator now requires the expanded resource shape. Its list, detail, create, and update paths were reviewed and covered by the targeted tests; downstream API consumers must return these fields.
- Browser smoke could not reach the feature form: the route rendered the existing “Chưa thể xác minh phiên đăng nhập” guard at both viewports. No auth bypass was attempted. Component tests cover the form behavior, but a signed-in visual check remains outstanding.
- The first test-first runs failed on the missing capacity behavior as expected. The description helper has since been changed from a direct selector workaround to an accessible label query; unsupported Jest DOM matcher assertions were replaced with DOM assertions.
- The accessibility regression first failed because “Mô tả” resolved to a non-labellable `<p>`. After separating the IDs, the accessible label resolves to the textarea, the dialog’s accessible description resolves to its paragraph, and the two IDs are unique.

## DECISIONS

- Reused the existing Prisma columns and values; no schema, migration, table, or backend module was added.
- Kept the update DTO fields optional and conditionally omitted them from Prisma `updateMany.data`, so API omission means preserve.
- Applied strict Int32 validation on both API writes and Admin response parsing to match the database field range.
- The UML `capNhatThongTin(tenLoai, moTa)` operation lists only the pre-existing fields but states no invariant that capacities are immutable. The Phase 1 feature spec explicitly requires editing these defaults, so this is treated as a conceptual omission rather than a conflicting rule.
- No `ChuyenXe` or Trips behavior was changed; existing trip snapshots remain outside this phase.

## KNOWN_LIMITATIONS

- A signed-in browser check of the actual form is still needed because the available browser session was not authenticated.
- GitNexus marks the shared vehicle type response validator as high blast radius (`CRITICAL` overall detect result, 17 affected flows). The API contract expansion is intentional; callers consuming the shared response must use the updated fields and type.

## NEXT_PHASE

Phase 2 is Trips only, and should start after Phase 1 review. Follow the Phase 2 section of `docs/fix-admin-shipment-002-impact/ADMIN_SHIPMENT_002_IMPACT_SPEC.md`: add `acceptsShipments` on create (default `false`), copy the three capacity defaults from `LoaiXe` into the new trip snapshot, and expose shipment acceptance plus snapshot capacities in Admin trip reads. Do not add trip capacity overrides, trip update mutations for shipment acceptance, remaining-capacity calculations, or shipment runtime behavior.

## NEXT_FILES_TO_READ

- `docs/fix-admin-shipment-002-impact/ADMIN_SHIPMENT_002_IMPACT_SPEC.md` (Phase 2 sections 6.1–6.10 and acceptance criteria).
- `prisma/schema.prisma` (`LoaiXe` defaults and `ChuyenXe` snapshot fields).
- `apps/api/src/trips/dto/create-trip.dto.ts`
- `apps/api/src/trips/dto/update-trip.dto.ts`
- `apps/api/src/trips/trips.service.ts`
- `apps/api/test/unit/trips/trips.service.spec.ts`
- `apps/api/test/integration/trips/trips-read.spec.ts`
- `apps/api/test/integration/trips/trips-write.spec.ts`
- `apps/admin/src/features/trips/types/trip.ts`
- `apps/admin/src/features/trips/services/trip-service.ts`
- `apps/admin/src/features/trips/components/trip-form-dialog.tsx`
- `apps/admin/src/features/trips/components/trips-management.tsx`
- `apps/admin/src/features/trips/components/trip-detail-sheet.tsx`
- `apps/admin/test/trips-read.spec.tsx`
- `apps/admin/test/trips-write.spec.tsx`

## COMMIT

- Phase 1 implementation: `8d84c48e1e4eb647ac910301cc25daedfa914438` (`feat(admin): cấu hình sức chứa mặc định cho loại xe`).
- Accessibility review fix: separate commit on `fix/admin-shipment-002-impact` with message `fix(admin): sửa accessibility form loại xe`.
