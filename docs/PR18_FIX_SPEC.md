# PR #18 – Fix Specification trước khi merge

**Repository:** `quocan9999/vexgo`  
**PR:** #18 – Customer Web UI / Trips / Booking  
**Reviewed head:** `4c9f0310dd7f2b75a063272b2932987617fc5efd`  
**Review submission:** `5378825860`

## 1. Mục tiêu

Sửa toàn bộ finding còn mở của PR #18 để có thể review lại và chốt merge vào `develop`.

Ưu tiên:
1. Không làm yếu auth/security chỉ để test xanh.
2. Không đưa PII của khách hàng vào URL.
3. One-way và round-trip phải dùng cùng một payment data contract đáng tin cậy.
4. Không hiển thị dữ liệu chuyến giả/hard-code trên flow customer-facing.
5. Các control chưa triển khai chức năng thật phải có trạng thái UX rõ ràng.
6. Full CI phải xanh trên merge result với `develop` mới nhất.

## 2. Ngoài phạm vi

PR này **không cần triển khai chức năng “Thông tin xe” hoặc “Chi tiết” hoàn chỉnh**.

Các button/link chưa có chức năng thật chỉ cần mở modal placeholder thống nhất, ví dụ:

> Tính năng sắp có  
> Thông tin xe/Chi tiết sẽ được bổ sung ở phiên bản sau.

Riêng nút **“Chi tiết” ở sidebar one-way** hiện đã có modal thông tin chuyến thật thì giữ nguyên behavior hiện tại, không đổi thành placeholder.

Payment gateway thật, booking hold thật, tạo vé/invoice backend thật cũng không thuộc scope fix này nếu chưa có feature backend tương ứng.

---

## 3. Blocker CI – Trips integration test lệch `develop`

### Hiện trạng

API CI của merge result đang fail tại:

`apps/api/test/integration/trips/trips.spec.ts`

`AccessTokenGuard` trên `develop` hiện cần thêm:
- `PermissionResolverService`
- `EffectiveRolePermissionLoaderService`

Nhưng test module trong PR vẫn hand-wire guard theo dependency cũ nên Nest không compile được test suite.

### Yêu cầu

- Sync branch PR với `develop` mới nhất trước khi chốt.
- Không xóa `APP_GUARD` hoặc bỏ `AccessTokenGuard` chỉ để test xanh.
- Ưu tiên dùng Auth module/shared auth test fixture đúng với runtime để tránh constructor guard đổi là test lại drift.
- Nếu vẫn hand-wire guard thì phải provide/mock đầy đủ các dependency hiện hành.
- Giữ regression coverage xác nhận các GET customer-facing của Trips hoạt động unauthenticated theo `@OptionalAuth()`.

### Acceptance

- `apps/api/test/integration/trips/trips.spec.ts` chạy thật, không bị skip vì setup fail.
- API tests pass.
- API E2E, typecheck, lint chạy tiếp và pass.
- Full GitHub Actions CI xanh trên merge result với `develop`.

---

## 4. Auth retry lifecycle – không được logout khi retry lỗi non-401

### File chính

- `apps/web/src/features/auth/services/auth-retry.ts`
- `apps/web/src/features/auth/auth-session.tsx`
- `apps/web/test/unit/auth/auth-lifecycle.spec.mjs`

### Bug hiện tại

Flow:

1. protected request trả `401`
2. refresh token thành công
3. cập nhật access/refresh token mới
4. retry protected request với access token mới
5. retry trả `400`, `403`, `409`, `500`, ...

Hiện request retry đang nằm trong cùng `try/catch` với `refreshFn`, nên lỗi retry bị hiểu nhầm là refresh failure và gọi `onAuthFailed()` → sign-out sai.

### Yêu cầu

Tách rõ ba pha:

1. Gọi request lần đầu.
2. Nếu đúng `401` và có refresh token thì refresh.
3. Sau refresh thành công, retry request bằng access token mới.

Chỉ gọi `onAuthFailed()` khi:
- không có token cần thiết cho flow auth;
- refresh thực sự thất bại;
- hoặc request retry bằng token mới vẫn trả `401`.

Nếu retry bằng token mới trả lỗi non-401:
- giữ session;
- propagate nguyên lỗi nghiệp vụ/server;
- không logout.

### Test bắt buộc

- happy path: request đầu thành công → không refresh.
- 401 → refresh success → retry success.
- 401 → refresh reject → sign-out.
- 401 → không có refresh token → sign-out.
- non-401 ở request đầu → không refresh, không sign-out.
- **401 → refresh success → retry 500 → throw 500, không sign-out.**
- Nên có thêm: 401 → refresh success → retry 401 → sign-out.

