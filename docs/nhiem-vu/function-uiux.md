# Customer Function & UI/UX Delivery Plan — VexGo

> Phạm vi tài liệu: **các chức năng và giao diện phải bàn giao cho Customer Web và Customer Mobile**.  
> **Không bao gồm Admin Web và không có Mobile Admin.**  
> API contract chi tiết xem tại `endpoint-api.md`. Quy tắc code UI/component sẽ được tách sang `rule-ui-ux.md`.

## 1. Mục tiêu

- Customer Web và Customer Mobile cùng phục vụ **khách hàng đặt vé xe khách trên hệ thống nhiều nhà xe**, không phải website riêng của một nhà xe.
- Hai nền tảng dùng chung backend/API và business rules nhưng UI/UX được thiết kế phù hợp với từng nền tảng.
- Cả Web và Mobile đều phải hoàn thành nhóm chức năng người dùng trong đề cương: tài khoản cá nhân, tìm chuyến, đặt/hủy vé, áp khuyến mãi, thanh toán online, tra cứu vé/hóa đơn, gửi hàng hóa, chat realtime hỗ trợ khách hàng và chuyển đổi Việt – Anh.
- Các chức năng mở rộng đã xuất hiện trong System Use Case như đổi vé, đánh giá dịch vụ, thông báo chủ động, gợi ý chuyến thay thế và Chatbot AI được xếp theo mức ưu tiên để không ảnh hưởng flow cốt lõi.

## 2. Nguyên tắc phân công giữa 2 thành viên

### Bạn A — Customer Web

Bạn A chịu trách nhiệm chính:

- toàn bộ UI/UX của `apps/web`;
- tích hợp và hoàn thiện Customer Web;
- backend nhóm Discovery & Engagement theo `endpoint-api.md`: auth, customer profile, nhà xe/tuyến/chuyến, reviews, support chat, notifications, content, chatbot nếu làm.

### Bạn B — Customer Mobile

Bạn B chịu trách nhiệm chính:

- toàn bộ UI/UX của ứng dụng Customer Mobile;
- tích hợp và hoàn thiện Customer Mobile;
- backend nhóm Commerce & Fulfillment theo `endpoint-api.md`: seat hold/reservation, bookings, promotions, payments, tickets, invoices, shipments, branch offices, cargo types.

### Điểm rất quan trọng

**Phân chia backend không đồng nghĩa với chia đôi chức năng giữa Web và Mobile.**  
Web và Mobile cuối cùng đều phải có đầy đủ các chức năng Customer thuộc scope bắt buộc.

Để hai người làm song song và ít phải chờ nhau:

1. Bạn A làm trước các màn hình Web dùng API do A sở hữu; với flow cần API của B có thể dựng UI bằng fixture/mock đúng contract tạm thời.
2. Bạn B làm trước các màn hình Mobile dùng API do B sở hữu; với flow cần API của A có thể dựng UI bằng fixture/mock đúng contract tạm thời.
3. Khi API của người còn lại sẵn sàng, thay mock bằng service gọi API thật.
4. Feature chỉ được xem là hoàn thành khi đã chạy bằng API thật, không còn fixture làm nguồn dữ liệu chính.

---

## 3. Mức ưu tiên

- **HIGH — Ưu tiên cao:** phải hoàn thành trước để chạy được flow cốt lõi tìm chuyến → chọn ghế → đặt vé → thanh toán.
- **MEDIUM — Ưu tiên trung bình:** thuộc yêu cầu chính của khóa luận và phải hoàn thiện sau flow cốt lõi.
- **LOW — Ưu tiên thấp:** chức năng bổ sung/hoàn thiện trải nghiệm; thực hiện sau HIGH và MEDIUM.
- **TBD:** chưa đủ business rule/schema để cam kết UI hoàn chỉnh; chỉ dựng sau khi backend/domain được chốt.

---

# 4. Ma trận chức năng Customer Web và Mobile

