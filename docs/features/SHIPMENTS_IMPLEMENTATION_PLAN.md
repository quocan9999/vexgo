# Kế hoạch triển khai gửi hàng độc lập

Ngày: 03-11-2026. Người dùng đã yêu cầu triển khai toàn bộ từ `SHIPMENTS_REWORK_PROPOSAL.md`, giữ hệ shadcn/ui Admin và dữ liệu cũ.

Trạng thái: **đã triển khai và kiểm chứng**. Kết quả, contract cuối và bằng chứng kiểm tra nằm tại `SHIPMENTS_REWORK_HANDOFF.md`.

## Quyết định triển khai

- Làm trên feature branch hiện tại; không đổi checkout đang dùng hoặc tạo worktree gây mất kết nối môi trường local. Không tự push/merge.
- Tìm nhà xe theo chuyến mở nhận hàng trong ngày dự kiến; vận đơn mới chưa chiếm sức chứa và chưa phân chuyến.
- Ngày dự kiến phải nằm trong cửa sổ 48 giờ mang hàng đến; ngày API mới DD-MM-YYYY, timestamp ISO.
- Cước báo theo ngày dự kiến; khi tiếp nhận dùng ngày thực tế, nếu thay đổi yêu cầu xác nhận chênh lệch. Snapshot lịch sử lưu trước/sau.
- Đơn đã có trip giữ nguyên; đơn mới standalone nullable trip, tuyến và ownership độc lập. Hàng kèm vé không đổi nghiệp vụ.
- Migration không reset và không tự hủy đơn cũ hàng loạt; hạn mới chỉ bật cho đơn mới. Không tự suy đoán cân thực tế lịch sử.
- Hết hạn online chỉ đóng attempt đang chờ; hạn mang hàng đến độc lập. Hủy đơn đã trả tiền tạo hồ sơ đối soát, không tự hoàn.
- Bộ phận API/schema, Customer, Admin sửa file riêng; bộ phận tích hợp xử lý payments/customers/report và kiểm tra cuối. Không sửa chung file đồng thời.

## Công việc và kiểm chứng

1. **Schema + migration**: nullable trip/tuyến/deadline, số đo tách biệt, cước audit, assignment history, payment actor, manual case, idempotency. Prisma validate/generate; rehearsal migration trên DB test tách biệt, giữ legacy rows.
2. **Backend shipments**: options, route points, quote, idempotent create, accept/reweigh, collect cash, assignment, money cases. Tests trước implementation: tenant, boundary cân/ngày, online unpaid, race/status, trip null.
3. **Customer**: real options/quote services, reset và request race protection, idempotency, deadline/policy, account/payment/invoice không bắt buộc trip. Test flow tạo đơn và stale/errors.
4. **Admin**: shared Resource + shadcn Base UI, form cân/chốt/thu/assign/case, nullable trip và customer history. Test service payload và guarded actions; visual 1440×900/375×667 và keyboard.
5. **Payments/integration consumers**: expiry chỉ MOI_TAO, paid case lưu ledger, independent payment TTL, customer history nullable route; regression booking/capacity/revenue. Tests có receipt/counter/recipient and 48h boundaries.
6. **Review + QA**: typecheck/build/lint/tests phù hợp ở cả ba app, migration integration, graph detect-changes, rà diff và audit trust/tenant. Ghi chính xác test đã chạy, kết quả và giới hạn vào handoff.

## Contract phối hợp

- GET `/api/v1/shipments/options?from&to&sendDate&page&pageSize`: options `{routeId,busCompany:{id,name},route:{origin,destination}}` + meta.
- GET `/api/v1/shipments/routes/:routeId/route-points`: points và rates.
- POST `/api/v1/shipments/quotes`: routeId/sendDate/points/items → pricing.
- POST `/api/v1/shipments`: standalone routeId/sendDate và payload khai báo; header Idempotency-Key; không tripId.
- POST `/:id/accept`: measurements + confirmPriceChange; PATCH `/:id/assignment`: tripId/note; GET `/:id/available-trips`.
- POST `/:id/collect-payment`: amount/note; POST `/:id/money-cases/:caseId/resolve`: chứng từ/kết quả.
- Existing shipment API vẫn dùng envelope data/meta. Đặc tả và DTO thực thi là nguồn contract cuối cùng, mọi consumer phải đồng bộ.

## Rủi ro và thứ tự an toàn

- CRITICAL: payment ledger/expiry/tenant; HIGH: nullable trip qua cả Customer/Admin. Không xem zero graph callers là an toàn; xác minh source khi graph UNKNOWN.
- Chưa bật writer null-trip vào DB thật trước reader mới và migration. Không chạy migration reset hoặc phá DB đang dùng.
- Giá và số tiền server-owned; quote không thay thế kiểm tra lúc tạo/tiếp nhận. Không giữ transaction qua network.

## Nhật ký

- Khởi đầu: chỉ có proposal Markdown untracked, không có source edits. Index force rebuild PDG đang chạy trước impact.
- Đọc root/admin/web AGENTS và Admin DESIGN. File `docs/ADMIN_TENANCY_AND_OPERATIONS.md` được hướng dẫn nhắc đến nhưng không tồn tại trong checkout; kiểm tra tenant từ auth/service đang có, không tạo scope mới.
- Migration `20261103000000_standalone_shipment_rework` đã rehearsal trên database cô lập, sau đó áp dụng vào database local hiện tại mà không reset. Backup trước migration được giữ ngoài repository.
- Customer, Admin và API đã nối API thật; không dùng fixture làm nguồn dữ liệu chính cho luồng mới.
- Đã kiểm tra production build cả ba app, typecheck cả ba app, toàn bộ unit backend, toàn bộ test Customer/Admin và integration shipment/payment trên MySQL cô lập.
