# Audit shell, sidebar và header Admin — 24-10-2026

Mốc code: `d9642f8bb25cca48ba2f3c37b0497314e7a296f8` trên branch `refactor/redesign-ui-ux-admin`.

Phạm vi: `SuperAdminLayout`, `admin-shell.css`, `admin-header.module.css`, shared Sheet/Button, global focus rules và contract trong `apps/admin/DESIGN.md`. Đây là audit bằng source. Không mở browser, không thao tác đăng xuất, không khởi động server và không chạy unit/integration/E2E/UI/component test, TypeScript, ESLint, build hoặc `git diff --check`, theo lựa chọn hiện tại của người dùng.

GitNexus `detect_changes(scope:all)` trước commit trả 339 symbol thay đổi, 269 luồng ảnh hưởng, 75 file và risk critical, không có cờ partial/truncated. Tuy nhiên index tham chiếu commit cũ; số liệu này chỉ là bản đồ ảnh hưởng tham khảo. Đã thử cập nhật bằng `node .gitnexus/run.cjs analyze --index-only`; tiến trình không có tiến độ sau vài phút và được dừng cùng các tiến trình con do lần chạy này tạo ra. Query graph cho shell không trả execution flow phù hợp, nên kết luận audit dựa trên source trực tiếp; không khẳng định đã có graph mới bao phủ commit này.

## Kết quả và ưu tiên

Trạng thái sau các lát cắt tiếp theo: mục 1, 2 và 3 đã có thay đổi code, chờ người dùng smoke; mục 4 chưa triển khai. Bằng chứng dòng dưới đây tham chiếu mốc audit ban đầu, trước thay đổi.

### 1. P2 — Viền focus của link sidebar bị giới hạn bởi vùng cuộn

- Bằng chứng: `apps/admin/src/features/super-admin-layout/admin-shell.css:91` đặt `overflow: hidden auto` cho `.sidebar-scroll`; link trong grid chiếm hết chiều ngang và vùng cuộn không có padding ngang. Global `a:focus-visible` ở `apps/admin/src/styles/admin-components.css:42` vẽ outline 3px với offset 3px ra ngoài link.
- Hệ quả theo CSS: hai cạnh bên của outline nằm ngoài vùng clip. Focus vẫn có thể thấy ở cạnh trên/dưới, nhưng viền không còn trọn vẹn, đặc biệt ở rail chỉ có icon. Mức độ hiển thị thực tế cần smoke bàn phím.
- Hướng sửa: tạo focus ring nằm trong link sidebar hoặc chừa đủ khoảng trống bên trong vùng cuộn. Giữ nguyên chiều rộng rail và scroll ownership.

### 2. P2 — Rail chỉ có icon thiếu nhãn trợ giúp khi dùng bàn phím

- Bằng chứng: `admin-shell.css:190` và `:213` ẩn nhãn ở chế độ thu gọn và tablet. Link có `aria-label` và `title` trong `super-admin-layout.tsx:357`, nhưng chưa có Tooltip chuẩn hỗ trợ focus. `title` là tooltip native, không có contract hiển thị khi focus bằng bàn phím.
- Hệ quả: screen reader vẫn có tên link; người nhìn màn hình dùng bàn phím không có nhãn hiện rõ để phân biệt các icon, nhất là hai mục cùng dùng biểu tượng vé.
- Hướng sửa: dùng một primitive Tooltip chung cho các link ở rail, có hover/focus và Escape; giữ nguyên accessible name và URL. Không tạo bản sao tooltip theo từng mục.

### 3. P2 — Mobile không có cách xem tên và vai trò tài khoản bằng giao diện hiện tại

- Bằng chứng: `admin-header.module.css:180` ẩn `.identity` ở viewport <=700px. Avatar chỉ chứa ký tự đầu và accessible label là tên; tên/vai trò đầy đủ nằm trong các phần tử đã `display:none`. Avatar hiện là span, không có thao tác để mở thông tin.
- Hệ quả: người dùng nhìn giao diện mobile chỉ thấy chữ cái đầu, không xác nhận được tài khoản/vai trò đang dùng. Đây là khoảng trống UX, không phải kết luận có lỗi phân quyền.
- Hướng sửa: bổ sung cách truy cập thông tin tài khoản trên mobile, ví dụ một account summary có thể mở từ avatar bằng primitive chung. Logout tiếp tục thực hiện trực tiếp theo quyết định đã chốt.

### 4. P3 — Typography shell/header chưa map rõ theo semantic role

- Đính chính nhận xét ban đầu: bảng Typography trong DESIGN.md cho phép secondary body/table body 1.45, helper/error 1.4 và section heading 1.3. Không có bằng chứng token runtime sai chỉ vì khác ba tỷ lệ chính; nhận xét trước đó đã khái quát quá rộng.
- Bằng chứng còn phù hợp: shell/header lặp nhiều size, weight và line-height literal thay vì dùng semantic tokens. Workspace label 13px/600 đang dùng 1.4, trong khi form-label role là 1.35; breadcrumb 13px đang dùng 1.4, trong khi secondary-body role là 1.45. Brand context 12px/1.4 và navigation 13px/1.45 đã phù hợp role helper/secondary body.
- Hệ quả: việc bảo trì typography khó theo dõi role; không cần thay đổi hàng loạt token hoặc các tỷ lệ đang đúng contract.
- Hướng sửa: map shell/header theo bảng role thực tế, ghi rõ mức nhấn medium của navigation và ngoại lệ kích thước brand mark/wordmark. Giữ geometry và các token toàn cục hiện có.

