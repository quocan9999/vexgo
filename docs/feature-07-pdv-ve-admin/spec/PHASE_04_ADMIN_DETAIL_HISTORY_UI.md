# Phase 04 Spec — Admin Detail UI & Timeline riêng phiếu/vé

**Feature:** 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)  
**Trạng thái:** Spec triển khai; chỉ bắt đầu sau Phase 03 và API Phase 02 đạt gate.  
**Tham chiếu:** `MASTER_SPEC.md`, spec/handoff Phase 02–03, `apps/admin/AGENTS.md` + `DESIGN.md`.

## 1. Goal / Scope

Implement **hai trang chi tiết URL riêng** cho `PhieuDatVe` và `Ve`; mỗi trang chỉ GET dữ liệu từ API Admin Phase 02. Có liên kết phiếu ↔ vé; timeline riêng lấy từ hai bảng history đã tồn tại; tóm tắt thanh toán/hoàn tiền và hàng gửi kèm. Không có Customer timeline, không có mutation (hủy, đổi chỗ, update status, soát vé, thanh toán/hoàn tiền hay duyệt gửi hàng).

## 2. Routes và navigation

- `/booking-management/bookings/[bookingId]`: chi tiết phiếu.
- `/booking-management/tickets/[ticketId]`: chi tiết một vé.
- Cả hai kế thừa `AdminSessionGuard`, required `booking:read`, tenant scope; không có `SUPER_ADMIN` bypass. Mở trực tiếp URL/refresh có data thật và kiểm tra auth trước khi render dữ liệu.
- Có breadcrumb/back về tab list liên quan, giữ query/filter/page qua safe internal URL (không nhận external redirect chưa validate); phiếu link đến chi tiết từng vé; vé link ngược về phiếu.
- Render cùng Admin shell; không tạo route nội bộ bị 404. Link sang Feature 09 shipment **chỉ bật khi trang chi tiết thật tồn tại và có quyền đọc phù hợp**, nếu chưa có thì mã vận đơn hiển thị text thường.

## 3. Chi tiết phiếu (`GET /admin/bookings/:id`)

Các khu vực đề xuất theo thứ tự:

1. Header: mã phiếu, `PhieuDatVe.trangThai`, ngày đặt, chuyến xe duy nhất theo invariant đã chốt. Không suy diễn phiếu `HOAN_THANH` chỉ vì giờ xe đã qua.
2. Khách: tên và điện thoại từ snapshot của giao dịch, email chỉ nếu phù hợp nhiệm vụ Admin và DB có; không hiển thị secrets/CCCD/thông tin cá nhân thừa.
3. Danh sách vé: mã, ghế, giá thực tế, trạng thái thực tế, link chi tiết. Thể hiện `initialTicketCount`, `cancelledTicketCount` và badge partial khi `0 < canceled < total`. Không lưu `HUY_MOT_PHAN` xuống DB, không nói ai sở hữu xe máy.
4. Thanh toán: phân biệt **tiền vé ban đầu** từ `PhieuDatVe.tongTienBanDau`, tổng đơn (nếu hiển thị) từ `DonGiaoDich`, trạng thái đơn vs payment, phương thức thanh toán nguồn hợp lệ, refund pending/succeeded/unknown. Không dùng `DonGiaoDich.tongTien` như tổng tiền vé khi có hàng.
5. Gửi hàng liên quan (nếu có): mã vận đơn, loại hàng thực tế (nếu dữ liệu), trạng thái shipment riêng, chuyến xe, link Feature 09 nếu có. Không hiển thị nút hủy hàng/tiếp nhận/bàn giao.
6. Timeline phiếu: **API riêng** `GET /admin/bookings/:id/history`, không gộp timeline các vé. Trình bày trạng thái cũ → mới, thời điểm, nguồn thay đổi, lý do, actor display-safe theo backend.

**Một phiếu một chuyến:** không tự lấy vé đầu và hiển thị chuyến đó nếu dữ liệu thực tế vi phạm invariant. Trình bày cảnh báo dữ liệu không nhất quán khi API đã chỉ báo; không che lỗi bằng chuyến giả. Trạng thái thực của đơn/vé/hàng có thể độc lập; không tự điều chỉnh cho khớp nhau ở frontend.

## 4. Chi tiết vé (`GET /admin/tickets/:id`)

- Header: `maVe`, status vé (không dùng status đơn), mã phiếu có link.
- Khách/route/trip/khởi hành theo `BUSINESS_TIME_ZONE`, xe/loại xe/ghế/điểm đón nếu có, giá thực tế và giá niêm yết nếu contract có.
- Refund **theo vé** nếu backend xác định được `veId`, không nhầm tiền đang xử lý với đã trả; khi thiếu dữ liệu thì nêu rõ chưa có thông tin.
- Timeline vé từ `GET /admin/tickets/:id/history` đọc `LichSuTrangThaiVe` đúng vé; không xem lịch sử phiếu hoặc vé khác như history vé này.
- Không có nút check-in, đổi chỗ, hủy, hoàn tiền hoặc đổi trạng thái. Hủy từ Customer là nghiệp vụ ngoài scope.

## 5. Timeline, baseline, privacy

