# PHASE 05 — Admin status actions + final MVP acceptance

**Dependency:** Phase 04 PATCH API và DB-backed tests verified; phase trước commit + handoff.

## Status UX (Admin)

- Dựa trên session permission `shipment:update`, chỉ show action có ý nghĩa trong detail (`shipment:read` cần cho mở chi tiết). Read-only actor vẫn xem đầy đủ nhưng không có mutation button; API độc lập deny 403.
- Action đúng transition API: `MOI_TAO→DA_TIEP_NHAN` là **Xác nhận đã tiếp nhận hàng**, `DA_TIEP_NHAN→DANG_VAN_CHUYEN`, `DANG_VAN_CHUYEN→DA_GIAO`, `MOI_TAO→DA_HUY` khi backend xác định an toàn. Không render 'Duyệt đơn' hoặc 'Phân công chuyến'.
- Trước khi PATCH hiển thị shared Confirm/AlertDialog mô tả tác động ngoài đời; cần ghi chú thì input tùy chọn tối đa 500, validation cả client và server.
- Sử dụng shared detail sheet, action button/confirm/dialog/badge/feedback; không tạo bản sao `ShipmentConfirmDialog` nếu shared đã hỗ trợ.
- Disable/pending + in-flight guard chống double-submit ở UI; handler gọi service qua `adminApiFetch`, không gửi `actorId`/`tenantId`.
- 409 stale: thông báo trạng thái đã đổi hoặc không còn đủ điều kiện, refetch detail/list/history; 401/403/mất mạng: giữ trạng thái UI không giả thành công, cho phép thử lại khi an toàn.
- Success chỉ sau server `200` thực: refetch status/detail/history và list (không chỉ update badge client mà quên timeline). Nếu backend từ chối hủy cần hoàn tiền, hiện thông báo không thể hủy trong MVP, không âm thầm tạo refund.

## End-to-end acceptance

1. Environment đúng: worktree Feature 09; Admin `3003`, API `4003`, database demo **`vexgo_feature09` trên MySQL 3306**; secrets/ports không leak.
2. Login tenant user có `shipment:read/update`; route `/shipments` hiển thị đúng list từ API/MySQL; có tìm kiếm/filter/page; mở chi tiết thấy trip, 2 điểm tên+địa chỉ, nhiều loại hàng, chi tiết cước, người trả cước, lịch sử (rỗng khi DB rỗng).
3. Từ phiếu `MOI_TAO` thực: confirm → tiếp nhận → vận chuyển → đã giao, refetch toàn UI sau từng thao tác; DB current status + history thay đổi tương ứng đúng actor/time.
4. Kiểm tra ít nhất một read-only tenant user (không có mutation action/403 API) và tenant khác (404), Super Admin không được truy cập vận hành mặc định.
5. Negative: double-click, simultaneous PATCH, skip status, paid cancellation, invalid DTO, migration schema untouched, historical fee unchanged; không có false toast.
6. Responsive/browser trên 1440×900 và 375×667; kiểm tra no overflow, focus, keyboard, sheet/dialog labels, touch targets; dùng UI-UX Pro Max audit theo `DESIGN.md`.
7. Chạy targeted API/Admin tests, impacted typecheck/lint/build, `git diff --check`, GitNexus detect-changes; **không bắt full local suite nếu targeted đủ, để CI chạy full khi PR sau**. Không chạy `seed` lần hai để reset timeline demo.
8. Kiểm tra git status sạch trừ files local ignored; không commit `node_modules`, `.next`, dist, `.env*`, SQL dumps/creds, screenshots, logs, ZIP, file rác khác.

## Final handoff / conclusion

- Viết `handoff/PHASE_05_HANDOFF.md` + `handoff/FINAL_HANDOFF.md` (thực tế: phase commits hash/messages, reused components, env ports/db names, tests commands+counts, DB-backed smoke, screenshot observations, blocker/resume).
- Mỗi file handoff mới cần được commit; có thể đưa vào commit Phase 05 nếu đã xác định kết quả trước khi commit. Không ghi hash commit của chính mình vào cùng commit; liệt kê SHA trong terminal report sau commit và trong final handoff nếu được cập nhật an toàn sau đó.
- Commit subject gợi ý: `feat(admin): hoàn thiện thao tác trạng thái gửi hàng` với body ít nhất 2–3 gạch đầu dòng.
- Nếu phát hiện bug từ phase trước: sửa regression theo commit mới thích hợp, không tự rewrite commit không còn HEAD hoặc đã push. Không auto PR/push/merge.
- Kết luận chính xác `MVP FEATURE 09 DEMO READY` **chỉ khi API/MySQL/browse verified**; thiếu bất kỳ gate chính → `MVP FEATURE 09 NOT READY`, ghi nào làm xong, nào còn thiếu. Không tuyên bố hoàn thành Feature 09 toàn bộ.