| Priority | Nhóm chức năng | Customer Web | Customer Mobile | Backend owner chính |
|---|---|---|---|---|
| HIGH | Đăng ký / đăng nhập / đăng xuất | Bắt buộc | Bắt buộc | A |
| HIGH | Tìm kiếm chuyến xe nhiều nhà xe | Bắt buộc | Bắt buộc | A |
| HIGH | Xem chi tiết chuyến xe | Bắt buộc | Bắt buộc | A |
| HIGH | Xem sơ đồ và trạng thái ghế | Bắt buộc | Bắt buộc | B |
| HIGH | Chọn/giữ ghế | Bắt buộc | Bắt buộc | B |
| HIGH | Nhập thông tin hành khách / booking | Bắt buộc | Bắt buộc | B |
| HIGH | Tính lại giá/booking quote | Bắt buộc | Bắt buộc | B |
| HIGH | Áp mã khuyến mãi trong checkout | Bắt buộc | Bắt buộc | B |
| HIGH | Thanh toán MoMo / VNPAY / ZaloPay | Bắt buộc | Bắt buộc | B |
| HIGH | Hiển thị kết quả đặt vé/thanh toán | Bắt buộc | Bắt buộc | B |
| MEDIUM | Quản lý tài khoản cá nhân | Bắt buộc | Bắt buộc | A |
| MEDIUM | Quên / đặt lại mật khẩu | Bắt buộc | Bắt buộc | A |
| MEDIUM | Danh sách và chi tiết vé | Bắt buộc | Bắt buộc | B |
| MEDIUM | Tra cứu vé | Bắt buộc | Bắt buộc | B |
| MEDIUM | Hủy vé/booking theo rule | Bắt buộc | Bắt buộc | B |
| MEDIUM | Danh sách và tra cứu hóa đơn | Bắt buộc | Bắt buộc | B |
| MEDIUM | Lịch sử giao dịch | Bắt buộc | Bắt buộc | A + B data |
| MEDIUM | Gửi hàng hóa / tính cước | Bắt buộc | Bắt buộc | B |
| MEDIUM | Tra cứu phiếu gửi hàng | Bắt buộc | Bắt buộc | B |
| MEDIUM | Chat realtime hỗ trợ khách hàng | Bắt buộc | Bắt buộc | A |
| MEDIUM | Chuyển đổi Việt – Anh | Bắt buộc | Bắt buộc | Frontend |
| LOW | Đổi vé | Có nếu backend rule hoàn chỉnh | Có nếu backend rule hoàn chỉnh | B |
| LOW | Thông báo trong ứng dụng | Nên có | Nên có | A |
| LOW | Đánh giá dịch vụ | Nên có | Nên có | A |
| LOW | Gợi ý chuyến thay thế | Nên có | Nên có | A |
| LOW | Trang điều khoản/chính sách động | Optional | Optional | A |
| LOW | Chatbot AI hỗ trợ | Optional | Optional | A |

> `Soát vé`, quản lý xe/tuyến/chuyến/nhân viên/khách hàng, thống kê doanh thu, backup/restore và các chức năng vận hành nhà xe thuộc phía Admin/nhân viên, **không thuộc Customer Web/Mobile trong file này**.

---

# 5. Customer Web — chức năng và giao diện cần bàn giao

> Tên route phía dưới chỉ là gợi ý để mô tả sitemap, **không phải API contract bắt buộc**.

## 5.1 Khung giao diện chung

Customer Web cần có một shell thống nhất cho toàn site:

- Header/navigation chính.
- Logo/brand VexGo.
- Điểm đi – điểm đến – ngày đi hoặc lối truy cập nhanh tới tìm chuyến.
- Đăng nhập/đăng ký khi chưa đăng nhập.
- Menu tài khoản khi đã đăng nhập.
- Chuyển đổi ngôn ngữ Việt – Anh.
- Khu vực thông báo nếu triển khai notification.
- Lối truy cập Chat hỗ trợ.
- Footer: thông tin hệ thống, điều khoản/chính sách/hướng dẫn nếu có.

Web phải responsive vì đề cương yêu cầu website hiển thị tốt trên smartphone. Tuy nhiên Web responsive **không thay thế ứng dụng Mobile**.

---

## 5.2 Trang chủ — HIGH

**Route gợi ý:** `/`

### Chức năng

- Form tìm kiếm chuyến:
  - điểm đi;
  - điểm đến;
  - ngày khởi hành;
  - tùy chọn lọc nhanh nếu cần.
- CTA tìm chuyến rõ ràng.
- Có thể hiển thị nhà xe/tuyến phổ biến hoặc nội dung giới thiệu nếu có dữ liệu phù hợp.
- Lối truy cập nhanh tới:
  - tra cứu vé;
  - gửi hàng/tra cứu gửi hàng;
  - hỗ trợ khách hàng.

### Kết quả bàn giao

Người dùng nhập đủ điều kiện tìm kiếm và chuyển tới trang kết quả mà không cần đăng nhập.

---

## 5.3 Kết quả tìm kiếm chuyến — HIGH

**Route gợi ý:** `/trips/search`

### Chức năng

- Hiển thị danh sách chuyến từ **nhiều nhà xe**.
- Mỗi kết quả tối thiểu phải cho thấy:
  - nhà xe;
  - tuyến/điểm đi – điểm đến;
  - thời gian khởi hành;
  - thông tin xe/loại xe cần thiết;
  - giá hiện hành;
  - trạng thái còn nhận đặt hay không.
- Filter theo các dữ liệu backend hỗ trợ, ví dụ:
  - nhà xe;
  - loại xe;
  - khoảng giá.
- Sort theo contract backend hỗ trợ, ví dụ giờ đi hoặc giá.
- Phân trang/load-more theo API.
- Có CTA xem chi tiết/chọn chuyến.

### Trạng thái bắt buộc

- loading;
- không có chuyến phù hợp;
- lỗi tải dữ liệu;
- kết quả thành công.

Không được hard-code dữ liệu của một nhà xe cụ thể.

---

## 5.4 Chi tiết chuyến — HIGH

**Route gợi ý:** `/trips/[tripId]`

### Chức năng

- Thông tin nhà xe.
- Thông tin tuyến/chuyến.
- Giờ đi và các thông tin chuyến backend cung cấp.
- Loại xe/thông tin xe phù hợp với Customer.
- Giá hiện hành.
- CTA tiếp tục chọn ghế.
- Nếu chuyến không còn bookable, không cho tiếp tục checkout và có thể hiển thị gợi ý chuyến thay thế khi LOW feature đã triển khai.

