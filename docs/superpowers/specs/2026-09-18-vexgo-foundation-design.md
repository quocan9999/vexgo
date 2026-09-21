# VexGo — Thiết kế nền tảng monorepo

**Ngày:** 2026-09-18  
**Trạng thái:** Đã duyệt thiết kế, chưa triển khai

## 1. Phạm vi

Thiết lập nền tảng cho hệ thống đặt vé xe khách VexGo dưới dạng một monorepo gồm ba ứng dụng:

- `apps/web`: trang web dành cho khách hàng.
- `apps/admin`: trang quản trị hệ thống.
- `apps/api`: backend REST API.

Ứng dụng di động không thuộc monorepo này. Ứng dụng đó sẽ là một repository độc lập và sử dụng API công khai từ `apps/api` trong tương lai.

Giai đoạn này chỉ tạo khung dự án, cấu hình phát triển, cơ sở dữ liệu local, kiểm tra chất lượng và CI. Không xây dựng nghiệp vụ đặt vé, thanh toán, chat, vận chuyển hàng hóa hay giao diện tính năng.

## 2. Kiến trúc và cấu trúc thư mục

Sử dụng `pnpm workspace` để quản lý dependencies và Turborepo để điều phối, cache các tác vụ `lint`, `format`, `typecheck`, `test` và `build`.

```text
vexgo/
  apps/
    web/                 # Next.js customer application
    admin/               # Next.js administration application
    api/                 # NestJS REST API
  packages/
    ui/                  # shadcn/ui primitives và presentation components dùng chung
    config/              # cấu hình dùng chung: TypeScript, ESLint, Prettier, Tailwind
    types/               # enum, pagination và response types dùng chung
  infra/
    docker/              # Docker Compose cho MySQL local
  docs/
  .github/workflows/
```

`web` và `admin` là hai Next.js App Router application độc lập: có route, middleware, bundle và pipeline deploy riêng. Cả hai gọi API bằng biến môi trường `NEXT_PUBLIC_API_URL` và không truy cập trực tiếp MySQL.

`api` là NestJS REST API duy nhất sở hữu nghiệp vụ, xác thực và persistence. API dùng prefix `/api/v1`; Swagger/OpenAPI chỉ mở mặc định ở môi trường development.

`packages/ui` chỉ giữ component hiển thị tái sử dụng thực tế. Nó không chứa page, feature hoặc nghiệp vụ thuộc riêng web/admin. `packages/types` không chứa DTO thực thi hoặc business logic của backend, giúp tránh coupling giữa frontend và API.

## 3. Dữ liệu và cấu hình

MySQL chạy local qua Docker Compose tại `infra/docker`. Prisma được đặt trong `apps/api`, là chủ sở hữu `schema`, migration và seed data phục vụ môi trường demo.

Mỗi application có `.env.example` không chứa secret. API kiểm tra biến môi trường khi khởi động, tối thiểu gồm thông tin database, các origin CORS, JWT secret và port. Không commit `.env` hay dữ liệu nhạy cảm.

Luồng dữ liệu chuẩn:

```text
web/admin/mobile (repository riêng) -> API /api/v1 -> MySQL
```

Mobile sẽ chỉ phụ thuộc hợp đồng OpenAPI/API, không import mã nguồn hay package nội bộ của monorepo.

## 4. Bảo mật và API baseline

API chuẩn bị cơ chế access token ngắn hạn và refresh token an toàn. Các role nền gồm `CUSTOMER`, `STAFF` và `ADMIN`. Backend cung cấp guard/decorator để bảo vệ route; trang admin chỉ truy cập được với role phù hợp. Chi tiết UI quản lý quyền và các permission cụ thể nằm ngoài giai đoạn nền.

Mọi endpoint áp dụng validation trước khi chạy nghiệp vụ. Response lỗi thống nhất, có error code, message và request ID để truy vết. CORS lấy danh sách origin từ environment và chỉ cấp quyền cho web/admin hợp lệ. Rate limiting nền được đặt cho endpoint public và authentication.

Chưa tích hợp provider thật cho MoMo, VNPAY, ZaloPay, chat realtime, email, object storage hay bên thứ ba khác. Khi triển khai chức năng, mỗi tích hợp sẽ nằm trong module/interface riêng của API.

## 5. Chất lượng, test và CI

Root scripts gọi qua Turbo:

- `lint`: kiểm tra style và lỗi tĩnh.
- `format`: kiểm tra/chuẩn hóa Prettier.
- `typecheck`: kiểm tra TypeScript.
- `test`: test unit cho những phần đã có logic.
- `build`: build độc lập cho từng app/package.

API dùng Jest. Hai frontend có nền unit test; Playwright chỉ bắt đầu với smoke test khi các màn hình đầu tiên được xây dựng. Husky và lint-staged chạy kiểm tra nhanh trước commit.

GitHub Actions chạy lint, format check, typecheck, test và build trên pull request. CI chưa tự động deploy và không yêu cầu credential dịch vụ ngoài.

## 6. Tiêu chí hoàn thành setup nền

- Có thể cài dependencies từ root bằng pnpm và chạy ba app bằng Turbo.
- MySQL local khởi động được bằng Docker Compose; Prisma migration và seed chạy từ API.
- Cả web và admin build, typecheck và gọi được API health endpoint qua cấu hình environment.
- Swagger/OpenAPI khả dụng trong development; validation, error format, CORS, rate limiting và RBAC skeleton tồn tại trong API.
- Các tác vụ kiểm tra và GitHub Actions hoạt động mà không cần secret bên ngoài.
- Không có module nghiệp vụ của đặt vé, thanh toán, chat, hàng hóa hay mobile trong baseline.
