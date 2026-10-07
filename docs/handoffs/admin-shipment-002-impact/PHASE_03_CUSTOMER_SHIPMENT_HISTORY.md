# Phase 3 — Customer Workspace: lịch sử gửi hàng theo schema 002

## PREVIOUS_COMMITS

- Phase 1 capacity: `8d84c48e1e4eb647ac910301cc25daedfa914438`.
- Phase 1 accessibility correction: `9f4db6cf26c58abc90f6e905378a00df97dca6e6`.
- Phase 2 Trips: `06d34ecd05c7ebbcb9f366ef627d4c57f871409f`.
- Phase 2 Fare Price fixture correction: `52936c93ff5659c8b3d168e88f132a9b2c31061b`.

## API_CONTRACT_FINAL

`GET /api/v1/customers/:id/shipments` returns paginated data with the existing metadata and these shipment fields:

- `shipmentId`, `waybillCode`, `sentAt`, `status`.
- `receiver: { fullName, phoneNumber }`.
- `mainFee`, `serviceFee`, `discountAmount`, `totalFee`, `freightPayer`.
- Required `trip: { tripId, code }`.
- Required `originPoint` and `destinationPoint`, each containing `pointId`, `code`, `name`, and `address`.

Trip and point values map directly from the required Prisma relations. Tenant scope, customer visibility, search fields, sort order, and pagination are unchanged.

## LEGACY_FIELDS_REMOVED

- Removed `pickupMethod`, `deliveryMethod`, and `pickupAddress`.
- Removed `receiver.address`; no receiver address is inferred from a point.
- Replaced `originBranch` and `destinationBranch` with required `originPoint` and `destinationPoint`.
- Removed nullable relation fallbacks for required trip and point relations.

## UI_CHANGES

- Desktop columns and mobile card fields separately label `Điểm gửi` and `Điểm nhận`, each with its name and address.
- Receiver display contains only name and phone number.
- Removed method/branch terminology and presentation, including `Lấy / Giao` and `Hình thức`.
- Status labels use only schema 002 values: `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN`, `DA_GIAO`, and `DA_HUY`.
- The history remains read-only; no shipment actions were added.

## TESTS_RUN

- `npm test --workspace=@vexgo/api -- test/integration/customers/admin-customers.spec.ts`
- `npm test --workspace=@vexgo/admin -- test/customer-shipments.spec.tsx`
- `npm run typecheck --workspace=@vexgo/api`
- `npm run typecheck --workspace=@vexgo/admin`
- `npm run lint --workspace=@vexgo/api`
- `npm run lint --workspace=@vexgo/admin -- src/features/customers/types/customer.ts src/features/customers/components/customer-shipments-tab.tsx test/customer-shipments.spec.tsx`
- `git diff --check`

## TEST_RESULTS

- API targeted integration file: 37/37 tests passed. It verifies the exact point/trip response, absence of legacy fields, tenant isolation, and shipment search.
- Admin targeted file: 5/5 tests passed. It verifies point names and addresses, receiver details, absence of method placeholders, all five statuses, and retains empty, error/retry, and search coverage.
- API and Admin typechecks passed; API lint and targeted Admin lint passed; `git diff --check` passed.
- Full API/Admin test suites were not run.

## REGRESSION_RISK

- The endpoint’s production consumer audit found the Admin Customer Workspace hook/service; no Customer Web consumer uses this endpoint. The API query and access checks were preserved and the integration tests still exercise tenant visibility and search.
- The API contract intentionally removes legacy response properties, so any untracked external consumer depending on those fields would need to migrate. Repository search found no such consumer.
- GitNexus `detect-changes` reports `CRITICAL` and 783 affected flows. After re-indexing, `impact shipmentStatusTone` still resolves unrelated API modules even though the function is file-local and a repository-wide text search finds only its two badge call sites. The analyzer also reports cross-language field-resolution gaps and truncated flow coverage. Direct search confirms the shipment point types are only referenced by this shipment contract; the endpoint method has one controller caller and a `LOW` impact result. Treat the graph’s broad process list as an analysis limitation, not proof that all 783 flows were individually verified.

## BROWSER_CHECK

- Skipped: Admin was not serving at `http://localhost:3001` and no authenticated browser session was available. The Customer Workspace render was covered by the targeted Admin test.

## NEXT_PHASE

Phase 4 — targeted regression, cleanup, and final handoff. Not started in this phase.