---

## 5.5 Chọn ghế — HIGH

**Route gợi ý:** `/booking/[tripId]/seats`

### Chức năng

- Hiển thị sơ đồ ghế theo dữ liệu thực tế của chuyến.
- Phân biệt được tối thiểu:
  - ghế còn trống;
  - ghế đang được chọn bởi chính user/session;
  - ghế không thể chọn vì đã giữ/đã đặt.
- Hiển thị số ghế đã chọn và tạm tính cần thiết.
- Cho phép bỏ chọn ghế khi business rule cho phép.
- Khi backend trả `SEAT_UNAVAILABLE`, phải báo rõ ghế vừa bị người khác giữ/đặt và yêu cầu chọn lại.
- Nếu dùng seat hold, UI hiển thị thời gian giữ ghế còn lại dựa trên `expiresAt` do backend trả về.

### Không được làm

- Không dựa vào trạng thái ghế đã tải từ trước để tự kết luận ghế vẫn còn trống.
- Không tự đổi trạng thái ghế thành đã đặt ở frontend trước khi backend xác nhận.

---

## 5.6 Checkout / thông tin đặt vé — HIGH

**Route gợi ý:** `/booking/checkout`

### Chức năng

- Hiển thị tóm tắt chuyến + ghế đã chọn.
- Form thông tin người đặt/người liên hệ.
- Form thông tin hành khách theo contract booking đã chốt.
- Ô nhập/chọn mã khuyến mãi.
- Có thao tác áp dụng/gỡ mã khuyến mãi.
- Gọi booking quote để backend tính lại:
  - giá gốc;
  - giảm giá;
  - phí nếu có;
  - tổng tiền cuối cùng.
- Hiển thị breakdown đủ rõ để user biết mình trả bao nhiêu.
- CTA xác nhận đặt vé/chuyển sang thanh toán.

### Validation UX

Frontend kiểm tra các lỗi nhập liệu cơ bản để phản hồi nhanh, nhưng giá/khuyến mãi/ghế/business rule phải dùng kết quả backend làm nguồn sự thật.

---

## 5.7 Thanh toán online — HIGH

**Route gợi ý:** `/booking/payment`

### Chức năng

- Cho chọn provider được hỗ trợ:
  - MoMo;
  - VNPAY;
  - ZaloPay.
- Tạo payment từ booking/order đã tồn tại.
- Chuyển user tới URL/provider tương ứng.
- Khi user quay lại Web:
  - hiển thị trạng thái đang kiểm tra nếu backend chưa xác nhận;
  - poll/check trạng thái payment theo API;
  - chỉ hiển thị thành công khi backend xác nhận.

### Các trạng thái UI tối thiểu

- tạo payment;
- chờ thanh toán;
- đang xác minh;
- thành công;
- thất bại;
- hết hạn/hủy nếu backend có trạng thái tương ứng.

Không coi query parameter từ redirect của provider là nguồn sự thật cuối cùng.

---

## 5.8 Kết quả đặt vé — HIGH

**Route gợi ý:** `/booking/result/[bookingId]`

### Thành công

Hiển thị tối thiểu:

- mã booking/vé nếu backend đã cấp;
- chuyến;
- ghế;
- tổng tiền/trạng thái thanh toán;
- thông tin cần thiết để hành khách sử dụng vé;
- CTA xem vé / về danh sách vé / về trang chủ.

### Thất bại

- Thông báo lỗi có thể hiểu được.
- Không hiển thị “đặt vé thành công” khi payment/order chưa được backend xác nhận.
- Có hành động retry/check lại trạng thái phù hợp với error code.

---

## 5.9 Authentication — HIGH/MEDIUM

### Màn hình Web cần có

- Đăng nhập — HIGH.
- Đăng ký tài khoản — HIGH.
- Xác thực OTP đăng ký — HIGH.
- Quên mật khẩu — MEDIUM.
- Xác thực OTP quên mật khẩu — MEDIUM.
- Đặt lại mật khẩu — MEDIUM.
- Đăng xuất — HIGH.

### UX chính

- Hiển thị lỗi field-level khi validation fail.
- Phân biệt lỗi tài khoản/mật khẩu/OTP/hết hạn dựa trên error code backend.
- Sau login thành công, quay lại flow hợp lý nếu user bị yêu cầu đăng nhập giữa checkout.

---

## 5.10 Tài khoản cá nhân — MEDIUM

**Route gợi ý:** `/account/profile`

### Chức năng

- Xem thông tin cá nhân.
- Chỉnh sửa thông tin được backend cho phép.
- Đổi mật khẩu.
- Hiển thị feedback thành công/thất bại khi lưu.

Không cho user nhập `customerId` để xem/sửa tài khoản người khác.

---

## 5.11 Vé của tôi / quản lý vé — MEDIUM

**Route gợi ý:** `/account/tickets`

### Danh sách vé

- Danh sách vé của chính user.
- Phân biệt trạng thái vé.
- Có thể lọc/tab theo nhóm trạng thái nếu dữ liệu đủ.
- Mở chi tiết vé.