- Nếu chỉ có một history baseline do migration PR #33, UI thể hiện **"Trạng thái được ghi nhận khi khởi tạo lịch sử"**, không gắn nhãn giả "Khách đặt vé" hoặc "Đã thanh toán" tại thời điểm không có dữ liệu.
- Nếu `trangThaiCu=null`, trình bày trạng thái đầu tiên; nếu `trangThaiCu` khác `trangThaiMoi`, dùng mũi tên cũ → mới; `lyDo`, `nguonThayDoi`, `laOverride`, `thoiDiem` theo API thật.
- Sort thống nhất theo backend `(thoiDiem, ID)`; cùng timestamp không đảo thứ tự; nếu history dài, hỗ trợ phân trang/"Xem thêm" theo contract Phase 02, không render hàng ngàn entries vô hạn.
- `nguonThayDoi=SYSTEM` không hiển thị người thao tác giả. STAFF/CUSTOMER chỉ hiển thị tên actor nếu API cho phép; không render ID tài khoản không cần thiết hoặc dữ liệu thừa.
- Nếu không có event: thông báo chưa có lịch sử, không tự tạo fake timeline. API GET chỉ đọc, không gây chuyển trạng thái hoặc thêm history.

## 6. Thanh toán và shipment tóm tắt

- UI có nhãn rõ: "Tổng tiền vé ban đầu", "Tổng đơn giao dịch" (nếu có), "Trạng thái đơn", "Thanh toán", "Hoàn tiền". Không tự đánh đồng hoàn tất chuyến/đã hủy vé với đã hoàn tiền.
- Refund pending `DANG_XU_LY`/`DANG_GUI` => "Đang xử lý"; `THANH_CONG` => "Đã hoàn"; trạng thái khác dựa đúng backend, không gộp vào success. Không tự cộng trùng payment attempts, chưa có allocation vé/hàng thì không bịa ra refund riêng hàng.
- Khi một booking còn 2 vé và shipment bị hủy, UI hiển thị booking vẫn còn các vé hiệu lực và shipment đã hủy. Khi đơn bị đánh dấu `DA_HUY` dù shipment thực tế chưa hủy, hiển thị trạng thái **độc lập** và có thể nêu sự khác biệt, không chuyển status shipment sang canceled.
- `PhieuGuiHang` liên kết qua `DonGiaoDich`, không cần `veId`/owner/assignee của xe máy.

## 7. UI/UX/accessibility và error states

- Reuse shared detail containers, header, badges, skeleton, error, retry, list/card primitives của Admin; `DESIGN.md` là nguồn style. Không copy nguyên detail sheet của CRUD nếu trang detail riêng cần layout khác.
- Desktop `1440x900`, mobile `375x667`: hierarchy rõ, no page horizontal overflow, timeline và danh sách vé đọc được, back-link dễ tìm, touch target phù hợp.
- Error/loading của detail và history **độc lập**: detail có nhưng history fetch lỗi => không xóa detail; history có retry. 401 xử lý session; 403 deny + clear stale; 404 missing/cross-tenant giống nhau; 500 retry có kiểm soát.
- Bảo vệ race: đổi ticketId khi request cũ pending thì không hiển thị data ticket cũ, logout/đổi tenant phải xóa dữ liệu màn hình.
- Không render raw HTML từ `lyDo`/tên hoặc dữ liệu DB; escape text theo React. Sử dụng semantic timeline/list và proper labels/focus.

## 8. Tests bắt bug thật

1. Direct URL/refresh/back phiếu↔vé; IDs invalid/nonexistent, cross-tenant, permission revoked.
2. Booking 3 vé, hủy 1 => badge 1/3, trạng thái phiếu không đổi. Shipment giữ/hủy độc lập; không thêm owner vào UI.
3. Vé A01 history và phiếu history khác nhau; thiếu history thì empty; baseline không biến thành hành động bịa đặt; cùng timestamp ổn định.
4. Refund `DANG_XU_LY`/`DANG_GUI` vs `THANH_CONG`; nhiều refunds khác `veId` không trộn; booking+shipment tổng tiền đơn khác tiền vé.
5. Detail load được nhưng history fetch 500: không mất detail, retry chỉ tải history; cross-tenant history trả 404.
6. API response chứa null `pickup`, null shipment/email/method: render an toàn, không crash/0 VND bịa.
7. Slow detail fetch và navigation nhanh => không show stale content; 403/404 clear prior tenant data.
8. A11y keyboard/breadcrumbs, 1440x900 + 375x667 visual; không thao tác hủy/soát/hoàn tiền trong DOM.
9. Component stubs chỉ để test UI contract; chạy live API/data thực trong Phase 05, không coi mock component test là đủ nghiệm thu.

## 9. Quality gates & Handoff

- Targeted UI tests, affected Admin typecheck/lint/build, `git diff --check`; kiểm tra shared regression nếu sửa shared components.
- Live manual smoke với API Phase 02 chạy port **4001**, Admin **3002**, DB worktree feature; kiểm tra tenancy/trang detail nếu có seeded fixtures hợp lệ.
- Không sửa Customer cancellation, `PhieuGuiHang` mutation, Prisma schema/history data. Document dependency; no fake data fallback.
- Commit local Conventional Commits. Ghi `handoff/PHASE_04_HANDOFF.md`: routes, component/API integration, viewport findings, test commands/counts, SHA, known limitations, Phase 05 checklist.
