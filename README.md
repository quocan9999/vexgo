# VexGo

Hệ thống đặt vé xe khách trực tuyến, gồm giao diện dành cho khách hàng, giao diện quản trị và backend API.

> Repository này hiện chỉ là nền tảng monorepo của hệ thống. Các chức năng nghiệp vụ sẽ được triển khai sau khi hoàn tất phân tích nghiệp vụ, class diagram và thiết kế cơ sở dữ liệu.

## Tech stack

### Frontend

- **Next.js** với App Router
- **React** và **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** cho các UI component
- Kiểm thử unit frontend sẽ được cấu hình khi nhóm thống nhất test tooling.

Có hai frontend độc lập:

- `apps/web`: website dành cho khách hàng.
- `apps/admin`: website dành cho nhân viên/quản trị viên.

### Backend

- **NestJS**
- **Node.js**
- **TypeScript**
- REST API
- NestJS mặc định sử dụng Express adapter.

Backend nằm tại `apps/api`. Các module nghiệp vụ, authentication, authorization và API contract sẽ được bổ sung theo thiết kế được nhóm duyệt.

### Database

- **MySQL**
- Prisma có thể được xem xét sau khi class diagram/mô hình quan hệ được thống nhất.

Hiện chưa định nghĩa schema, migration hoặc seed data vì thiết kế cơ sở dữ liệu chưa được cung cấp và phê duyệt.

### Monorepo tooling

- **pnpm workspaces** để quản lý ba app trong monorepo
- **Turborepo** để điều phối các task giữa các app
- **ESLint** cho `web`/`admin`, **Oxlint** cho `api`
- **Prettier** cho code formatting
- **TypeScript** strict mode

### Testing

NestJS scaffold hiện có cấu hình **Vitest** và dependency **Supertest** cho API testing; chưa có test case. Frontend chưa có test runner. Strategy dự kiến:

- **Unit test frontend:** chọn và cấu hình runner khi bắt đầu có component/utility cần kiểm thử.
- **Unit/API test backend:** dùng Vitest/Supertest để kiểm tra module và HTTP request/response khi endpoint được xây dựng.
- **Integration test:** thêm sau khi có schema và môi trường database được thống nhất.
- **End-to-end test:** có thể dùng Playwright để kiểm tra luồng người dùng khi các chức năng được triển khai.

Hiện chưa có test case hay test nghiệp vụ. Chạy test runner API (hiện không có test nên chỉ kiểm tra cấu hình):

```bash
pnpm --filter @vexgo/api test
```

## Repository structure

```text
apps/
  web/                         # Customer web application
  admin/                       # Admin web application
  api/                         # NestJS backend API

docs/
  De-Cuong-Chi-Tiet.md         # Đề cương chi tiết khoá luận
```

Ứng dụng mobile không nằm trong repository này. Mobile sẽ được phát triển trong repository riêng và giao tiếp với backend thông qua API.

## Development prerequisites

- Node.js LTS
- pnpm
- Docker Desktop (khi cần chạy MySQL local)
- Git

## Install dependencies

```bash
pnpm install
```

## Available commands

```bash
# Chạy các app ở development mode
pnpm dev

# Kiểm tra lint
pnpm lint

# Kiểm tra TypeScript
pnpm typecheck

# Build các workspace package/app
pnpm build

# Kiểm tra formatting
pnpm format:check

# Chạy test runner API (chưa có test case)
pnpm --filter @vexgo/api test
```

Frontend test commands sẽ được thêm khi nhóm chọn runner; hiện chưa có test script hay test case cho web/admin.

## Scope hiện tại

Nền tảng hiện tập trung vào việc khởi tạo và chuẩn hóa monorepo, chưa bao gồm:

- Thiết kế hoặc triển khai database schema.
- Migration và seed data.
- Đăng nhập, JWT hoặc phân quyền RBAC.
- Đặt vé, hủy vé, thanh toán và mã khuyến mãi.
- Chat realtime, gửi hàng hóa và tích hợp payment provider.
- MySQL Docker Compose hoặc cấu hình database local.
- API endpoint, authentication hoặc authorization.
- Test case nghiệp vụ, CI/CD hoặc triển khai production.

> Các quyết định về dữ liệu và chức năng sẽ được bổ sung sau khi nhóm hoàn thiện tài liệu phân tích, class diagram và mô hình dữ liệu.
