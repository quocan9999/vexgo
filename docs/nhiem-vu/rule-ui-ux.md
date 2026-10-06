# UI/UX Development Rules — VexGo Customer

> Phạm vi áp dụng: **Customer Web (`apps/web`) và Customer Mobile**.  
> Không áp dụng cho Admin Web trừ các rule chung về chất lượng component/code có thể tái sử dụng.  
> Danh sách chức năng/màn hình cần bàn giao xem tại `function-uiux.md`. API contract xem tại `endpoint-api.md`. Quy tắc API xem tại `rule-api.md`.

---

# 1. Nguyên tắc cốt lõi

Customer Web và Customer Mobile có thể khác nhau về cách bố trí và interaction, nhưng phải thống nhất về business flow và dữ liệu.

```text
ONE BUSINESS FLOW
ONE API CONTRACT
ONE DESIGN LANGUAGE

DIFFERENT PLATFORM UX
DIFFERENT LAYOUT WHEN NECESSARY
```

- Web và Mobile **MUST NOT** tự tạo business rule riêng.
- UI chỉ quyết định cách trình bày và tương tác; backend là nguồn sự thật cho giá, ghế, khuyến mãi, trạng thái vé, trạng thái thanh toán, quyền hủy/đổi và các rule nghiệp vụ khác.
- Web và Mobile **SHOULD** có cùng cách gọi tên khái niệm nghiệp vụ, cùng trạng thái và cùng ý nghĩa feedback để người dùng không gặp hai hệ thống “khác nhau về logic”.
- Một màn hình đẹp nhưng chưa xử lý loading/error/empty/disabled/success **không được xem là hoàn thành**.

---

# 2. BẮT BUỘC audit component trước khi code

Đây là rule quan trọng nhất khi agent hoặc developer bắt đầu một chức năng UI mới.

## 2.1 Trước khi viết component mới

Developer/agent **MUST quét toàn bộ component dùng chung có liên quan trước khi code**.

Tối thiểu phải kiểm tra:

1. shared/common components của platform hiện tại;
2. components trong feature gần giống;
3. form controls đang dùng;
4. button/link/action components;
5. modal/dialog/bottom-sheet/drawer;
6. table/list/card;
7. loading/skeleton/spinner;
8. empty/error states;
9. toast/alert/notification UI;
10. typography/icon/image wrappers;
11. pagination/load-more;
12. date/time/money/status display;
13. layout/container/navigation components;
14. hooks/utilities liên quan tới UI state hoặc responsive behavior.

Nếu repository có `AGENTS.md` cục bộ trong app đang sửa, **MUST đọc trước khi chỉnh code**.

## 2.2 Không được tạo component trùng chức năng

Ví dụ repository đã có:

```text
ViewDetailButton
```

và feature mới cũng cần nút “Xem chi tiết”, developer **MUST ưu tiên reuse hoặc mở rộng component hiện có**.

Sai:

```text
TripDetailButton
BookingDetailButton
ShipmentDetailButton
```

nếu cả ba chỉ là cùng một button với label/icon/style giống nhau.

Đúng hơn:

```tsx
<ViewDetailButton href={...} />
```

hoặc một component dùng chung có props phù hợp.

## 2.3 Khi nào được tạo component mới?

Chỉ tạo component mới khi ít nhất một trong các điều kiện sau đúng:

- chưa có component tương đương;
- component hiện tại khác rõ ràng về trách nhiệm/interaction;
- ép reuse sẽ làm API component khó hiểu hoặc phụ thuộc feature không hợp lý;
- component mới có khả năng được tái sử dụng và có boundary rõ ràng;
- component cũ cần refactor nhưng việc thay đổi có blast radius lớn, đã được đánh giá và thống nhất.

**MUST NOT** tạo component mới chỉ vì “viết nhanh hơn tìm component cũ”.

## 2.4 Component audit phải để lại dấu vết

Khi làm feature đáng kể, PR/task **SHOULD ghi ngắn gọn**:

```text
Component audit:
- Reused: Button, Input, EmptyState, LoadingSkeleton
- Extended: TripCard thêm variant="compact"
- New: SeatMap vì repository chưa có component tương đương
```

Mục đích là giúp reviewer biết developer đã kiểm tra khả năng reuse trước khi tạo mới.