### Chi tiết vé

**Route gợi ý:** `/account/tickets/[ticketId]`

Hiển thị:

- mã vé;
- chuyến/nhà xe;
- thời gian;
- ghế;
- thông tin hành khách cần thiết;
- trạng thái vé;
- thông tin thanh toán liên quan nếu backend cung cấp.

### Hủy vé — MEDIUM

- Chỉ hiển thị CTA hủy nếu backend/rule cho phép.
- Trước khi xác nhận phải hiển thị thông tin quan trọng như điều kiện/phí/hoàn tiền nếu backend trả về.
- Sau khi hủy thành công phải refresh trạng thái thực tế.

### Đổi vé — LOW/TBD

Chỉ triển khai UI hoàn chỉnh sau khi team chốt:

- có cho đổi khác nhà xe hay không;
- chênh lệch giá xử lý thế nào;
- ghế/chuyến mới được giữ ra sao.

---

## 5.12 Tra cứu vé — MEDIUM

**Route gợi ý:** `/lookup/ticket`

### Chức năng

- Nhập mã vé + thông tin xác minh theo API.
- Hiển thị chi tiết đủ cho khách tra cứu nhưng không làm lộ dữ liệu nhạy cảm của người khác.
- Có trạng thái không tìm thấy / thông tin xác minh không đúng.

Chức năng này có thể dùng cho khách chưa đăng nhập nếu backend cho phép Public lookup.

---

## 5.13 Hóa đơn — MEDIUM

### Danh sách hóa đơn

**Route gợi ý:** `/account/invoices`

- Xem hóa đơn thuộc các giao dịch của chính user.
- Mở chi tiết hóa đơn.

### Tra cứu hóa đơn

**Route gợi ý:** `/lookup/invoice`

- Nhập mã hóa đơn + thông tin xác minh.
- Hiển thị dữ liệu hóa đơn do API trả về.

### Lưu ý

Chưa cam kết nút tải PDF/e-invoice vì class diagram hiện chưa xác định cơ chế sinh/lưu file hóa đơn. Chỉ thêm khi backend contract được bổ sung.

---

## 5.14 Lịch sử giao dịch — MEDIUM

**Route gợi ý:** `/account/transactions`

### Chức năng

- Hiển thị lịch sử giao dịch của chính customer.
- Phân biệt loại giao dịch khi backend cung cấp, ví dụ booking/gửi hàng.
- Hiển thị trạng thái và giá trị giao dịch.
- Có pagination/filter nếu API hỗ trợ.

---

## 5.15 Gửi hàng hóa — MEDIUM

### Landing / tra cứu dịch vụ gửi hàng

**Route gợi ý:** `/shipments`

- CTA tạo phiếu gửi mới.
- CTA tra cứu phiếu gửi.
- Với user đã đăng nhập: xem danh sách phiếu gửi của mình.

### Tạo phiếu gửi

**Route gợi ý:** `/shipments/new`

Form cần phản ánh contract backend, tối thiểu có thể gồm:

- bưu cục/điểm gửi và điểm nhận phù hợp;
- thông tin người gửi;
- thông tin người nhận;
- loại hàng;
- khối lượng/kích thước hoặc các thông tin backend cần để tính cước;
- hình thức lấy/giao nếu nghiệp vụ hỗ trợ;
- khuyến mãi nếu cho phép.

Trước khi tạo phiếu phải gọi quote để hiển thị:

- cước chính;
- phí dịch vụ;
- giảm giá;
- tổng phí.

Nếu thanh toán online cho gửi hàng được triển khai, sử dụng chung flow Payment.

### Danh sách/chi tiết phiếu gửi

**Route gợi ý:** `/account/shipments`, `/account/shipments/[shipmentId]`

- trạng thái hiện tại;
- thông tin người gửi/người nhận cần thiết;
- hàng hóa;
- chi phí;
- mã tracking;
- CTA hủy nếu backend cho phép.

### Tra cứu phiếu gửi

**Route gợi ý:** `/lookup/shipment`

- tracking code + thông tin xác minh.
- Hiển thị trạng thái hiện tại.

**Không hứa UI timeline nhiều mốc** cho đến khi backend có lịch sử trạng thái shipment.

---

## 5.16 Chat realtime hỗ trợ khách hàng — MEDIUM

**Route/modal gợi ý:** `/support` hoặc chat drawer nổi.

### Chức năng

- Xem lịch sử tin nhắn.
- Gửi tin nhắn.
- Nhận tin mới realtime.
- Hiển thị trạng thái kết nối phù hợp.
- Đánh dấu đã đọc nếu backend/model hỗ trợ.
- Tự scroll tới tin mới hợp lý nhưng không phá trải nghiệm khi user đang đọc lịch sử cũ.

### TBD quan trọng

Chỉ hiển thị bubble bên gửi/bên nhận chính xác sau khi model chat có sender identity/type và conversation rõ ràng như đã ghi trong `endpoint-api.md`.

---

## 5.17 Notifications — LOW

**Route gợi ý:** `/account/notifications`

### Chức năng

