# VexGo — Thiết kế chuyển toàn bộ giao diện Customer Web

**Ngày:** 2026-09-29  
**Trạng thái:** Đã duyệt thiết kế trong hội thoại, chờ duyệt đặc tả

## 1. Mục tiêu

Chuyển toàn bộ trải nghiệm giao diện hiện có trong `apps/frontend` sang `apps/web` để khi chạy Customer Web tại `http://localhost:3000`, người dùng nhìn thấy và thao tác được với cùng các trang, layout, responsive behavior và trạng thái UI của bản `apps/frontend`.

`apps/web` tiếp tục là Customer Web chính thức của monorepo. Việc chuyển giao diện không được đưa cấu trúc song song của `apps/frontend` vào app chính, không tạo backend riêng và không thay đổi ranh giới `Customer UI -> frontend service/API layer -> NestJS API` của dự án.

Sau khi hoàn tất, `apps/web` phải độc lập hoàn toàn với `apps/frontend`. Thư mục `apps/frontend` chỉ đóng vai trò nguồn tham chiếu trong thời gian migration và có thể được người dùng xóa mà không ảnh hưởng đến cài đặt, lint, typecheck, test, build hoặc runtime của `apps/web`.

## 2. Phạm vi trang và hành vi

Migration bao phủ toàn bộ route hiện có của `apps/frontend`:

- trang chủ;
- đăng nhập và đăng ký;
- giới thiệu, liên hệ và quyên góp;
- danh sách bài đăng/nhu cầu, chi tiết bài đăng và tạo bài đăng;
- chọn chuyến, chọn ghế một chiều/khứ hồi và khai báo hành lý;
- trang cá nhân và đổi mật khẩu;
- bài đăng của tôi;
- khách hàng thân thiết;
- tra cứu và hủy vé;
- hóa đơn và thanh toán;
- gửi hàng;
- navbar, footer, chatbot, modal, toast và các trạng thái tương tác liên quan.

Các URL mà giao diện nguồn đang liên kết tới phải tiếp tục hoạt động sau migration. Các route nghiệp vụ hiện có của `apps/web` như `/trips`, `/booking`, `/tickets`, `/shipments` và `/payments` được giữ lại để tránh làm hỏng luồng đang có. Khi hai route thể hiện cùng một màn hình, chúng có thể dùng chung feature component hoặc một route có thể chuyển hướng rõ ràng sang route chuẩn; không copy nguyên JSX thành hai bản.

## 3. Kiến trúc đích

Không copy nguyên cây `apps/frontend/app`, `apps/frontend/src/modules` hoặc `apps/frontend/src/context` vào `apps/web`. Code được phân loại lại theo cấu trúc hiện có của Customer Web:

```text
apps/web/
  src/
    app/                         # route entry points mỏng
      (public)/
      (auth)/
      (account)/
      (booking)/
    components/
      layout/                    # customer shell, header, footer, support/chat
      ui/                        # reusable presentation primitives
    features/
      home/
      auth/
      posts/
      booking/
      profile/
      tickets/
      payments/
      shipments/
      loyalty/
      donation/
    lib/                         # helper dùng chung, không chứa business rule backend
    mocks/                       # dữ liệu UI tạm thời
    types/                       # kiểu Customer Web dùng chung
  public/
    images/
```

Route page chỉ đọc params/search params, chọn feature component phù hợp và render. Component giữ render, state UI và interaction. Logic thuần như dựng URL đặt chuyến khứ hồi được đặt trong utility có test. Dữ liệu theo feature phải đi qua service/hook boundary nếu cần truy cập bất đồng bộ, để sau này thay mock bằng `/api/v1` mà không viết lại page hoặc presentation component.

## 4. Chiến lược tái sử dụng và chuyển UI

`apps/frontend` là nguồn sự thật tạm thời cho visual appearance và interaction trong migration. Mỗi màn hình được đối chiếu với component hiện có của `apps/web` trước khi tạo mới:

- mở rộng `CustomerShell`, header, footer và support widget hiện tại để đạt giao diện nguồn;
- mở rộng primitive hiện có như button, input và badge khi use case tương đương;
- chỉ thêm modal, pagination, tabs, select hoặc breadcrumb khi `apps/web` chưa có primitive phù hợp;
- hợp nhất các component trùng chức năng, không giữ đồng thời hai bộ header/footer/button;
- chuyển asset thật sự được dùng; không chuyển file mặc định của `create-next-app` hoặc asset chết;
- giữ tên VexGo trong metadata và nội dung thương hiệu, không mang metadata `BusWay` sang app chính.

CSS toàn cục của hai app được hợp nhất có chủ đích vào `apps/web/src/app/globals.css`. Token màu, typography và utility class của giao diện nguồn được giữ khi cần cho visual parity, nhưng không ghi đè mù quáng các token đang được component hiện hữu sử dụng. Responsive behavior phải được kiểm tra ít nhất tại desktop `1440x900` và mobile `375x667`.

## 5. State, mock data và chuẩn bị nối backend

Migration này là UI migration, không triển khai backend mới và không coi mock là nguồn dữ liệu hoàn chỉnh.