---

# 3. Ưu tiên reuse theo thứ tự

Khi cần UI element, dùng thứ tự quyết định sau:

```text
1. Reuse nguyên component hiện có
2. Reuse bằng props/variant hiện có
3. Mở rộng component hiện có bằng API tổng quát
4. Refactor component hiện có để hỗ trợ use case chung
5. Tạo component mới
```

Không được nhảy thẳng từ bước 1 sang bước 5 nếu chưa kiểm tra các lựa chọn giữa.

Nếu mở rộng component:

- props mới phải có ý nghĩa tổng quát;
- không thêm props dạng `isTripPage`, `isBookingPage`, `forShipmentPage` nếu có thể biểu diễn bằng variant/callback/data;
- tránh component chứa hàng loạt `if` theo từng feature.

---

# 4. Shared component và feature component

## 4.1 Shared component

Một component **SHOULD nằm trong shared/common** khi:

- không chứa business rule riêng của một feature;
- có thể dùng ở từ hai feature trở lên;
- API component có ý nghĩa tổng quát;
- không phụ thuộc service/API cụ thể của feature.

Ví dụ phù hợp:

```text
Button
TextField
Select
Modal / Dialog
BottomSheet
EmptyState
ErrorState
Skeleton
Pagination
ConfirmDialog
StatusBadge base
PageContainer
MoneyText
DateTimeText
```

## 4.2 Feature component

Component gắn với domain cụ thể **SHOULD nằm trong feature tương ứng**, ví dụ:

```text
features/trips/components/TripCard
features/bookings/components/SeatMap
features/bookings/components/BookingSummary
features/payments/components/PaymentMethodSelector
features/shipments/components/ShipmentTimeline
```

Không đưa mọi component vào `shared/` chỉ để “có vẻ tái sử dụng”. Shared quá lớn sẽ trở thành nơi chứa code không có ownership.

---

# 5. Cấu trúc feature frontend

Feature frontend **SHOULD** đi theo cấu trúc tương tự:

```text
features/<feature>/
├── components/
├── hooks/
├── services/
├── types/
├── utils/
└── constants/
```

Tùy framework có thể bổ sung `screens/`, `pages/`, `schemas/`, `store/` khi thực sự cần.

Rule:

- component tập trung vào render và interaction;
- API call nằm trong service/query layer phù hợp;
- type của API/domain không khai báo lặp lại ở nhiều component;
- formatter/mapper dùng nhiều nơi phải tách khỏi JSX;
- business rule backend không được copy sang component.

---

# 6. Không gọi API rải rác trong component

UI component **MUST NOT** tự `fetch`/gọi HTTP tùy tiện ở nhiều nơi.

Luồng mong muốn:

```text
Screen/Page
  ↓
Hook / Query / ViewModel layer
  ↓
Feature service
  ↓
Shared API client / interceptor
  ↓
Backend API
```

Lợi ích:

- thống nhất auth/interceptor;
- dễ đổi endpoint;
- dễ test;
- tránh duplicate request logic;
- Web/Mobile dễ bám cùng API contract.

---

# 7. Component phải có trách nhiệm rõ ràng

Một component **SHOULD có một mục đích chính**.

Cảnh báo component đang quá lớn nếu nó đồng thời:

- gọi nhiều API không liên quan;
- chứa toàn bộ form;
- render nhiều section lớn;
- xử lý payment;
- mở modal;
- mapping DTO;
- format data;
- quản lý websocket;
- chứa hàng trăm dòng conditional JSX.

Khi đó SHOULD tách theo trách nhiệm thực tế, nhưng **không chia nhỏ vô nghĩa** thành quá nhiều file chỉ chứa vài dòng JSX.

---

# 8. Design system và tính nhất quán

## 8.1 Không hard-code style tùy tiện

Nếu project đã có token/theme/design system, UI **MUST dùng token hiện có** cho:

- màu;
- spacing;
- radius;
- font size;
- font weight;
- shadow/elevation;
- breakpoint;
- z-index khi có quy ước.

Tránh:

```text
#1677ff ở file A
#1680ff ở file B
17px ở feature A
18px ở feature B
```

chỉ vì nhìn “gần giống”.

## 8.2 Không tự tạo style riêng khi đã có variant

Nếu Button đã có:

```text
primary
secondary
danger
ghost
```

thì MUST dùng variant trước khi custom CSS/style riêng.

## 8.3 Trạng thái phải nhất quán

Các trạng thái nghiệp vụ như:

```text
Đã thanh toán
Chờ thanh toán
Đã hủy
Hết hạn
Đang xử lý
```

phải có mapping label/appearance tập trung, tránh mỗi màn hình tự chọn một label/màu khác nhau.

---

# 9. Responsive Web

Customer Web **MUST responsive** và sử dụng tốt trên desktop, tablet và smartphone.

## 9.1 Không chỉ “co nhỏ desktop”

Responsive cần xem xét lại:

- số cột;
- thứ tự thông tin;
- kích thước vùng bấm;
- navbar/menu;
- modal vs drawer;
- bảng dữ liệu;
- sticky action;
- form dài;
- seat map;
- checkout summary.

Ví dụ bảng quá rộng trên mobile có thể chuyển sang card/list; không bắt người dùng kéo ngang nhiều cột nếu có layout phù hợp hơn.

## 9.2 Không hard-code viewport

MUST NOT viết layout chỉ đúng cho một kích thước cụ thể.

SHOULD dùng breakpoint/token của project và kiểm thử tối thiểu các nhóm viewport phổ biến mà team thống nhất.

---

# 10. Mobile UX không phải bản sao Web

Mobile và Web dùng cùng business flow nhưng **MUST NOT ép layout desktop xuống mobile**.

Mobile SHOULD ưu tiên:

- vùng bấm đủ lớn;
- thao tác một tay khi phù hợp;
- bottom sheet cho lựa chọn ngắn;
- sticky bottom action cho CTA quan trọng;
- keyboard-aware form;
- safe area;
- pull-to-refresh khi phù hợp;
- native back behavior;
- deep link/payment return flow nếu app hỗ trợ.

Ví dụ checkout Mobile có thể dùng CTA cố định cuối màn hình, trong khi Web dùng summary panel bên phải.

---

# 11. Loading, error, empty, success là bắt buộc

Mỗi màn hình có async data **MUST xác định các trạng thái phù hợp**.

## 11.1 Loading

- Dùng shared spinner/skeleton hiện có.
- Skeleton SHOULD gần với hình dạng nội dung thật khi có ích.
- Không để màn hình trắng không phản hồi trong lúc tải.

## 11.2 Error

Error UI phải:

- nói người dùng hiểu điều gì xảy ra;
- cho phép retry khi retry có ý nghĩa;
- không hiển thị stack trace/raw backend exception;
- map business error thành message phù hợp.

Ví dụ:

```text
409 SEAT_UNAVAILABLE
→ “Ghế A5 vừa được người khác chọn. Vui lòng chọn ghế khác.”
```

không phải:

```text
Request failed with status code 409
```

## 11.3 Empty

Danh sách hợp lệ nhưng không có dữ liệu phải có empty state riêng.

Ví dụ:

- chưa có vé;
- chưa có lịch sử giao dịch;
- không tìm thấy chuyến;
- chưa có thông báo.

Empty state không được dùng chung với error state.

## 11.4 Success

Thao tác ghi dữ liệu cần phản hồi thành công phù hợp bằng:

- toast;
- inline message;
- redirect;
- result screen;
- cập nhật dữ liệu trên màn hình.

Không bắt buộc mọi success đều hiện modal/toast nếu UI đã thể hiện kết quả rõ ràng.

---

# 12. Form và validation UX

## 12.1 Frontend validation phục vụ UX

Frontend **SHOULD validate sớm** các điều kiện hình thức như:

- required;
- email format;
- phone format;
- min/max length;
- định dạng ngày;
- confirmation field.

Nhưng frontend **MUST NOT** tự quyết định business rule cuối cùng như:

- mã giảm giá có hợp lệ không;
- ghế còn không;
- booking có được hủy không;
- số tiền cuối cùng;
- payment đã thành công chưa.

## 12.2 Error đặt gần field

Lỗi field SHOULD hiển thị gần input liên quan.

Không nên chỉ có một toast “Dữ liệu không hợp lệ” trong khi người dùng không biết field nào sai.

## 12.3 Không mất dữ liệu người dùng không cần thiết