- Danh sách thông báo của user.
- Badge/unread count.
- Đánh dấu một thông báo đã đọc.
- Đánh dấu tất cả đã đọc.

Push ngoài trình duyệt là phần mở rộng; không nằm trong deliverable mặc định nếu backend chưa có subscription/device model.

---

## 5.18 Đánh giá dịch vụ — LOW

### Điểm vào UI

Có thể đặt CTA đánh giá ở:

- vé/chuyến đã hoàn thành;
- phiếu gửi hàng đã hoàn thành.

### Chức năng

- Chọn rating theo contract.
- Nhập nội dung nhận xét.
- Gửi đánh giá.
- Xem/sửa đánh giá của chính mình khi rule cho phép.

UI không được cho đánh giá một chuyến/dịch vụ mà user chưa thực sự sử dụng; backend vẫn là nơi kiểm tra cuối cùng.

---

## 5.19 Chuyển đổi ngôn ngữ Việt – Anh — MEDIUM

### Chức năng

- Có language switcher dễ tìm.
- Dịch các phần giao diện thuộc frontend:
  - menu;
  - button;
  - label;
  - placeholder;
  - validation message phía client;
  - thông báo mapping từ backend error code.
- Giữ lựa chọn ngôn ngữ hợp lý giữa các lần điều hướng/phiên sử dụng.

### Không tự dịch

- tên nhà xe;
- tên tuyến;
- địa chỉ;
- dữ liệu nghiệp vụ do backend/database cung cấp,

trừ khi sau này database có dữ liệu locale tương ứng.

---

## 5.20 Gợi ý chuyến thay thế — LOW

Có thể hiển thị khi:

- chuyến đang xem hết chỗ/không còn bookable;
- flow đổi vé cần chuyến khác;
- backend trả alternative trips phù hợp.

Mỗi gợi ý phải dẫn được tới chi tiết/chọn chuyến mới.

---

## 5.21 Chatbot AI — LOW, optional

Nếu team quyết định làm:

- Có giao diện hỏi đáp hỗ trợ.
- Có trạng thái đang trả lời/lỗi.
- Không để chatbot tự xác nhận giá, ghế, payment, hủy/đổi vé bằng dữ liệu suy đoán.
- Các dữ liệu giao dịch phải lấy lại từ API nghiệp vụ nguồn sự thật.

---

# 6. Customer Mobile — chức năng và giao diện cần bàn giao

Customer Mobile có cùng nghiệp vụ Customer với Web nhưng UX phải được tổ chức theo luồng mobile, không bê nguyên layout desktop xuống màn hình nhỏ.

## 6.1 Điều hướng chính

Có thể dùng bottom navigation hoặc cấu trúc tương đương. Gợi ý nhóm màn hình:

- Trang chủ/Tìm chuyến.
- Vé của tôi.
- Gửi hàng.
- Thông báo nếu triển khai.
- Tài khoản.

Chat hỗ trợ có thể vào từ nút riêng/floating action hoặc trong Tài khoản/Hỗ trợ, miễn dễ truy cập.

---

## 6.2 Trang chủ / tìm chuyến — HIGH

### Chức năng

- Điểm đi.
- Điểm đến.
- Ngày khởi hành.
- CTA tìm chuyến lớn, dễ thao tác bằng một tay.
- Lối tắt tra cứu vé, gửi hàng, hỗ trợ khi phù hợp.

Tìm chuyến không bắt buộc đăng nhập.

---

## 6.3 Danh sách kết quả — HIGH

### Chức năng

- Danh sách chuyến nhiều nhà xe.
- Card đủ thông tin cốt lõi nhưng ưu tiên khả năng đọc trên màn hình nhỏ.
- Filter/sort có thể đặt trong bottom sheet/modal.
- Hỗ trợ pagination/load-more theo API.
- Nhấn card/CTA để vào chi tiết.

### Trạng thái

- skeleton/loading;
- empty;
- error + retry;
- success.

---

## 6.4 Chi tiết chuyến — HIGH

- Nhà xe.
- Tuyến/điểm đi – đến.
- Giờ khởi hành.
- Xe/loại xe.
- Giá.
- Trạng thái.
- CTA chọn ghế dạng sticky bottom action nếu phù hợp.

---

## 6.5 Chọn ghế — HIGH

### Chức năng

- Sơ đồ ghế có thể scroll/zoom theo loại xe nếu cần.
- Tap target đủ lớn để chọn ghế chính xác.
- Legend trạng thái ghế dễ hiểu.
- Thanh tóm tắt sticky ở dưới:
  - ghế đã chọn;
  - số lượng;
  - giá/tạm tính;
  - CTA tiếp tục.
- Xử lý `SEAT_UNAVAILABLE` và refresh trạng thái từ backend.
- Hiển thị countdown nếu backend bật seat hold.

---

## 6.6 Checkout — HIGH

Nên tổ chức thành từng section/step rõ ràng trên mobile:

1. Tóm tắt chuyến và ghế.
2. Thông tin người liên hệ/hành khách.
3. Khuyến mãi.
4. Tổng tiền từ booking quote.
5. Xác nhận tiếp tục thanh toán.

Keyboard không được che field/CTA quan trọng; lỗi validation phải đưa user tới đúng field cần sửa.

