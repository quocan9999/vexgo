# Initial Handoff — F12 (trước triển khai)

- **State:** `SPEC_READY / NOT_IMPLEMENTED`.
- **Cách làm:** repo VexGo gốc, branch `feature/tenant-revenue-reporting` từ `origin/develop`, **không git worktree**; không push/PR/merge.
- **Test policy:** chỉ targeted unit test cho backend logic tiền/tenant/timestamp/authorization; **không** integration, E2E, automated browser hoặc UI/component tests. Người dùng smoke test UI.
- **Business scope:** nhà xe/tenant, không Super Admin; F13 Dashboard vận hành tách riêng; tất cả payment thành công hợp lệ đã settlement, refund success âm ngày hoàn, giá thực thu sau discount, gửi hàng độc lập/kèm vé. UI 6 KPI + 1 chart + 2 tables + period filters + CSV toast.

## Reference baseline (đã kiểm tra trên GitHub 22/10/2026; không khóa vào SHA này)

- `origin/develop`: `bc863de26fe9787f91e2078475f97c16d2f6423f`, [commit](https://github.com/quocan9999/vexgo/commit/bc863de26fe9787f91e2078475f97c16d2f6423f). PR #35 (Admin bookings/tickets) và PR #37 (chat) đã merge; #36 booking + shipments, #38 promotions cũng hiện diện; **Phase 00 phải fetch mới**.
- `prisma/schema.prisma`: có `DonGiaoDich.nhaXeId`, `ThanhToan`, `Ve.giaThucTe`, `PhieuDatVe.soTienGiamKhuyenMai`, `PhieuGuiHang.tongPhi`, `SuDungKhuyenMai`; chưa thấy `ThanhToan.completedAt`.
- `payments/payment-attempt.ts` lưu `thoiGian` ở payment pending; `payments.service.ts` nhận SePay `transactionDate` và shared settlement (`PaymentSettlementService`, `lockPaymentOrder`). `paidAt` API hiện từ mutable `updatedAt` → phải xử lý source true event time.
- `tickets.service.ts` tạo refund `ThanhToan.loaiGiaoDich = HOAN_TIEN`; `RefundProcessorService` có thể đổi refund thành `THANH_CONG` sau provider `SUCCEEDED`; nếu chưa config provider thì pending. Không được tự nhận refund pending là thành công.
- `BookingsService` dùng `finalTicketTotal + shippingFee`, có 0đ settled nội bộ không payment; mixed order voucher cần đối soát source amounts. Payment `CAN_DOI_SOAT` và paid-late cần tách khỏi sale.
- RBAC: `permission-catalog.ts` chưa có `revenue:read`, Admin `admin-access.ts` hiện có booking/promotion/shipment/chat; sidebar `super-admin-layout.tsx` phải tích hợp permission mới mà không phá menu cũ.

## Environment do chủ dự án chốt

- MySQL shared `3306`, phpMyAdmin `8091`, Web `3017`, Admin `3018`, API `4019`.
- DB **riêng** F12 `vexgo_feature12`, shadow `vexgo_feature12_shadow`; được reset/reseed demo **chỉ** hai DB này. Không đụng DB repo gốc dùng cho feature khác.

## Nhiệm vụ phiên agent kế tiếp

1. Kiểm tra repo status, branch/origin và ZIP đã ở `docs/features/tenant-revenue-reporting/`.
2. Đọc `SETUP_REPO.md` để cấu hình an toàn repo gốc; **không có Setup Prompt riêng**.
3. Đọc `MASTER_SPEC.md` + `handoff/PROGRESS.md` + **chỉ** `spec/PHASE_00_BASELINE_AND_DATA_CONTRACT.md`.
4. Audit và implement Phase 00 nếu cần; unit test đúng policy; handoff/commit.

Các bằng chứng GitHub là tham chiếu, không thay thế kiểm tra thực tế; không tuyên bố implementation đã làm.