Khi request fail vì lỗi mạng hoặc business error, form SHOULD giữ lại dữ liệu hợp lệ đã nhập, trừ khi có lý do bảo mật/nghiệp vụ phải xóa.

---

# 13. Disable và chống double-submit

CTA ghi dữ liệu như:

```text
Đặt vé
Thanh toán
Hủy vé
Gửi yêu cầu
Tạo phiếu gửi hàng
```

**MUST có trạng thái pending/disabled phù hợp** để tránh user bấm liên tục.

Tuy nhiên disable button chỉ là UX guard; backend vẫn phải xử lý idempotency/concurrency theo `rule-api.md`.

Không được dùng optimistic success cho thao tác nhạy cảm như:

- xác nhận ghế;
- tạo booking;
- thanh toán;
- hủy vé có hoàn tiền;

trước khi backend xác nhận.

---

# 14. Tiền, thời gian và dữ liệu trình bày

## 14.1 Tiền

- MUST format tiền qua utility/component thống nhất.
- Không tự format ở từng màn hình.
- Không tự tính lại tổng tiền nếu backend đã trả quote/final amount.

## 14.2 Ngày giờ

- MUST format ngày giờ qua utility chung.
- Không tự parse timezone bằng logic rải rác.
- Dữ liệu ngày/giờ nghiệp vụ phải dùng đúng giá trị API trả về.

## 14.3 Mapping DTO sang ViewModel

Nếu API DTO không tiện render, **SHOULD map ở service/hook/mapper**, không nhồi mapping phức tạp trực tiếp trong JSX.

---

# 15. Tìm chuyến và danh sách kết quả

UI tìm chuyến phải thể hiện rõ đây là nền tảng **nhiều nhà xe**.

MUST NOT:

- hard-code một nhà xe mặc định làm nguồn dữ liệu duy nhất;
- viết text/branding khiến người dùng hiểu đây là website riêng của một nhà xe;
- filter client-side trên một subset nhỏ nếu API đã hỗ trợ filter server-side và dataset có thể lớn.

Danh sách kết quả SHOULD reuse một `TripCard`/equivalent có variant khi cần, thay vì tạo card riêng cho từng trang có cùng thông tin cốt lõi.

---

# 16. Chọn ghế

Seat map là UI có business sensitivity cao.

## 16.1 Nguồn sự thật

Frontend chỉ hiển thị trạng thái ghế dựa trên API/realtime state hiện tại.

MUST xử lý trường hợp:

- ghế vừa bị người khác giữ;
- hold hết hạn;
- refresh dữ liệu;
- retry sau conflict;
- user quay lại màn hình sau một khoảng thời gian.

## 16.2 Trạng thái ghế

Các trạng thái phải dễ phân biệt bằng nhiều dấu hiệu khi phù hợp, không chỉ dựa duy nhất vào màu.

Ví dụ kết hợp:

- màu;
- icon;
- border;
- text/legend;
- disabled state.

## 16.3 Countdown hold

Nếu backend có `expiresAt`, frontend tính countdown để hiển thị UX nhưng **không được xem countdown local là nguồn sự thật tuyệt đối**.

Khi hết giờ, phải refresh/revalidate với backend.

---

# 17. Checkout và payment

## 17.1 Tóm tắt trước khi trả tiền

Trước CTA thanh toán SHOULD hiển thị rõ:

- chuyến;
- nhà xe;
- ghế;
- hành khách/liên hệ;
- giá gốc;
- giảm giá;
- phí nếu có;
- tổng tiền cuối cùng.

## 17.2 Payment state

MUST phân biệt tối thiểu:

```text
Đang khởi tạo thanh toán
Chờ xác nhận
Thành công
Thất bại
Đã hủy
Hết hạn (nếu domain có)
```

Không được coi việc user quay về từ app/web payment provider là bằng chứng thanh toán thành công. UI phải lấy trạng thái backend.

## 17.3 Retry

Retry payment phải theo contract backend, không tự tạo giao dịch mới vô hạn mỗi lần user bấm nếu flow cũ còn hiệu lực.

---

# 18. Realtime chat và notification

## 18.1 Chat

Chat UI SHOULD tách:

- conversation list nếu domain có nhiều cuộc hội thoại;
- message list;
- composer;
- connection/reconnect state;
- loading older messages;
- failed send/retry khi phù hợp.

