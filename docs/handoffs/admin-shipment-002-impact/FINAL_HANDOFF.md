# Final handoff — Admin Shipment 002 impact

## GOAL

Hoàn tất các thay đổi Phase 1–3 cho Admin Shipment 002 trên branch `fix/admin-shipment-002-impact`, kiểm tra hồi quy có mục tiêu, cập nhật handoff và giữ ngoài phạm vi API shipment đầy đủ cùng Customer Web.

## BASE_COMMIT

- `538d947f6bad99d360b45b40bdc37aed7c8718cb` (`origin/develop` tại thời điểm bắt đầu branch).

## BRANCH

- `fix/admin-shipment-002-impact`
- Phase 3 source commit: `734996988e2a5246160dc710e8d23e1c570876d3`.

## PHASE_COMMITS

- Phase 1 Vehicle Types: `8d84c48e1e4eb647ac910301cc25daedfa914438`.
- Phase 1 accessibility correction: `9f4db6cf26c58abc90f6e905378a00df97dca6e6`.
- Phase 2 Trips: `06d34ecd05c7ebbcb9f366ef627d4c57f871409f`.
- Phase 2 Fare Price fixture correction: `52936c93ff5659c8b3d168e88f132a9b2c31061b`.
- Phase 3 Customer Shipment History: `734996988e2a5246160dc710e8d23e1c570876d3`.

## PHASE_01_SUMMARY

- API và Admin đọc/ghi ba mặc định sức chứa loại xe: xe máy, hàng cồng kềnh và hàng nhẹ.
- Create bỏ trống mặc định `0`; update bỏ trống giữ nguyên giá trị hiện tại. Giá trị được kiểm tra là số nguyên không âm trong phạm vi Int32.
- Form giải thích đây là sức chứa mặc định áp dụng cho chuyến mới.
- Dialog description và textarea “Mô tả” có ID riêng; regression test kiểm tra accessible label, dialog description và tính duy nhất của ID.

## PHASE_02_SUMMARY

- Tạo chuyến nhận `acceptsShipments?: boolean`, mặc định `false`; Admin có checkbox “Nhận gửi hàng”.
- Backend chụp ba giá trị mặc định từ loại xe vào capacity snapshot khi tạo chuyến.
- Trip list/detail đọc cờ nhận gửi và snapshot trực tiếp; không fallback sang cấu hình loại xe hiện tại.
- Không cập nhật cờ nhận gửi hoặc snapshot sau khi tạo chuyến. Fare Price fixtures có đủ ba field Vehicle Type theo contract Phase 1.

## PHASE_03_SUMMARY

- `GET /api/v1/customers/:id/shipments` trả dữ liệu phân trang với người nhận chỉ gồm tên/điện thoại, trip bắt buộc và hai điểm gửi/nhận bắt buộc.
- Đã bỏ `pickupMethod`, `deliveryMethod`, `pickupAddress`, `receiver.address`, `originBranch`, `destinationBranch` và fallback quan hệ nullable.
- Admin Customer Workspace hiển thị tên/địa chỉ hai điểm, năm trạng thái schema 002 và giữ lịch sử read-only.
- Giữ nguyên tenant scope, quyền truy cập, tìm kiếm, sắp xếp và pagination.

## FINAL_API_CONTRACTS

- Vehicle Type read/write gồm `motorbikeCapacityDefault`, `bulkyCargoCapacityDefault`, `lightCargoCapacityDefault`; create omission là `0`, update omission giữ nguyên.
- `POST /api/v1/trips` nhận `acceptsShipments?: boolean`; backend mặc định `false` và chụp capacity từ `LoaiXe`.
- Trip list/detail trả `acceptsShipments` và `cargoCapacity: { motorbikes, bulkyCargo, lightCargo }` từ snapshot.
- `PATCH /api/v1/trips/:id` không sửa cờ nhận gửi hoặc snapshot.
- `GET /api/v1/customers/:id/shipments` trả `receiver: { fullName, phoneNumber }`, required `trip`, `originPoint` và `destinationPoint`, cùng fee/status/pagination fields; không trả các field legacy nêu trên.

## FINAL_ADMIN_BEHAVIOR

- Vehicle Type form cho phép cấu hình ba mặc định với nhãn/help text và accessibility relationships rõ ràng.
- Trip form cho phép chọn “Nhận gửi hàng” lúc tạo; list/detail chỉ hiển thị cờ và snapshot hiện tại.
- Customer shipment history hiển thị rõ điểm gửi/nhận và trạng thái, không hiển thị hình thức lấy/giao hay địa chỉ người nhận; không có thao tác shipment.

## BUSINESS_RULES_PRESERVED

- Backend tiếp tục là nguồn sự thật; tenant/permission checks và response envelope hiện có được giữ nguyên.
- Thay đổi mặc định loại xe chỉ tác động chuyến mới; snapshot chuyến cũ không đổi.
- Snapshot được đọc từ `ChuyenXe`; không tính sức chứa còn lại hoặc sửa snapshot trong các phase này.
- Lịch sử shipment chỉ đọc; cước, tạo vận đơn, chuyển trạng thái và sức chứa runtime chưa được triển khai.
- Không thay đổi Prisma schema hoặc migration.

## OUT_OF_SCOPE

