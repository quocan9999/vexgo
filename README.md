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

> File `.env` chỉ dùng cho môi trường local. Không sử dụng các thông tin đăng nhập mẫu cho production.

### 2. Khởi động Docker services

Khởi động MySQL và phpMyAdmin:

```bash
docker compose up -d
docker compose ps
```

Các địa chỉ mặc định:

- MySQL: `127.0.0.1:3306`
- phpMyAdmin: <http://localhost:8080>

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

Customer web — <http://localhost:3000>:

```bash
npm run dev --workspace=@vexgo/web
```

Admin web — <http://localhost:3001>:

```bash
npm run dev --workspace=@vexgo/admin
```

Backend API — <http://localhost:4000>:

```bash
npm run start:dev --workspace=@vexgo/api
```

Có thể chạy đồng thời hai frontend bằng:

```bash
npm run dev
```

Hiện tại backend chưa có script `dev` ở cấp workspace nên cần khởi động bằng lệnh `start:dev` riêng.

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
├── .env.example             # Mẫu biến môi trường
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
