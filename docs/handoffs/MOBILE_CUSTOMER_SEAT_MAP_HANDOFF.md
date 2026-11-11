# Handoff: sơ đồ ghế trên Customer Mobile

## Trạng thái

- **Trạng thái:** Sẵn sàng nhận triển khai.
- **Phạm vi:** Chỉ cập nhật giao diện chọn ghế trên ứng dụng Customer Mobile; không thay đổi API hoặc các màn hình khác.
- **Branch chứa thay đổi API và sơ đồ ghế:** `feature/admin-seat-layout-editor`.
- **Lưu ý repo:** Hiện repo này không có thư mục ứng dụng mobile. Handoff này mô tả contract và yêu cầu để người phụ trách mobile áp dụng trong repo mobile tương ứng.

## Mục tiêu

Hiển thị sơ đồ ghế của đúng chuyến xe theo cấu hình riêng của xe đó. Các xe cùng loại có thể có số ghế, số cột, tọa độ và số tầng khác nhau; giao diện không được suy ra sơ đồ từ loại xe hoặc một layout mẫu cố định.

## Quy tắc giao diện và nghiệp vụ

- Dùng dữ liệu `floor`, `x`, `y` của từng ghế để bố trí theo mặt bằng 2D. Không dựng hàng/cột bằng cách chia số ghế hoặc sắp mã ghế rồi lấp vào lưới cố định.
- `floor: 1` là tầng dưới, `floor: 2` là tầng trên. Chỉ hiện tầng có ghế trong response; dùng cách chuyển tầng phù hợp với component và design system hiện có trên mobile.
- Không hiện nhãn “Dãy trái”/“Dãy phải” và không vẽ một dải lối đi riêng. Khoảng trống giữa các ghế được thể hiện bằng chênh lệch tọa độ `x` đã cấu hình.
- Giữ ghế trên cùng hàng thẳng theo `y`, ghế trên cùng cột thẳng theo `x`. Thứ tự mã ghế không quyết định vị trí trực quan.
- Giữ phong cách, màu sắc, icon và component sẵn có của ứng dụng mobile. Chỉ thay cách bố trí ghế, chuyển tầng và ánh xạ trạng thái cần thiết; không thiết kế lại các phần khác của màn hình.
- Nếu mobile đang hiển thị hướng xe, tài xế hoặc cửa lên thì giữ theo giao diện hiện tại; API ghế không định nghĩa tọa độ cho các thành phần này.

## API hiện có

Gọi endpoint Customer hiện đang được Customer Web sử dụng:

```http
GET /api/v1/trips/{tripId}/seats
```

Client Customer Web hiện đọc danh sách trong `data`. Mỗi ghế có contract như sau:

```ts
type CustomerTripSeat = {
  tripSeatId: number;
  seatNumber: string;
  position: string | null;
  floor: number;
  x: number | null;
  y: number | null;
  status: 'TRONG' | 'DANG_GIU' | 'DA_DAT';
  price?: number;
};
```

Ví dụ response:

```json
{
  "data": [
    {
      "tripSeatId": 501,
      "seatNumber": "A01",
      "position": null,
      "floor": 1,
      "x": 180,
      "y": 1000,
      "status": "TRONG",
      "price": 250000
    }
  ]
}
```

- `floor` được backend trả về; với dữ liệu cũ chưa có tầng, backend suy ra từ vị trí hoặc tiền tố mã ghế.
- `x` và `y` có thể `null` với ghế cũ chưa được căn chỉnh. Không ghi tọa độ fallback trở lại API.
- `x` dùng thang tọa độ ngang 0–1000; chuẩn hóa theo chiều rộng vùng sơ đồ, ví dụ `left = x / 1000 * boardWidth`.
- `y` là tọa độ dọc lưu theo đơn vị của sơ đồ. Các hàng mặc định cách nhau khoảng 1000 đơn vị; Customer Web hiện đổi 1000 đơn vị thành 64 px ở canvas rộng 460 px. Mobile có thể đổi sang dp hoặc tỉ lệ riêng nhưng phải giữ tương quan và alignment của tọa độ, không ép thành số hàng cố định.
- Không thay đổi thứ tự/số ghế dựa trên cách hiển thị. `seatNumber` là mã nghiệp vụ; `x/y/floor` là dữ liệu bố cục.

Endpoint sơ đồ ghế chuyến dành cho Admin là `GET /api/v1/trips/:id/seat-inventory`; mobile không dùng endpoint này.

## Ánh xạ trạng thái

| API status | Hiển thị | Có thể chọn |
| --- | --- | --- |
| `TRONG` | Còn trống | Có |
| `DANG_GIU` | Đang được giữ | Không |
| `DA_DAT` | Đã đặt/đã bán theo nhãn hiện có của app | Không |
| Ghế được người dùng mobile chọn | Đang chọn (state cục bộ của màn hình) | Có thể bỏ chọn |

`Đang chọn` là state tương tác cục bộ, không thay thế trạng thái API. Không coi mọi ghế `DANG_GIU` là `DA_DAT`; giữ nhãn riêng nếu UI hiện có hỗ trợ.

## Tham khảo source trong repo VexGo

- API Customer: `apps/api/src/trips/trips.controller.ts` (`GET :id/seats`).
- Mapping response `floor/x/y/status`: `apps/api/src/trips/trips.service.ts` (`getCustomerSeats`).
- Kiểu dữ liệu và client Customer Web: `apps/web/src/features/trips/services/trips.api.ts` (`ApiTripSeat`, `getTripSeats`).
- Utility gom tầng và chuyển tọa độ dùng cho Customer Web: `apps/web/src/features/booking/utils/seat-layout.ts`.
- Sơ đồ Customer Web làm ví dụ contract, không phải yêu cầu chép style: `apps/web/src/features/booking/components/seat-map.tsx`.

## Tiêu chí hoàn thành

- Xe một tầng và hai tầng đều lấy đúng số ghế và tầng từ API.
- Layout khác nhau của xe cùng loại vẫn hiển thị theo tọa độ từng ghế; khoảng trống giữa các cột được giữ nguyên tương quan.
- Ghế thẳng hàng theo `x/y`; không xuất hiện dãy trái/phải hoặc vạch lối đi được hard-code.
- Trạng thái `TRONG`, `DANG_GIU`, `DA_DAT` và state chọn ghế của người dùng được phân biệt, có nhãn/icon hoặc accessibility label theo convention của app.
- Layout vẫn dùng được trên kích thước màn hình mobile; mọi thay đổi ngoài sơ đồ ghế giữ nguyên giao diện hiện có.
- Kiểm tra tối thiểu một chuyến 1 tầng, một chuyến 2 tầng có số cột khác nhau giữa hai tầng, và một chuyến có cả ghế trống/đang giữ/đã đặt.
