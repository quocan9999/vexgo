# Phase 2 — Trips: nhận gửi hàng và snapshot sức chứa

## BASELINE

- Branch: `fix/admin-shipment-002-impact`.
- Baseline Phase 1: `9f4db6cf26c58abc90f6e905378a00df97dca6e6`.
- Chỉ triển khai Phase 2 của `docs/fix-admin-shipment-002-impact/ADMIN_SHIPMENT_002_IMPACT_SPEC.md`.
- Schema đã có `ChuyenXe.nhanGuiHang` và ba snapshot capacity bắt buộc; không sửa schema hoặc tạo migration.

## PHASE_01_COMMITS

- `8d84c48e1e4eb647ac910301cc25daedfa914438` — `feat(admin): cấu hình sức chứa mặc định cho loại xe`.
- `9f4db6cf26c58abc90f6e905378a00df97dca6e6` — `fix(admin): sửa accessibility form loại xe`.

## COMPLETED

- Admin có checkbox `Nhận gửi hàng` khi tạo chuyến; mặc định bỏ chọn và gửi `acceptsShipments`.
- API nhận `acceptsShipments?: boolean`, mặc định `false` nếu bị lược bỏ.
- API tự copy ba giá trị mặc định từ `LoaiXe` của xe sang snapshot `ChuyenXe` khi tạo.
- Admin list/detail đọc cờ nhận gửi và ba tổng snapshot từ API; không hiển thị hoặc tính “còn lại”.
- Không cho nhập/ghi đè capacity snapshot hoặc sửa cờ nhận gửi sau khi tạo chuyến.
- Giữ nguyên tenant checks, response envelope và transaction tạo chuyến cùng ghế chuyến.

## CHANGED_FILES

- `apps/api/src/trips/dto/create-trip.dto.ts`
- `apps/api/src/trips/trips.service.ts`
- `apps/api/test/unit/trips/trips.service.spec.ts`
- `apps/api/test/integration/trips/trips-read.spec.ts`
- `apps/api/test/integration/trips/trips-write.spec.ts`
- `apps/admin/src/features/trips/types/trip.ts`
- `apps/admin/src/features/trips/services/trip-service.ts`
- `apps/admin/src/features/trips/components/trip-form-dialog.tsx`
- `apps/admin/src/features/trips/components/trips-management.tsx`
- `apps/admin/src/features/trips/components/trip-detail-sheet.tsx`
- `apps/admin/src/features/trips/trips.css`
- `apps/admin/test/trips-read.spec.tsx`
- `apps/admin/test/trips-write.spec.tsx`
- `apps/admin/test/trips-seats.spec.tsx`
- `docs/handoffs/admin-shipment-002-impact/PHASE_02_TRIPS.md`

## API_CONTRACT_AFTER_PHASE

- `POST /api/v1/trips` nhận `acceptsShipments?: boolean`; bỏ field tương đương `false`.
- Client không được gửi `sucChuaXeMay`, `sucChuaHangCongKenh`, `sucChuaHangNhe` hoặc các snapshot capacity khác.
- Admin trip list và detail trả:

  ```ts
  acceptsShipments: boolean;
  cargoCapacity: {
    motorbikes: number;
    bulkyCargo: number;
    lightCargo: number;
  };
  ```

- `PATCH /api/v1/trips/:id` không nhận thay đổi `acceptsShipments` hoặc capacity snapshot; vẫn chỉ cập nhật lịch chạy theo contract hiện có.

## SNAPSHOT_RULE

- Khi tạo, backend lấy `LoaiXe.sucChuaXeMayMacDinh`, `sucChuaHangCongKenhMacDinh`, `sucChuaHangNheMacDinh` từ loại xe thuộc xe đã xác thực và ghi lần lượt vào ba field snapshot trên `ChuyenXe`.
- Trip list/detail map trực tiếp từ ba field snapshot của `ChuyenXe`, không đọc động hay fallback sang giá trị mặc định hiện tại của `LoaiXe`.
- Test phân biệt snapshot `(1, 2, 3)` với defaults lồng trong loại xe `(9, 9, 9)`; trip vẫn trả `(1, 2, 3)`. Giá trị `0` hợp lệ.
- Không áp dụng điều kiện `acceptsShipments=true` thì capacity phải lớn hơn 0.

## NHAN_GUI_HANG_RULE

- `acceptsShipments` ánh xạ sang `ChuyenXe.nhanGuiHang`; omission tạo giá trị `false`.
- Chỉ hỗ trợ chọn cờ khi tạo chuyến. Không thêm mutation bật/tắt sau khi tạo và không thêm shipment runtime.