- Tái sử dụng một session abstraction duy nhất trong `apps/web`; không mang thêm Zustand store chỉ để duy trì mock login song song với `DemoSessionProvider`.
- Auth demo phải đủ để navbar, profile và logout hoạt động trong giai đoạn UI, nhưng được cô lập để thay bằng auth API sau này.
- Mock posts, trips, seats, tickets và shipment được đặt đúng feature hoặc `src/mocks`; component không import dữ liệu từ `apps/frontend`.
- Không copy `axiosClient` và `API_ROUTES` chưa được sử dụng từ app nguồn. Khi nối backend, feature service của `apps/web` sẽ gọi API dùng prefix `/api/v1` và envelope `{ data, meta }` theo quy ước repository.
- Business rule như ghế còn trống, giá, khuyến mãi và quyền thao tác không được xem là đúng chỉ vì UI mock hiển thị; backend vẫn là nguồn sự thật khi flow full-stack được triển khai.

## 6. Version và dependencies

Không hạ version của `apps/web` theo app nguồn:

- giữ `next` và `eslint-config-next` ở `16.3.5`;
- giữ `react` và `react-dom` ở `19.2.8`;
- giữ Tailwind CSS 4;
- giữ phiên bản `lucide-react` hiện tại của `apps/web` vì mới hơn app nguồn;
- không chạy codemod cho chênh lệch patch `16.3.4 -> 16.3.5`.

Chỉ thêm dependency khi một hành vi được giữ lại thực sự cần nó và không có abstraction tương đương trong `apps/web`. Các package có trong manifest của `apps/frontend` nhưng không được source import, hoặc chỉ phục vụ cấu trúc bị loại bỏ, không được mang sang. Mọi thay đổi dependency phải cập nhật root `package-lock.json` và không để lại peer dependency conflict.

## 7. Kiểm thử và xác minh

Migration được thực hiện theo từng lát dọc có thể kiểm tra:

1. layout, token và shared UI;
2. public/home/content pages;
3. auth và account pages;
4. posts, trip detail, seat selection và luggage;
5. tickets, payment, invoice và shipment;
6. route compatibility và dọn dependency/asset thừa.

Các utility có behavior được chuyển cùng unit test. Các UI regression test hiện có cho chọn ghế và khứ hồi được chuyển hoặc thay bằng test tương đương chạy trên `apps/web`. Route smoke test phải xác minh các URL trong phạm vi trả response thành công và render marker đặc trưng của màn hình.

Trước khi kết luận hoàn tất phải chạy tối thiểu:

- test của `apps/web`;
- `npm run lint -w @vexgo/web`;
- `npm run typecheck -w @vexgo/web`;
- `npm run build -w @vexgo/web`;
- kiểm tra visual desktop và mobile cho các màn hình đại diện và mọi interaction quan trọng;
- tìm kiếm toàn repository để xác nhận `apps/web` không import hoặc đọc file từ `apps/frontend`.

## 8. Xử lý lỗi và trạng thái UI

Mỗi màn hình tương tác phải giữ đủ trạng thái liên quan từ giao diện nguồn: loading, disabled, validation feedback, empty state, success và error nếu use case có các trạng thái đó. Timer mock chỉ được giữ trong adapter/demo layer, không trộn vào business service tương lai.

Navigation không được dẫn tới route 404. Modal/dialog cần title truy cập được, icon-only button có `aria-label`, form có label và keyboard behavior phù hợp. Các animation không thiết yếu phải tôn trọng `prefers-reduced-motion` khi được chuyển hoặc bổ sung.

## 9. Tiêu chí hoàn thành

- Toàn bộ route và giao diện trong phạm vi `apps/frontend` có bản tương ứng hoạt động trong `apps/web`.
- `apps/web` giữ cấu trúc `src/app`, `src/features`, `src/components`, `src/lib`, `src/mocks` và `src/types`; không có cây `src/modules` song song.
- Không có import, symlink, runtime read hoặc workspace dependency từ `apps/web` tới `apps/frontend`.
- Version nền của `apps/web` không bị hạ và package lock phản ánh chính xác dependency cần dùng.
- Navigation chính không có liên kết chết; auth demo, profile, posts, chọn ghế, thanh toán demo và gửi hàng có thể thao tác theo giao diện nguồn.
- Test, lint, typecheck và build của `apps/web` vượt qua.
- Visual desktop/mobile được đối chiếu với `apps/frontend` cho các màn hình đại diện.
- Sau khi người dùng xóa `apps/frontend`, lệnh cài đặt và các tác vụ của monorepo không còn tham chiếu workspace đó và `apps/web` vẫn chạy độc lập.

## 10. Ngoài phạm vi

- Xóa `apps/frontend` trong migration này; người dùng sẽ xóa sau khi xác minh.
- Kết nối toàn bộ UI với NestJS/Prisma/MySQL.
- Thay đổi API contract hoặc business rule backend.
- Thiết kế lại giao diện khác với bản `apps/frontend`.
- Refactor `apps/admin` hoặc `apps/api` không liên quan đến việc giữ contract Customer Web.