---

## 5. Không truyền PII qua URL

### Hiện trạng

One-way và round-trip đang đưa các field sau vào query string của `/payment`:

- `customerName`
- `customerPhone`
- `customerEmail`

Phone/email là dữ liệu cá nhân và không nên xuất hiện trong:
- browser history;
- access/proxy logs;
- analytics;
- referrer;
- URL được copy/share.

### Yêu cầu thiết kế cho scope hiện tại

Tạo một **payment/booking draft tạm ở client**.

Khuyến nghị:

- Sinh `draftId` opaque/random bằng `crypto.randomUUID()`.
- Lưu draft trong `sessionStorage`, key có namespace rõ ràng, ví dụ:
  `vexgo:payment-draft:<draftId>`
- URL payment chỉ mang `draftId` hoặc route identifier không nhạy cảm.
- `PaymentPage` đọc draft bằng `draftId`.
- Sau này khi backend có booking hold/payment intent thì thay client draft bằng server-side draft mà không cần đổi toàn bộ UI contract.

Không dùng localStorage cho draft thanh toán nếu không có lý do vì draft chỉ cần sống trong tab/session hiện tại.

### Không được

- Không base64 PII rồi cho vào URL; base64 không phải bảo mật.
- Không tiếp tục giữ phone/email/name trong query param.
- Không fallback sang passenger giả khi draft thiếu.

---

## 6. Chuẩn hóa payment contract cho one-way và round-trip

### Vấn đề

`RoundTripBooking` gửi:
- `outboundSeats`
- `returnSeats`
- `outboundRoute`
- `returnRoute`

Nhưng `PaymentPage` chủ yếu đọc contract one-way:
- `seats`
- `count`
- `route`
- `departureTime`
- `pickup`
- `dropoff`

Khi round-trip vào payment, UI có thể rơi xuống fallback giả như ghế/tuyến/giờ mặc định.

### Contract đề xuất

Tạo type dùng chung, ví dụ:

```ts
type PaymentDraft = {
  id: string;
  tripType: 'one-way' | 'round-trip';
  passenger: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  legs: Array<{
    tripId: number | string;
    route: string;
    departureTime: string;
    seats: string[];
    pickup: string;
    dropoff: string;
    unitFare: number;
    subtotal: number;
  }>;
  luggage?: {
    fee: number;
    weight: number;
    info?: unknown;
  };
  totalFare: number;
};
```

Tên type/file có thể khác, nhưng semantic phải tương đương.

### One-way

- `legs.length === 1`
- payment render đúng chuyến, giờ, ghế, pickup/dropoff, giá.

### Round-trip

- `legs.length === 2`
- leg 1 = chuyến đi.
- leg 2 = chuyến về.
- payment phải hiển thị/phân biệt đủ hai leg.
- Không dùng fallback one-way giả.

### Invalid/missing draft

Nếu `draftId` thiếu, draft hết hạn hoặc parse lỗi:
- hiển thị error state rõ ràng;
- có CTA quay lại tìm/chọn chuyến;
- **không tự bịa route, seat, time, passenger hoặc total fare.**

---

## 7. Validation thông tin khách hàng

### Hiện trạng

UI đánh dấu các field bằng `*` nhưng điều kiện `canPay` chỉ kiểm tra:
- đã chọn ghế;
- đã chấp nhận điều khoản.

### Yêu cầu

Trước khi cho phép đi Payment, validate tối thiểu:

- Họ tên: trim khác rỗng.
- Số điện thoại: trim khác rỗng và theo rule phone hiện tại của Customer Web/API.
- Email: bắt buộc vì UI đang đánh `*`; phải có format hợp lệ.

Áp dụng cho cả:
- `OneWayBooking`
- `RoundTripBooking`

Nếu business quyết định email thực sự không bắt buộc thì phải đồng bộ lại UI bỏ `*` và spec/API contract; không được để UI nói bắt buộc nhưng code cho qua.

### UX

- Disable nút thanh toán khi form chưa hợp lệ, hoặc cho click rồi hiện lỗi inline rõ ràng.
- Ưu tiên inline validation gần field.
- Không chỉ dùng `alert()` cho validation chính.

### Test

- thiếu name → không được tiếp tục.
- thiếu phone → không được tiếp tục.
- phone invalid → không được tiếp tục.
- thiếu/invalid email → không được tiếp tục.
- đủ thông tin + seat + terms → được tạo payment draft.