## TRANSACTION_BEHAVIOR

- Việc ghi `ChuyenXe` và tạo `GheChuyenXe` tiếp tục nằm trong transaction hiện có.
- Đọc defaults được thực hiện trước transaction như luồng tạo chuyến hiện tại; không giữ transaction trong lúc gọi external service.
- Không sửa logic tranh chấp ghế/concurrency.

## TESTS_RUN

- `npm test --workspace=@vexgo/api -- test/unit/trips/trips.service.spec.ts test/integration/trips/trips-read.spec.ts test/integration/trips/trips-write.spec.ts`
- `npm test --workspace=@vexgo/admin -- test/trips-read.spec.tsx test/trips-write.spec.tsx test/trips-seats.spec.tsx`
- `npm run typecheck --workspace=@vexgo/api`
- `npm run typecheck --workspace=@vexgo/admin`
- `git diff --check`
- `node .gitnexus/run.cjs detect-changes --scope all --repo .`

## TEST_RESULTS

- API: 3 targeted files passed, 119 tests passed.
- Admin: 3 targeted files passed, 49 tests passed.
- API và Admin typecheck đều thành công.
- `git diff --check` thành công; chỉ có cảnh báo Git về chuyển đổi LF/CRLF trên các file đã sửa.
- GitNexus ghi nhận 14 file code/test, 24 symbols, 34 execution flows và mức rủi ro `CRITICAL`. Rủi ro chủ yếu do contract `Trip` và parser `isTrip` dùng chung được mở rộng; đã rà các mapper list/detail/write response và chạy test read, create/update cùng seat workspace.
- Không chạy toàn bộ Admin/API suite hoặc `trips-concurrency.spec.ts`.

## BROWSER_CHECK

- Đã thử route `/trips` ở viewport desktop `1440×900` và mobile `375×667`.
- Cả hai viewport chỉ hiển thị auth guard `Chưa thể xác minh phiên đăng nhập` / lỗi fetch; chưa thể xác minh trực quan phần Trips đã đăng nhập. Không bypass auth. Mobile capacity row được cấu hình span toàn chiều rộng và cho phép wrap.

## DECISIONS

- Dùng các cột schema 002 đã có; không thêm Prisma model, migration hoặc API riêng.
- Không mở rộng lookup xe để preview capacity trong form; backend vẫn là nguồn dữ liệu snapshot.
- Chấp nhận zero capacity và giữ nguyên quyền/tenant scoping hiện có.

## KNOWN_LIMITATIONS

- Cần kiểm tra trực quan lại route Trips bằng phiên Admin đã đăng nhập.
- GitNexus đánh dấu `CRITICAL` do contract trip được dùng qua nhiều flow; các response map của Trips Admin đã được cập nhật và kiểm tra bằng targeted tests.

## OUT_OF_SCOPE

- Override hoặc cập nhật snapshot capacity.
- Sửa `acceptsShipments` sau khi tạo.
- Remaining capacity, giữ chỗ hàng, shipment CRUD/status/runtime, fare/point CRUD.
- Booking kèm shipment, Customer shipment, payment/invoice, dashboard/report shipment.
- Schema/migration mới và Phase 3.

## CURRENT_GIT_STATUS

- Sau commit Phase 2, `git status --short --branch` được xác minh sạch trên `fix/admin-shipment-002-impact`.
- Không có thay đổi Phase 3 trong commit.

## NEXT_PHASE

Phase 3 — Customer Workspace: cleanup shipment history theo schema 002. Chỉ bắt đầu sau khi Phase 2 được review; không thực hiện trong handoff này.

## NEXT_FILES_TO_READ

- `docs/fix-admin-shipment-002-impact/ADMIN_SHIPMENT_002_IMPACT_SPEC.md` — Phase 3, mục 7.1–7.8.
- `docs/handoffs/admin-shipment-002-impact/PHASE_01_VEHICLE_TYPES.md`.
- `docs/handoffs/admin-shipment-002-impact/PHASE_02_TRIPS.md`.
- `apps/admin/src/features/customers/types/customer.ts`.
- `apps/admin/src/features/customers/services/customer-service.ts`.
- `apps/admin/test/customer-shipments.spec.tsx`.
- `apps/api/src/customers/customers.service.ts` và controller, cùng targeted customer shipment tests.
- `prisma/schema.prisma` và hai shipment handoff tại `docs/class-diagram/migration_handoff/`.

## COMMIT

- Message: `feat(admin): đồng bộ chuyến xe với cấu hình gửi hàng`.
- Commit SHA được báo sau khi hoàn tất commit Phase 2.