MUST tránh duplicate message khi socket reconnect hoặc server event bị nhận lặp.

## 18.2 Notification

Notification UI phải phân biệt:

- unread/read;
- action/deep-link nếu có;
- empty state;
- pagination/load-more nếu danh sách dài.

Không tự suy diễn notification business event nếu backend chưa định nghĩa.

---

# 19. Việt – Anh / i18n

Các text người dùng nhìn thấy **MUST đi qua hệ thống i18n** nếu feature thuộc phạm vi Việt – Anh.

MUST NOT hard-code rải rác:

```tsx
<button>Đặt vé</button>
```

nếu project đã có translation framework.

Nên dùng key ổn định, ví dụ:

```text
booking.actions.book
booking.errors.seatUnavailable
payment.status.pending
```

Rules:

- không dùng nguyên message backend làm text duy nhất cho UI nếu cần dịch;
- error code nên map sang translation key;
- tránh ghép câu bằng nhiều fragment gây sai ngữ pháp khi dịch;
- layout phải chịu được text tiếng Anh dài hơn tiếng Việt hoặc ngược lại.

---

# 20. Accessibility

Web và Mobile **SHOULD đảm bảo accessibility cơ bản**.

Tối thiểu:

- button thực sự là control có thể tương tác, không giả bằng `div` khi không cần;
- icon-only action phải có accessible label;
- form input có label;
- trạng thái focus rõ trên Web;
- thao tác chính dùng được bằng keyboard khi phù hợp;
- không chỉ dùng màu để truyền tải trạng thái;
- image có alt/accessibility description khi cần;
- modal/dialog quản lý focus đúng theo library/framework hiện có;
- touch target Mobile đủ dễ bấm.

---

# 21. Navigation và route state

- Không duplicate logic navigation ở nhiều component nếu đã có helper/route config.
- Auth-required screen phải dùng guard/middleware/navigation pattern hiện có.
- Sau login, SHOULD có khả năng quay lại flow đang làm khi hợp lý.
- Payment return/deep link MUST map vào một màn hình kiểm tra trạng thái backend, không hiển thị success chỉ dựa vào query params từ client/provider.
- Không lưu dữ liệu nhạy cảm dài hạn trong URL/query params nếu không cần.

---

# 22. State management

Không dùng global state cho mọi thứ.

Phân loại:

```text
Server state
→ query/cache layer phù hợp

Local UI state
→ component/hook local

Cross-screen app state thực sự cần dùng chung
→ global store/context phù hợp
```

MUST NOT đưa mọi input/form/modal flag vào global store chỉ vì tiện truy cập.

Server state như trips, tickets, booking detail SHOULD được invalidation/refetch đúng sau mutation thay vì duplicate thành nhiều nguồn sự thật local.

---

# 23. Cache và dữ liệu cũ

Caching SHOULD giúp UX nhưng không được làm sai business state.

Các dữ liệu nhạy với thời gian như:

- ghế còn trống;
- giá hiện tại;
- booking status;
- payment status;
- promotion validity;

phải có strategy revalidate/refetch phù hợp.

MUST NOT giữ cache cũ và dùng nó để xác nhận booking/payment.

---

# 24. Modal, Dialog, Drawer, Bottom Sheet

Trước khi tạo mới, MUST dùng shared component hiện có.

Guideline:

- xác nhận thao tác nguy hiểm → ConfirmDialog/Alert phù hợp;
- lựa chọn ngắn trên Mobile → BottomSheet có thể phù hợp;
- nội dung dài/complex form → ưu tiên screen/page khi modal gây khó sử dụng;
- không mở modal chồng modal nếu có flow tốt hơn;
- action destructive phải rõ ràng và không đặt quá gần action an toàn theo cách dễ bấm nhầm.

---

# 25. Toast và feedback

Toast chỉ dùng cho feedback ngắn, không nên chứa thông tin bắt buộc người dùng phải đọc kỹ.

MUST NOT dùng toast để thay thế:

- validation error của nhiều field;
- payment result screen;
- booking confirmation có thông tin quan trọng;
- error cần action rõ ràng.

Tránh spam nhiều toast liên tiếp cho cùng một lỗi.

---

# 26. Icon, image và asset