- Không làm Phase 4 tính năng hoặc Phase 5; Phase 4 trong handoff này chỉ là audit, regression và hoàn tất tài liệu.
- Không thêm module/API CRUD shipment, tính cước, cập nhật trạng thái, ghi history, giữ/nhả sức chứa hoặc xử lý concurrency shipment.
- Không nối Customer Web gửi hàng vào API thật.
- Không nối hành lý booking/payment draft vào persistence shipment; không mở booking khứ hồi kèm shipment.
- Không thay đổi schema, migration, seed hoặc database.

## REMAINING_WORK_FOR_FEATURE_09

- Xác định và triển khai API riêng để tra cứu điểm gửi/nhận theo tuyến và rate theo điểm, loại hàng, cân nặng, thời gian hiệu lực.
- Tạo shipment với bốn relation bắt buộc, một rate detail cho mỗi loại hàng, tổng cước được backend tính và snapshot được bảo toàn.
- Chuyển trạng thái kèm ghi `LichSuTrangThaiPhieuGuiHang` trong thao tác all-or-nothing.
- Tính sức chứa theo nhóm hàng và xử lý trạng thái hủy, giữ chỗ và cạnh tranh ở backend.
- Giữ hành vi bảo vệ khi hủy chuyến có shipment đang hoạt động.

## REMAINING_WORK_FOR_CUSTOMER

- Thay giao diện Customer Web gửi hàng tĩnh bằng service/API thật để tải điểm, chuyến đủ điều kiện, giá và sức chứa.
- Gửi đầy đủ từng món hàng lên backend; giữ riêng loại hàng và category; backend tính lại phí/sức chứa và tạo shipment cùng transaction phù hợp.
- Thay payment draft/invoice fixture bằng kết quả persistence thật; chốt thiết kế riêng trước khi hỗ trợ booking khứ hồi kèm shipment.

## TESTS_RUN

- API targeted regression: 8 files, 240 tests passed. Bao gồm Vehicle Types read/write, Trips unit/read/write và customer shipment integration.
- Admin targeted regression: 12 files, 101 tests passed. Bao gồm Vehicle Types/accessibility, Feature #02 UI regressions, Trips, Customer shipment history và năm Fare Price files.
- `npm run typecheck --workspace=@vexgo/api` — passed.
- `npm run typecheck --workspace=@vexgo/admin` — passed.
- `npm run lint --workspace=@vexgo/api` — passed.
- Admin ESLint trên các file source/test Phase 1–3 — passed.
- `npx prettier --check` trên toàn bộ file TS/TSX/CSS thay đổi — passed.
- `git diff --check` — passed; Git chỉ cảnh báo line ending LF/CRLF theo cấu hình Windows.
- `node .gitnexus/run.cjs detect-changes --scope all --repo .` — completed: 23 changed files, 29 symbols, `CRITICAL` risk, 793 affected flows.
- GitHub Actions run `37604228110` trên commit Phase 3: API CI, Admin CI và Web CI đều green. Actions sẽ được kiểm tra lại sau khi push commit final handoff.

## TESTS_NOT_RUN

- Không chạy full API/Admin test suites, API e2e suite, Web suite hoặc full build.
- Không chạy browser smoke vì không có browser/session khả dụng; localhost Admin/API cũng không phản hồi.

## WHY_FULL_SUITE_WAS_NOT_RUN

Yêu cầu Phase 4 giới hạn ở targeted union tests và typecheck/lint theo phạm vi thay đổi; không yêu cầu full suite. Các test đã chạy bao phủ trực tiếp Vehicle Types, Trips, Fare Price fixture contract và Customer shipment history.

## BROWSER_CHECK

- Không thực hiện smoke ở `/vehicle-types`, `/trips` và Customer Workspace.
- CUA không có browser/app khả dụng; `http://localhost:3001` và `http://localhost:4000` đều timeout.
- Không có đăng nhập hoặc bypass auth; kết quả render tiếp tục cần browser có phiên đăng nhập.

## KNOWN_LIMITATIONS

- Customer Web gửi hàng và booking kèm hành lý vẫn dùng flow demo/mock, chưa phải shipment persistence.
- Customer Web còn form gửi hàng tĩnh với `origin`/`destination` và `Nhận gửi hàng`; booking luggage draft còn field `pickup`. Đây là các flow chưa chuyển sang API 002, không phải consumer của endpoint history Admin.
- Không xác minh trực quan Admin bằng phiên đăng nhập.
- GitNexus Phase 4 `detect-changes` báo `CRITICAL`/793 flows. Danh sách có liên kết rộng tới flow không liên quan qua `shipmentStatusTone`; text search chỉ thấy định nghĩa và hai badge call sites cục bộ. Endpoint history có một controller caller; `TripsService.create` có một controller caller trong text search, còn GitNexus impact là lower-bound vì 76 call sites không resolve được receiver. Index báo FTS search degraded và flow tracing bị truncate; các số flow không được xem là đã review thủ công. Targeted tests xác minh contract liên quan.
- Các client ngoài repository nếu phụ thuộc field shipment legacy đã bị xóa cần chuyển sang contract điểm gửi/nhận mới.

## READY_FOR_PR_CHECKLIST

- [x] Phase 1–3 handoff ghi rõ contract, behavior, test và giới hạn.
- [x] Targeted API/Admin regression và typecheck đã pass.
- [x] API/Admin lint, format và `git diff --check` đã xác nhận.
- [x] GitNexus change analysis của Phase 4 đã chạy; rủi ro/giới hạn được ghi lại.
- [ ] Commit handoff đã push; API CI, Admin CI và Web CI trên Actions đã green.
- [x] Browser smoke đã thực hiện hoặc giới hạn môi trường đã được ghi lại như trên.