---

## 6.7 Thanh toán online trên Mobile — HIGH

### Chức năng

- Chọn MoMo/VNPAY/ZaloPay theo provider backend trả hỗ trợ.
- Mở payment URL/deep link theo flow đã chọn.
- Khi app được mở lại/resume:
  - không tự giả định đã thanh toán;
  - gọi API kiểm tra payment status;
  - đưa user tới màn hình kết quả phù hợp.

### Màn hình kết quả

- Pending/đang xác minh.
- Success.
- Failure.
- Retry/check again nếu phù hợp.

---

## 6.8 Authentication — HIGH/MEDIUM

Mobile phải có:

- Đăng nhập.
- Đăng ký.
- OTP đăng ký.
- Quên mật khẩu.
- OTP reset.
- Đặt lại mật khẩu.
- Đăng xuất.

Sau khi login giữa flow booking, phải có khả năng quay lại đúng ngữ cảnh hợp lý thay vì bắt user tìm chuyến lại từ đầu, trong phạm vi state app cho phép.

---

## 6.9 Tài khoản cá nhân — MEDIUM

Màn hình Account/Profile:

- Avatar placeholder nếu chưa có chức năng upload.
- Thông tin cá nhân.
- Sửa thông tin.
- Đổi mật khẩu.
- Lịch sử giao dịch.
- Lối tới vé, hóa đơn, gửi hàng, đánh giá, hỗ trợ và ngôn ngữ.

---

## 6.10 Vé của tôi — MEDIUM

### Danh sách

- Vé sắp tới/đã qua/hủy nếu backend status cho phép phân nhóm.
- Card tóm tắt chuyến, giờ, ghế, trạng thái.

### Chi tiết

- Mã vé.
- Nhà xe/chuyến.
- Thời gian.
- Ghế.
- Hành khách.
- Trạng thái.
- Payment liên quan khi có.

### Hủy vé

- Confirmation rõ ràng.
- Hiển thị điều kiện/phí/hoàn tiền nếu backend cung cấp.
- Refresh trạng thái sau thành công.

### Đổi vé — LOW/TBD

Chỉ làm khi business rule đổi vé đã được chốt và endpoint backend hoàn chỉnh.

---

## 6.11 Tra cứu vé — MEDIUM

- Form mã vé + thông tin xác minh.
- Kết quả hiển thị theo mobile card/detail.
- Không lộ dữ liệu nhạy cảm.
- Có thể dùng không đăng nhập nếu API Public.

---

## 6.12 Hóa đơn — MEDIUM

- Danh sách hóa đơn của user.
- Chi tiết hóa đơn.
- Màn hình tra cứu hóa đơn public nếu backend hỗ trợ.
- Không bắt buộc download PDF cho đến khi backend có contract tương ứng.

---

## 6.13 Lịch sử giao dịch — MEDIUM

- Danh sách phân trang/load-more.
- Loại giao dịch.
- Số tiền.
- Trạng thái.
- Thời gian.
- Đi vào chi tiết liên quan khi có identifier phù hợp.

---

## 6.14 Gửi hàng hóa — MEDIUM

### Màn hình cần có

- Gửi hàng/landing.
- Tính cước/tạo phiếu gửi.
- Danh sách phiếu gửi của tôi.
- Chi tiết phiếu gửi.
- Tra cứu shipment bằng tracking code.

### Flow tạo phiếu

1. Chọn bưu cục/điểm gửi nhận.
2. Nhập sender/receiver.
3. Nhập thông tin hàng hóa.
4. Gọi quote.
5. Hiển thị breakdown phí.
6. Xác nhận tạo phiếu.
7. Thanh toán nếu nghiệp vụ yêu cầu.
8. Hiển thị tracking code/kết quả.

Không dựng timeline tracking giả khi backend mới chỉ có trạng thái hiện tại.

---

## 6.15 Chat realtime hỗ trợ — MEDIUM

### UI

- Danh sách tin nhắn dạng conversation.
- Input message cố định phía dưới.
- Trạng thái đang kết nối/mất kết nối phù hợp.
- Tin mới realtime.
- Read state nếu backend hỗ trợ.

Mobile phải xử lý bàn phím để ô nhập/tin nhắn không bị che.

Chỉ phân biệt bubble customer/CSKH sau khi backend có sender identity/type rõ ràng.

---

## 6.16 Notifications — LOW

- Màn hình danh sách notifications.
- Badge unread trên icon/tab nếu có.
- Mark read / read all.
- Tap notification điều hướng tới màn hình liên quan khi payload có đủ target.

Push notification FCM/APNs không mặc định nằm trong scope nếu backend chưa có device token model.

---

## 6.17 Đánh giá dịch vụ — LOW

- Rating control phù hợp mobile.
- Comment.
- Submit.
- Xem/sửa đánh giá của mình nếu rule cho phép.
- Chỉ cho mở flow từ service đã sử dụng hoặc backend xác minh quyền đánh giá.

---

## 6.18 Chuyển đổi Việt – Anh — MEDIUM

Có mục chọn ngôn ngữ trong Account/Settings và có thể có quick action nếu thiết kế cần.

Sau khi đổi ngôn ngữ:

- cập nhật toàn bộ label/menu/button/form message của app;
- giữ nguyên dữ liệu nghiệp vụ không có locale;
- error code backend được map sang bản dịch client phù hợp.

---

## 6.19 Gợi ý chuyến thay thế — LOW

Hiển thị danh sách thay thế ở dạng card/bottom sheet khi backend cung cấp, cho phép user mở chuyến mới và bắt đầu lại bước chọn ghế.

---

## 6.20 Chatbot AI — LOW, optional

Nếu làm:

- màn hình/chat sheet riêng;
- hiển thị loading/streaming nếu implementation hỗ trợ;
- có fallback lỗi;
- không dùng chatbot làm nguồn sự thật cho booking/payment/ticket/seat.

---

# 7. Các trạng thái UI bắt buộc cho feature có gọi API

Mỗi màn hình có dữ liệu từ API phải xem xét các trạng thái sau khi phù hợp:

| Trạng thái | Yêu cầu |
|---|---|
| Initial | Chưa thao tác hoặc chưa đủ điều kiện gọi API. |
| Loading | Có skeleton/progress phù hợp, tránh user tưởng app đứng. |
| Success | Render dữ liệu thật từ API. |
| Empty | Có thông báo và hành động tiếp theo hợp lý nếu danh sách rỗng. |
| Validation error | Chỉ rõ field/dữ liệu cần sửa. |
| Business error | Map error code backend thành thông báo dễ hiểu; ví dụ `SEAT_UNAVAILABLE`. |
| Network/server error | Có retry khi thao tác có thể retry an toàn. |
| Submitting | Chặn double-submit ở thao tác tạo booking/payment/shipment phù hợp. |

Không phải màn hình nào cũng cần mọi trạng thái; chỉ áp dụng các trạng thái có ý nghĩa đối với feature đó.

---

# 8. Flow nghiệm thu bắt buộc

## 8.1 Flow A — tìm và đặt vé — HIGH

Cả Web và Mobile phải demo được end-to-end:

```text
Trang chủ
→ Tìm chuyến
→ Danh sách chuyến nhiều nhà xe
→ Chi tiết chuyến
→ Chọn ghế
→ Booking quote / nhập thông tin
→ Áp khuyến mãi (nếu có mã hợp lệ)
→ Tạo booking
→ Chọn cổng thanh toán
→ Thanh toán
→ Backend xác nhận trạng thái
→ Màn hình kết quả
→ Xem vé đã tạo
```

Đây là flow quan trọng nhất và phải ưu tiên hoàn thiện trước các feature LOW.

---

## 8.2 Flow B — quản lý tài khoản và vé — MEDIUM

```text
Đăng nhập
→ Tài khoản cá nhân
→ Danh sách vé
→ Chi tiết vé
→ Hủy vé khi đủ điều kiện
→ Trạng thái vé được cập nhật
```

---

## 8.3 Flow C — tra cứu vé/hóa đơn — MEDIUM

```text
Tra cứu vé hoặc hóa đơn
→ Nhập mã + dữ liệu xác minh
→ API xác minh
→ Hiển thị kết quả hợp lệ / không tìm thấy
```

---

## 8.4 Flow D — gửi hàng — MEDIUM

```text
Gửi hàng
→ Chọn thông tin gửi/nhận
→ Nhập hàng hóa
→ Tính quote
→ Xác nhận tạo phiếu
→ Thanh toán nếu có
→ Nhận tracking code
→ Xem/tra cứu trạng thái phiếu gửi
```

---

## 8.5 Flow E — chat hỗ trợ — MEDIUM

```text
Mở hỗ trợ
→ Tải lịch sử
→ Gửi tin
→ Backend persist
→ Nhân viên CSKH trả lời
→ Customer nhận tin realtime
```

Flow này chỉ nghiệm thu đầy đủ sau khi model chat giải quyết được sender/conversation như `endpoint-api.md` đã ghi.

---

## 8.6 Flow F — Việt/Anh — MEDIUM

```text
Mở ứng dụng/site
→ Chọn English
→ Toàn bộ UI client chuyển sang English
→ Điều hướng qua nhiều màn hình
→ Ngôn ngữ vẫn nhất quán
→ Chuyển lại Tiếng Việt
```

Không yêu cầu dịch tự động dữ liệu nghiệp vụ nếu backend không có bản locale tương ứng.

---

# 9. Các điểm chưa được phép tự suy diễn UI

Các mục sau phải chờ business rule/backend/schema chốt, không được tự làm UI như thể đã chắc chắn:

1. **Guest booking:** chưa đủ cơ sở để khẳng định có checkout không đăng nhập.
2. **Seat hold:** chỉ hiển thị countdown nếu backend có owner/expiry và trả `expiresAt`.
3. **Hủy từng vé hay hủy cả booking:** UI phải theo rule cuối cùng của backend.
4. **Đổi vé khác nhà xe:** chưa được mặc định cho phép.
5. **Invoice PDF/e-invoice:** chưa có contract sinh/tải file.
6. **Shipment tracking timeline:** class diagram hiện chưa có lịch sử trạng thái đầy đủ.
7. **Push notification:** chưa có device token/subscription model trong scope hiện tại.
8. **Chat bubble sender/conversation:** model hiện tại cần bổ sung để phân biệt chính xác hai phía.
9. **Nội dung song ngữ từ database:** chưa có locale model rõ ràng; chỉ i18n UI client là bắt buộc.

