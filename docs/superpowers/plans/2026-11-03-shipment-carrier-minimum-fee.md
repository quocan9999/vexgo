# Shipment Carrier Minimum Fee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị và sắp xếp giá cước tham khảo thấp nhất cho từng nhà xe ở bước chọn nhà xe.

**Architecture:** `ShipmentsService.getShipmentOptions` lấy giá tối thiểu theo từng tuyến bằng aggregate Prisma có điều kiện ngày/điểm/trạng thái, sau đó sắp xếp trước phân trang. Customer service mở rộng type và component chỉ render giá tham khảo; quote chính xác không đổi.

**Tech Stack:** NestJS, Prisma 7/MySQL, Next.js 16/React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-shipment-carrier-minimum-fee-design.md`

## Global Constraints

- Giá là `Decimal` trong backend, chỉ chuyển thành number tại response boundary.
- Backend là nguồn sự thật; không suy ra giá thấp nhất ở frontend.
- Không đổi schema hoặc nghiệp vụ quote/chốt cước.

## Review Focus

- Bảng cước hết hạn/tạm ngưng không được dùng.
- Điểm gửi/nhận ngoài tuyến hoặc sai vai trò không được dùng.
- Nhà xe chưa có bảng cước trả `null` và nằm cuối.
- Nhiều nhà xe cùng giá giữ thứ tự ổn định theo `routeId`.
- Pagination diễn ra sau khi sắp giá toàn bộ lựa chọn.

---

### Task 1: API option minimum fee

**Files:**

- Modify: `apps/api/src/shipments/shipments.service.ts`
- Test: `apps/api/test/integration/shipments/shipments.spec.ts`

**Interfaces:**

- Produces: option field `minimumEstimatedFee: number | null`.

- [x] Viết integration assertion so sánh response với mức cước tối thiểu hợp lệ trong DB.
- [x] Chạy test và xác nhận fail do thiếu field.
- [x] Aggregate giá theo tuyến/ngày/trạng thái/vai trò điểm; sắp tăng dần, null cuối.
- [x] Chạy lại integration shipment.

### Task 2: Customer comparison UI

**Files:**

- Modify: `apps/web/src/features/shipments/services/shipments.api.ts`
- Modify: `apps/web/src/features/shipments/components/send-freight-page.tsx`
- Test: `apps/web/test/unit/shipments/send-freight-page.spec.tsx`

**Interfaces:**

- Consumes: `ShipmentOption.minimumEstimatedFee`.

- [x] Viết test hiển thị `Cước từ 30.000 đ` và fallback không có giá.
- [x] Chạy test và xác nhận fail.
- [x] Bổ sung type và UI copy; không dùng giá tham khảo làm total quote.
- [ ] Chạy Customer test, typecheck và build.

### Task 3: Verification

**Files:**

- Modify: `docs/features/SHIPMENTS_REWORK_HANDOFF.md`

- [ ] Cập nhật contract/handoff.
- [ ] Chạy API unit/integration, Customer tests, typecheck/build và `git diff --check`.
- [ ] Refresh GitNexus và chạy `detect-changes --scope all`.