## Những cấu trúc đã có trong source

- Sidebar có chiều cao 100dvh; brand/divider không co; `.sidebar-scroll` có `min-height:0`, `flex:1` và overflow dọc, phù hợp với yêu cầu nhiều menu.
- Header dùng CSS module riêng, cùng max-width 1510px và page-inline padding với nội dung.
- Menu mobile tái sử dụng shared Sheet và có title; link đóng menu; chuyển sang desktop đóng overlay; `finalFocus` trỏ về nút menu. Đây là các cấu hình đã đọc, chưa xác minh focus/scroll-lock ở runtime.
- Link giữ `aria-current`, accessible names và lọc menu theo permission helpers hiện có.
- Logout gọi service hiện có, có ref chống gửi lặp, pending disabled và error toast. Không thực hiện logout trong audit.
- Skip link và global scroll-padding đã tồn tại; không ghi nhận thiếu scroll offset chỉ từ việc target không có scroll-margin.

## Bước triển khai đề xuất

1. Sửa focus sidebar và Tooltip rail trong một lát cắt accessibility nhỏ.
2. Hoàn thiện cách xem thông tin tài khoản trên mobile.
3. Đồng bộ typography shell/header theo token mapping có phạm vi rõ ràng.
4. Người dùng smoke desktop expanded/collapsed, tablet rail, mobile menu, viewport thấp, nội dung dài và bàn phím; ghi kết quả thực tế vào migration ledger.

## Cập nhật triển khai — focus và Tooltip rail

- `.sidebar-link:focus-visible` có outline 3px và offset -3px để viền nằm trong link, không phụ thuộc khoảng trống ngoài vùng cuộn.
- Thêm primitive `components/ui/tooltip.tsx` dựa trên shadcn base-nova/Base UI đang có, và composition `components/admin/admin-sidebar-link.tsx`. Các link sidebar dùng cùng composition; vẫn là Next Link với accessible name, active state và callback điều hướng như trước.
- Tooltip chỉ bật ở tablet rail 701–1180px hoặc desktop >=1181px khi người dùng thu gọn sidebar. Viewport subscription dùng matchMedia, có cleanup; mobile và desktop mở rộng tắt Tooltip. Provider không thêm DOM wrapper làm thay đổi grid/scroll geometry.
- Nội dung Tooltip nằm trong portal, có collision padding, giới hạn chiều rộng viewport và ẩn khi anchor ra khỏi vùng nhìn. Bỏ native title trên các link điều hướng để tránh hai nhãn hover. Focus/hover/Escape do Base UI quản lý.
- GitNexus impact đã disambiguate đúng `SuperAdminLayout` trong feature: CRITICAL, 22 direct dependents, 19 luồng theo index hiện có. Đã đối chiếu diff và các call site link trực tiếp; index cũ vẫn là giới hạn của kết quả graph.
- Không chạy test, browser, TypeScript, ESLint, build hoặc `git diff --check` theo lựa chọn hiện tại. Chưa tuyên bố mục 1/2 PASS runtime.
- Người dùng smoke: desktop thu gọn rồi hover/Tab qua các icon; Escape đóng nhãn; click/Enter vẫn điều hướng. Ở tablet rail cũng phải có nhãn; desktop mở rộng và mobile không bật Tooltip. Cuộn sidebar tới mục cuối ở viewport thấp, kiểm tra toàn bộ viền focus và tooltip không bị cắt. Đổi breakpoint khi Tooltip đang mở để kiểm tra đóng và focus vẫn hợp lệ.

## Cập nhật triển khai — thông tin tài khoản mobile

- Ở viewport <=700px, avatar là nút 44px mở `AdminAccountPopover`. Nội dung có họ tên đầy đủ và role label từ authenticated session hiện có; không gọi API mới hoặc tự suy diễn quyền.
- Composition dùng `ui/popover.tsx` dựa trên shadcn base-nova/Base UI cùng engine với các bộ lọc hiện có. Popup có title/description, nội dung dài xuống dòng và cuộn trong giới hạn viewport; nút Đóng, Escape và outside press dùng cơ chế primitive. Focus return dùng mặc định Base UI.
- Desktop vẫn hiển thị avatar/tên/vai trò như trước. Dùng viewport subscription sẵn có để unmount popover khi ra khỏi mobile, tránh để popup còn mở sau resize. Logout vẫn là action riêng thực hiện trực tiếp.
- Pre-edit impact cho feature `SuperAdminLayout` vẫn là CRITICAL với 22 direct dependents và 19 processes theo index hiện có. Đã review source/diff; không chạy test, browser, lint, typecheck, build hoặc `git diff --check`. Chưa xác minh runtime.
- Người dùng smoke: ở mobile, bấm avatar bên cạnh Đăng xuất để xem tên và vai trò; thử Đóng, Escape, bấm ngoài và mở lại. Kiểm tra Tab/focus return, nội dung tên dài/nhiều vai trò ở viewport thấp, resize sang desktop khi popup đang mở, và menu mobile. Không cần thực hiện logout để review thông tin tài khoản.

Các vấn đề hình học như overflow khi tenant/tên tài khoản rất dài và focus return sau đổi breakpoint vẫn cần quan sát runtime, không được ghi nhận là đã PASS hoặc là bug đã tái hiện. Typography shell/header là lát cắt tiếp theo.
