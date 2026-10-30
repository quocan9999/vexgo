# Dữ liệu Crawled: Bến xe, Văn phòng, Bưu cục & Điểm đón/trả VexGo

Bộ dữ liệu này được thu thập tự động qua script crawler (`scripts/crawler/crawl-bus-locations.mjs`) phục vụ cho các nghiệp vụ:
1. **Đặt vé trực tuyến**: Chọn điểm đón / điểm trả khách cho tuyến xe và chuyến xe (`DiemDonTra` & `DiemDonTraChuyenXe`).
2. **Ký gửi hàng hóa / Chuyển phát**: Chọn bưu cục, văn phòng giao dịch nhận / gửi hàng của các nhà xe (`DiemGiaoNhanHang`).

---

## 📁 Danh sách tệp dữ liệu

### 1. `crawled-stations-offices.json` (465 điểm)
Danh mục bến xe, văn phòng đại diện và bưu cục cố định theo từng nhà xe trên toàn quốc.
- **Phương Trang (FUTA)**: 172 điểm
- **Thành Bưởi (TB)**: 23 điểm
- **Hoa Mai (HM)**: 13 điểm
- **Điền Linh Limousine (DL)**: 57 điểm
- **Sao Việt (SV)**: 29 điểm
- **Hà Lan (HL)**: 24 điểm
- **Liên Hưng (LH)**: 21 điểm
- **Tân Niên (TN)**: 18 điểm
- **Hải Âu (HA)**: 17 điểm
- **Tiến Oanh (TO)**: 15 điểm
- **Cúc Tùng (CT)**: 14 điểm
- **Phong Phú (PP)**: 12 điểm
- **Hạnh Cafe (HC)**: 12 điểm
- **Thuận Tiến (TT)**: 10 điểm
- **Trọng Minh (TM)**: 10 điểm
- **Long Vân Limousine (LV)**: 9 điểm
- **Tư Tiến (TUT)**: 8 điểm
- **Toàn Thắng (TTH)**: 1 điểm

**Cấu trúc mỗi điểm:**
```json
{
  "id": "45692",
  "maDiem": "TB-VP-LE-HONG-PHONG-45692",
  "tenDiem": "VP Lê Hồng Phong",
  "loaiDiem": "VAN_PHONG", // BEN_XE | VAN_PHONG | TRAM_DUNG | DIEM_DON_TRA
  "diaChi": "266-268 Lê Hồng Phong, Phường Chợ Quán, TP Hồ Chí Minh",
  "quanHuyen": "Quận 5",
  "tinhThanh": "Hồ Chí Minh",
  "soDienThoai": "1900 6079",
  "soDienThoaiGuiHang": "1900 6079", // Bưu cục nhận ký gửi hàng hóa
  "choDatVe": true,
  "choGuiHang": true,
  "nhaXeCode": "TB",
  "nhaXeName": "Thành Bưởi",
  "nguon": "VEXERE_OPERATOR_PAGE"
}
```

---

### 2. `crawled-route-points.json` (1.598 điểm)
Danh mục điểm đón và điểm trả dọc lộ trình của các tuyến xe thực tế, có tọa độ GPS chi tiết (`viDo`, `kinhDo`) và mốc thời gian chênh lệch so với giờ xuất bến:
- Tuyến Sài Gòn ⇄ Cần Thơ / Tiền Giang
- Tuyến Sài Gòn ⇄ Đà Lạt
- Tuyến Sài Gòn ⇄ Vũng Tàu
- Tuyến Sài Gòn ⇄ Nha Trang
- Tuyến Sài Gòn ⇄ Buôn Ma Thuột
- Tuyến Hà Nội ⇄ Sa Pa
- Tuyến Hà Nội ⇄ Hải Phòng
- Tuyến Đà Nẵng ⇄ Quy Nhơn

**Cấu trúc mỗi điểm:**
```json
{
  "tenDiem": "189 Đào Duy Từ, Quận 10",
  "loaiDiem": "DIEM_DON_TRA",
  "vaiTroMacDinh": "DIEM_DON", // DIEM_DON | DIEM_TRA
  "diaChi": "189 Đào Duy Từ, Quận 10",
  "phuongXa": "Diên Hồng",
  "quanHuyen": "Quận 10",
  "tinhThanh": "Hồ Chí Minh",
  "viDo": 10.7598877,
  "kinhDo": 106.6643144,
  "khoangCachPhutSoVoiXuatBen": 0,
  "choDatVe": true,
  "choGuiHang": false,
  "nhaXeThamChieu": "MEKO Limousine",
  "tuyenThamChieu": "Sài Gòn - Cần Thơ / Tiền Giang"
}
```

---

### 3. `crawled-catalog.json` (2.063 điểm)
Bộ dữ liệu hợp nhất toàn diện, phân nhóm `BEN_XE_VAN_PHONG_BUU_CUC` và `DIEM_DON_TRA_DOC_TUYEN` giúp dễ dàng lọc, tra cứu hoặc chuyển đổi sang migration / seeder.

---

## 🚀 Cách chạy cập nhật crawler lại bất cứ lúc nào

```bash
node scripts/crawler/crawl-bus-locations.mjs
```
Script hoàn toàn tự động lấy token xác thực và cập nhật các tệp JSON trên trong vòng chưa tới 20 giây.