- MUST reuse icon set/library hiện có.
- Không thêm một icon library mới chỉ vì thiếu một icon nếu library hiện tại có lựa chọn tương đương.
- Ảnh cần fallback nếu nguồn ảnh có thể lỗi.
- Không commit asset duplicate hoặc cùng ảnh nhiều kích thước nếu pipeline hiện tại có thể xử lý.
- Logo/brand assets dùng nguồn thống nhất.

---

# 27. Performance UI

SHOULD chú ý:

- tránh re-render không cần thiết ở list/seat map;
- list dài dùng pagination/load-more/virtualization khi cần;
- ảnh dùng kích thước phù hợp;
- không bundle thư viện lớn chỉ cho một interaction đơn giản;
- tránh request lặp do effect/query key sai;
- debounce search input khi API design yêu cầu;
- không debounce CTA transactional như “Đặt vé” thay cho proper pending/idempotency handling.

Performance optimization chỉ nên làm dựa trên vấn đề thực tế; không thêm memoization phức tạp khắp nơi nếu không có lợi ích rõ.

---

# 28. Không duplicate business mapping giữa Web và Mobile

Web và Mobile có codebase UI khác nhau nhưng các quy ước sau phải đồng bộ về ý nghĩa:

- API error code;
- booking/payment/ticket status;
- promotion result;
- label nghiệp vụ;
- formatter tiền/ngày giờ;
- quyền thực hiện action.

Nếu không thể share code vật lý giữa Web và Mobile, team vẫn **MUST share contract/tài liệu/mapping definition** để tránh hai nền tảng hiểu khác nhau.

---

# 29. Mock/fixture

Mock được phép để hai thành viên làm song song, nhưng:

- mock **MUST bám API contract dự kiến**;
- đặt ở nơi dễ thay thế/xóa;
- không hard-code trực tiếp vào production component;
- không coi feature hoàn thành khi vẫn phụ thuộc mock;
- khi API thật sẵn sàng phải thay bằng service thực và test lại các state.

Nếu mock khác API thật, sửa mock/client theo contract đã chốt; **MUST NOT** tự bẻ API chỉ để hợp mock cũ.

---

# 30. Error handling thống nhất

Nên có một lớp mapping error dùng chung.

Ví dụ:

```text
VALIDATION_ERROR
→ map details vào field

SEAT_UNAVAILABLE
→ thông báo chọn ghế khác

PROMOTION_INVALID
→ giữ checkout, báo mã không hợp lệ

PAYMENT_FAILED
→ hiện payment failed state + action phù hợp

UNAUTHORIZED
→ auth flow/interceptor xử lý
```

Feature component SHOULD xử lý behavior đặc thù của feature, còn parsing HTTP error cơ bản nên nằm ở shared client/error layer.

---

# 31. Destructive action

Các thao tác như:

- hủy vé;
- xóa dữ liệu cá nhân nếu sau này có;
- hủy gửi hàng nếu domain cho phép;

SHOULD có xác nhận khi hậu quả đáng kể.

Confirmation phải nói rõ hành động và hậu quả; tránh text chung chung kiểu:

```text
“Bạn có chắc không?”
```

nếu có thể nói cụ thể:

```text
“Bạn có chắc muốn hủy vé VXG123? Phí hủy sẽ được áp dụng theo chính sách hiện hành.”
```

Không được tự ghi số tiền hoàn/phí hủy nếu backend chưa trả kết quả đó.

---

# 32. Quy tắc với AI coding agent

Khi agent được giao làm UI/UX feature, agent **MUST thực hiện theo thứ tự**:

```text
1. Đọc AGENTS.md ở root
2. Đọc AGENTS.md cục bộ của app nếu có
3. Đọc function-uiux.md
4. Đọc endpoint-api.md / rule-api.md cho feature liên quan
5. Khảo sát cấu trúc feature hiện tại
6. Quét shared/common components
7. Quét component tương tự ở feature khác
8. Kiểm tra hook/service/type hiện có
9. Đánh giá impact theo rule GitNexus của repository trước khi sửa symbol hiện có
10. Lập kế hoạch reuse / extend / new component
11. Code
12. Kiểm tra loading/error/empty/success
13. Kiểm tra responsive/accessibility/i18n
14. Chạy lint/typecheck/test/build phù hợp
15. Chạy detect-changes theo rule repository trước khi commit
```