---

# 10. Phân kỳ bàn giao để hai người làm song song

## Giai đoạn 1 — HIGH foundation

### Bạn A — Web

- Web shell/responsive layout.
- Đăng ký/đăng nhập/đăng xuất.
- Trang chủ.
- Tìm chuyến nhiều nhà xe.
- Danh sách kết quả.
- Chi tiết chuyến.
- UI chọn ghế/checkout/payment có thể dựng theo contract trước khi API B hoàn tất.

### Bạn B — Mobile

- Mobile navigation/shell.
- UI auth theo contract A.
- UI search/trip theo contract A.
- Chọn ghế.
- Checkout.
- Promotion.
- Booking.
- Payment/deep-link result.

**Mục tiêu cuối giai đoạn:** cả hai nền tảng đã có đầy đủ khung flow HIGH; phần nào API chưa xong có thể tạm dùng mock đúng contract nhưng phải được đánh dấu chưa hoàn thành full-stack.

---

## Giai đoạn 2 — HIGH integration end-to-end

- A tích hợp API seat/booking/promotion/payment của B vào Customer Web.
- B tích hợp API auth/search/trip của A vào Customer Mobile.
- Loại bỏ mock khỏi flow cốt lõi.
- Demo end-to-end tìm chuyến → đặt → thanh toán → xem vé trên cả Web và Mobile.

---

## Giai đoạn 3 — MEDIUM requirements

Cả hai nền tảng hoàn thiện:

- profile/account;
- forgot/reset password;
- tickets + cancel;
- ticket lookup;
- invoices + lookup;
- transaction history;
- shipment;
- support chat realtime;
- Việt – Anh.

---

## Giai đoạn 4 — LOW polish/extension

Sau khi HIGH + MEDIUM ổn định:

- exchange ticket;
- notifications;
- reviews;
- alternative trips;
- dynamic content nếu cần;
- chatbot AI nếu còn thời gian và team quyết định triển khai.

---

# 11. Definition of Done riêng cho UI/UX feature

Một chức năng Customer trên Web hoặc Mobile chỉ được đánh dấu hoàn thành khi:

- có màn hình/flow đúng scope nghiệp vụ;
- dùng API thật qua frontend service layer;
- dữ liệu hiển thị từ backend, không còn mock làm nguồn chính;
- có loading/error/empty/success khi phù hợp;
- form có validation UX phù hợp và xử lý lỗi backend;
- không tự cài business rule thay backend;
- auth/permission phù hợp với Customer;
- thao tác có feedback rõ ràng;
- các trạng thái sau mutation được refresh/sync từ backend;
- Web responsive trên kích thước màn hình mục tiêu;
- Mobile sử dụng được với keyboard/back/app-resume theo flow liên quan;
- Việt/Anh không làm vỡ layout đối với các màn hình nằm trong scope i18n;
- flow chính được test thủ công hoặc tự động theo kế hoạch kiểm thử của team.

---

# 12. Checklist bàn giao theo thành viên

## Bạn A — Customer Web

- [ ] Web shell + responsive layout.
- [ ] Auth đầy đủ.
- [ ] Tìm kiếm chuyến nhiều nhà xe.
- [ ] Chi tiết chuyến.
- [ ] Chọn ghế.
- [ ] Checkout + promotion.
- [ ] Payment + payment result.
- [ ] Account/profile.
- [ ] Tickets + cancel + lookup.
- [ ] Invoices + lookup.
- [ ] Transaction history.
- [ ] Shipments + quote + lookup.
- [ ] Realtime support chat.
- [ ] Việt – Anh.
- [ ] LOW features được chọn triển khai.
- [ ] Không còn mock ở feature đã đánh dấu done.

## Bạn B — Customer Mobile

- [ ] Navigation/shell Mobile.
- [ ] Auth đầy đủ.
- [ ] Tìm kiếm chuyến nhiều nhà xe.
- [ ] Chi tiết chuyến.
- [ ] Chọn ghế.
- [ ] Checkout + promotion.
- [ ] Payment/deep link + app-resume status.
- [ ] Account/profile.
- [ ] Tickets + cancel + lookup.
- [ ] Invoices + lookup.
- [ ] Transaction history.
- [ ] Shipments + quote + lookup.
- [ ] Realtime support chat.
- [ ] Việt – Anh.
- [ ] LOW features được chọn triển khai.
- [ ] Không còn mock ở feature đã đánh dấu done.

---

## Nguyên tắc chốt scope

**CÙNG NGHIỆP VỤ CUSTOMER · CÙNG API · CÙNG BUSINESS RULE**  
**KHÁC UI/UX THEO WEB VÀ MOBILE**

Web và Mobile không được biến thành hai hệ thống có nghiệp vụ khác nhau chỉ vì hai thành viên phát triển riêng. Sự khác nhau chủ yếu nằm ở cách điều hướng, bố cục và tương tác phù hợp với từng nền tảng.
