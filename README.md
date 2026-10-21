# VexGo

VexGo là nền tảng đặt vé xe khách trực tuyến tích hợp nhiều nhà xe.

## Mô tả

VexGo hướng tới việc số hóa quy trình tìm kiếm chuyến xe, đặt vé và quản lý vận hành nhà xe trên một nền tảng thống nhất. Hệ thống được định hướng phục vụ hai nhóm người dùng chính:

- **Khách hàng:** tìm kiếm chuyến xe, đặt và quản lý vé, thanh toán và sử dụng các dịch vụ liên quan.
- **Quản trị viên và nhà xe:** quản lý người dùng, nhà xe, xe, tuyến, chuyến, vé và theo dõi số liệu vận hành.

Repository hiện bao gồm customer web, admin web và backend API trong cùng một workspace.

## Tech Stack

| Hạng mục            | Công nghệ                                        |
| ------------------- | ------------------------------------------------ |
| Frontend khách hàng | Next.js 16, React 19, TypeScript                 |
| Frontend quản trị   | Next.js 16, React 19, TypeScript                 |
| UI và styling       | Tailwind CSS 4, shadcn/ui, Lucide React          |
| Backend             | NestJS 12, Node.js, TypeScript, Express adapter  |
| API                 | REST API                                         |
| Mobile              | Flutter                                          |
| Database            | MySQL 8.4                                        |
| Monorepo            | npm workspaces, Turborepo                        |
| Code quality        | ESLint, Oxlint, Prettier, TypeScript strict mode |
| Testing             | Vitest, Supertest                                |

## Core Features

### Customer

- Tìm kiếm chuyến xe theo tuyến, ngày khởi hành và nhà xe; xem thông tin chuyến.
- Chọn chỗ, đặt vé, thanh toán trực tuyến và áp dụng mã khuyến mãi.
- Tra cứu, xem và quản lý vé; hủy vé theo điều kiện áp dụng.
- Gửi hàng hóa và theo dõi trạng thái vận chuyển.
- Chat realtime với bộ phận hỗ trợ.
- Sử dụng giao diện tiếng Việt và tiếng Anh.

### Admin

- Quản lý nhà xe, xe, tuyến đường, lịch chạy, chuyến xe và sơ đồ ghế.
- Quản lý vé, đơn đặt vé, khách hàng, nhân viên và tài khoản nhà xe.
- Quản lý bảng giá, mã khuyến mãi và chương trình ưu đãi.
- Quản lý đơn gửi hàng và trạng thái vận chuyển.
- Theo dõi thanh toán, doanh thu và báo cáo theo thời gian.
- Quản lý vai trò, quyền truy cập và yêu cầu hỗ trợ khách hàng.

### Mobile App

- Tìm chuyến, chọn chỗ và đặt vé ngay trên điện thoại.
- Thanh toán, lưu vé điện tử và tra cứu lịch sử đặt vé.
- Tạo đơn gửi hàng và theo dõi trạng thái vận chuyển.
- Nhận thông tin chuyến đi và trao đổi với bộ phận hỗ trợ.
- Sử dụng ứng dụng bằng tiếng Việt hoặc tiếng Anh.

## Getting Started

### Yêu cầu môi trường

- Node.js LTS
- npm
- Docker Desktop và Docker Compose
- Git

### 1. Cài đặt project

```bash
git clone <repository-url>
cd vexgo

npm install
```

Tạo file biến môi trường local từ file mẫu:

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Tạo file môi trường cho từng ứng dụng Next.js:

PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/admin/.env.example apps/admin/.env.local
```

macOS/Linux:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Trước khi khởi động API, hãy thay hai giá trị mẫu `OTP_HASH_SECRET` và
`JWT_ACCESS_SECRET` trong `.env` bằng hai secret ngẫu nhiên riêng biệt, mỗi
secret dài ít nhất 32 ký tự. Tạo từng giá trị bằng lệnh sau và chạy lệnh hai
lần:

```bash
node --input-type=commonjs -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Chỉ lưu các giá trị này trong `.env`; không dùng chung một secret và không
commit file `.env` hoặc `.env.local`.