---

## 8. Bỏ giờ hard-code ở round-trip

### Hiện trạng

Round-trip còn dùng fallback:
- `20:00`
- `00:45`

Trong khi trip thật đã có `departureTime`, được map sang `createdAt/timeAgo`.

### Yêu cầu

- Dùng thời gian chuyến thật cho cả outbound và return.
- Dùng formatter dùng chung/thống nhất với one-way.
- Timezone phải rõ ràng, phù hợp business timezone hiện tại (`Asia/Ho_Chi_Minh` nếu frontend cần format local business time).
- Không dùng giờ fixture làm fallback production-facing.

Nếu dữ liệu departure time thiếu/invalid:
- hiển thị trạng thái “Chưa cập nhật” hoặc error phù hợp;
- không tự gán một giờ tưởng như thật.

### Test

Outbound/return có hai thời gian khác nhau → UI/payment draft phải giữ đúng từng thời gian, không xuất hiện `20:00`/`00:45` fixture.

---

## 9. Placeholder modal cho các control chưa làm thật

### Cần áp dụng

Các control no-op như:
- `Thông tin xe` ở one-way seat section.
- `Thông tin xe` ở round-trip seat grids.
- `Chi tiết` ở round-trip sidebar nếu chưa có modal thật.
- `Chi tiết` ở Payment nếu hiện chỉ là `href="#"`.

### Behavior

Bấm vào phải mở modal:

**Title:** `Tính năng sắp có`

**Message theo ngữ cảnh**, ví dụ:
- `Thông tin xe sẽ được bổ sung ở phiên bản sau.`
- `Chi tiết chuyến đi sẽ được bổ sung ở phiên bản sau.`

Modal cần:
- có nút đóng;
- đóng được bằng overlay và/hoặc Escape nếu component modal chung hỗ trợ;
- focus/ARIA hợp lý theo component UI chung hiện có;
- responsive mobile.

Có thể tạo một modal placeholder dùng chung để tránh copy/paste.

### Không sửa nhầm

`Chi tiết` sidebar của OneWayBooking hiện đã mở modal thông tin chuyến thật → giữ nguyên.

---

## 10. Test và regression checklist

### Web

Bắt buộc chạy:

```bash
npm run test --workspace=@vexgo/web
npm run typecheck --workspace=@vexgo/web
npm run lint --workspace=@vexgo/web
npm run build --workspace=@vexgo/web
```

Và route/E2E regression đang có trong CI.

Cần bổ sung/điều chỉnh test cho:
- auth retry 401 → refresh → retry 500 không logout;
- validation passenger one-way;
- validation passenger round-trip;
- payment draft one-way;
- payment draft round-trip 2 legs;
- invalid/missing draft không render fallback giả;
- PII không xuất hiện trong payment URL;
- round-trip dùng giờ thật;
- placeholder modal mở/đóng cho control deferred.

### API

Sau khi sync `develop`:

```bash
npm run test --workspace=@vexgo/api
npm run typecheck --workspace=@vexgo/api
npm run lint --workspace=@vexgo/api
npm run build --workspace=@vexgo/api
```

Không chốt task nếu GitHub Actions merge-result CI vẫn đỏ.

---

## 11. Thứ tự triển khai khuyến nghị

1. Sync latest `develop`; sửa Trips integration test để API CI compile lại.
2. Sửa `runWithAuthRetry` + regression tests.
3. Tạo shared `PaymentDraft` + sessionStorage draft store.
4. Migrate OneWayBooking sang draft.
5. Migrate RoundTripBooking sang cùng draft contract.
6. Sửa PaymentPage đọc draft và render 1/2 legs đúng.
7. Bổ sung passenger validation.
8. Bỏ hard-code time round-trip.
9. Thêm placeholder modal cho các control deferred.
10. Chạy full Web/API/Admin CI và `git diff --check`.

## 12. Điều kiện để yêu cầu review lại

Chỉ gửi review lại khi:

- các review thread/comment liên quan đã được trả lời bằng commit cụ thể;
- auth lifecycle finding đã có test cho retry non-401 sau refresh;
- URL payment không chứa name/phone/email;
- round-trip payment không còn fallback dữ liệu one-way giả;
- passenger required fields được enforce;
- giờ round-trip lấy từ trip thật;
- control deferred mở modal “Tính năng sắp có”;
- API/Web/Admin CI đều xanh trên head/merge result mới.