Agent **MUST NOT**:

- tạo component mới trước khi audit component hiện có;
- duplicate service/hook/type vì “không tìm thấy ngay”;
- viết API call trực tiếp rải rác trong JSX;
- bỏ qua component shared vì muốn custom style riêng;
- sửa shared component có blast radius lớn mà không kiểm tra impact;
- tự thay đổi API contract để UI chạy;
- bỏ loading/error state chỉ để demo happy path;
- hard-code text nếu feature đang hỗ trợ i18n;
- hard-code mock làm production data source.

---

# 33. Checklist trước khi mở PR

Developer/agent phải tự kiểm tra:

### Component reuse

- [ ] Đã quét shared/common components.
- [ ] Đã kiểm tra component tương tự trong feature khác.
- [ ] Không tạo component trùng chức năng.
- [ ] Component mới có lý do rõ ràng.
- [ ] Shared component được mở rộng bằng API tổng quát, không bằng flag theo từng page vô nghĩa.

### UI state

- [ ] Loading state.
- [ ] Error state.
- [ ] Empty state nếu phù hợp.
- [ ] Success feedback.
- [ ] Disabled/pending state cho mutation.
- [ ] Không double-submit.

### Data/API

- [ ] API call đi qua service/client đúng convention.
- [ ] Không copy business rule backend sang UI.
- [ ] Mapping error code đúng.
- [ ] Không còn fixture làm nguồn chính khi feature được đánh dấu hoàn thành.
- [ ] Server state được invalidate/refetch đúng sau mutation.

### UX

- [ ] Web responsive.
- [ ] Mobile hỗ trợ safe area/keyboard/back behavior khi liên quan.
- [ ] Form giữ dữ liệu hợp lý khi lỗi.
- [ ] Destructive action có confirmation khi cần.
- [ ] Không dùng toast thay cho màn hình/trạng thái quan trọng.

### Consistency

- [ ] Dùng design tokens/theme hiện có.
- [ ] Dùng icon library hiện có.
- [ ] Dùng formatter tiền/ngày giờ dùng chung.
- [ ] Trạng thái/label nhất quán.
- [ ] Text đã qua i18n nếu thuộc phạm vi Việt – Anh.

### Quality

- [ ] TypeScript không lạm dụng `any`.
- [ ] Không có dead code/debug log/mock tạm còn sót.
- [ ] Lint/typecheck/test/build phù hợp đều pass.
- [ ] Đã kiểm tra impact/detect-changes theo rule GitNexus của repository nếu có sửa code liên quan.

---

# 34. Definition of Done — UI/UX feature

Một Customer Web/Mobile feature chỉ được xem là hoàn thành khi:

1. màn hình/interaction đúng scope trong `function-uiux.md`;
2. đã audit và reuse component hiện có hợp lý;
3. không tạo duplicate component/service/type;
4. API thật đã được tích hợp hoặc feature được ghi rõ đang ở trạng thái UI-only/mock;
5. loading/error/empty/success được xử lý phù hợp;
6. mutation có pending/disabled và tránh double-submit;
7. business rule quan trọng dùng kết quả backend làm nguồn sự thật;
8. responsive Web hoặc Mobile UX hoạt động đúng platform;
9. i18n Việt – Anh áp dụng cho user-facing text thuộc scope;
10. accessibility cơ bản được kiểm tra;
11. không còn hard-code/mock/debug code không cần thiết;
12. lint/typecheck/test/build phù hợp pass;
13. PR ghi rõ component nào reuse, component nào tạo mới và lý do nếu có.

---

# 35. Quy tắc tóm tắt để agent không làm sai

```text
SCAN BEFORE CREATE.
REUSE BEFORE EXTEND.
EXTEND BEFORE DUPLICATE.

UI IS NOT BUSINESS TRUTH.
API SERVICE IS NOT JSX.
MOCK IS NOT DONE.

EVERY ASYNC SCREEN HAS STATES.
EVERY IMPORTANT ACTION HAS FEEDBACK.
EVERY CUSTOMER TEXT RESPECTS I18N.

WEB MUST BE RESPONSIVE.
MOBILE MUST FEEL MOBILE.
```