Trước khi chạy, hãy thay `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `DATABASE_URL`,
`MIGRATION_URL` và `SHADOW_DATABASE_URL` theo cùng database; URL shadow phải dùng
database riêng. Thay `OTP_HASH_SECRET`, `JWT_ACCESS_SECRET` bằng secret ngẫu
nhiên riêng, đồng thời đặt `SEPAY_WEBHOOK_TOKEN` nếu dùng webhook SePay. Trong
`apps/web/.env.local`, điền `NEXT_PUBLIC_SEPAY_BANK_ID`,
`NEXT_PUBLIC_SEPAY_ACCOUNT_NUMBER` và `NEXT_PUBLIC_SEPAY_ACCOUNT_NAME` bằng
thông tin tài khoản nhận tiền thật do dự án cung cấp. Khi chưa có đủ ba giá trị,
Customer Web sẽ không hiển thị mã VietQR. `SEPAY_WEBHOOK_TOKEN` chỉ nằm trong
`.env` backend; không tạo biến `NEXT_PUBLIC_` cho token này.

`NEXT_PUBLIC_API_URL` của Customer Web dùng URL có hậu tố `/api/v1`; Admin Web
dùng địa chỉ gốc vì service Admin tự thêm `/api/v1`. `VEXGO_API_URL` của Customer
Web cũng cần kết thúc bằng `/api/v1`. Script chạy Next.js nạp `PORT` từ
`.env.local` trước khi khởi động server.

> File `.env` chỉ dùng cho môi trường local. Không sử dụng các thông tin đăng nhập mẫu cho production.

### 2. Khởi động Docker services

Khởi động MySQL và phpMyAdmin:

```bash
docker compose up -d
docker compose ps
```

Các địa chỉ mặc định:

- MySQL: `127.0.0.1:3306`
- phpMyAdmin: <http://localhost:8080> (đổi cổng bằng `PHPMYADMIN_PORT`)

Khi đăng nhập phpMyAdmin, dùng `mysql` làm database host và thông tin tài khoản được cấu hình trong file `.env`.

Xem log hoặc dừng services:

```bash
docker compose logs -f mysql
docker compose down
```

`mysql_data` là named volume nên dữ liệu vẫn được giữ lại sau `docker compose down`. Chỉ dùng lệnh sau khi muốn xóa toàn bộ dữ liệu MySQL local:

```bash
docker compose down --volumes
```

### 3. Chạy frontend và backend

Mỗi lệnh dưới đây nên được chạy trong một terminal riêng, từ thư mục gốc của repository.

Customer Web — địa chỉ theo `PORT` trong `apps/web/.env.local` (mẫu mặc định `3000`):

```bash
npm run dev --workspace=@vexgo/web
```

Admin Web — địa chỉ theo `PORT` trong `apps/admin/.env.local` (mẫu mặc định `3001`):

```bash
npm run dev --workspace=@vexgo/admin
```

Backend API — địa chỉ theo `PORT` trong `.env` (mẫu mặc định `4000`):

```bash
npm run start:dev --workspace=@vexgo/api
```

Có thể chạy đồng thời hai frontend bằng:

```bash
npm run dev
```

Hiện tại backend chưa có script `dev` ở cấp workspace nên cần khởi động bằng lệnh `start:dev` riêng.

Với worktree PR #36 hiện tại, các file local được cấu hình Customer Web `3004`,
Admin Web `3005`, API `4002`, MySQL `3306`, database `vexgo_pr36` và phpMyAdmin
`9090`. Các giá trị này nằm trong file môi trường bị Git ignore. Khi tạo worktree
khác, hãy chọn database riêng và đổi `PORT`/origin CORS tương ứng trong file local;
không chép các port của worktree này vào file mẫu dùng chung.

### 4. Các lệnh thường dùng

```bash
# Chạy frontend ở chế độ development
npm run dev

# Kiểm tra lint toàn workspace
npm run lint

# Kiểm tra TypeScript
npm run typecheck

# Build toàn bộ workspace
npm run build

# Kiểm tra format
npm run format:check

# Chạy test API
npm run test --workspace=@vexgo/api
```

## Project Structure

Cấu trúc dưới đây phản ánh trạng thái hiện tại và sẽ được cập nhật khi các module nghiệp vụ được bổ sung:

```text
vexgo/
├── apps/
│   ├── web/                 # Customer web application
│   ├── admin/               # Admin web application
│   └── api/                 # NestJS backend API
├── docs/                    # Tài liệu phân tích, thiết kế và kế hoạch
├── compose.yaml             # MySQL và phpMyAdmin cho local development
├── .env.example             # Mẫu biến môi trường API và database
├── apps/web/.env.example    # Mẫu Customer Web
├── apps/admin/.env.example  # Mẫu Admin Web
├── package.json             # Scripts và cấu hình workspace root
├── package-lock.json        # Khóa phiên bản dependency của npm
├── turbo.json               # Cấu hình Turborepo
└── README.md
```

## Contributors

- Trình Quốc An
- Lê Sony
- Phạm Minh Tài

## License

Project hiện được cấu hình là **UNLICENSED** và chưa phát hành theo một giấy phép mã nguồn mở. Đây là repository phục vụ mục đích học thuật/phát triển nội bộ; việc sao chép, phân phối hoặc sử dụng lại cần có sự đồng ý của nhóm tác giả.
