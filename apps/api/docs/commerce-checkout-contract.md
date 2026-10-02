# Commerce checkout API contract

All endpoints use the `/api/v1` prefix and require an authenticated customer
(`KHACH_HANG`). Customer identity comes from the authenticated principal. The
client does not send a customer ID, fare, discount, or payable total.

## Hold seats

`POST /api/v1/seat-holds`

```json
{
  "tripId": 42,
  "tripSeatIds": [101, 102]
}
```

Returns `{ "data": { "token": "…", "tripId": 42, "tripSeatIds": [101, 102], "expiresAt": "…" } }`.
The token is bound to the customer account, login session, trip, and exact seat
set. It expires after five minutes. `DELETE /api/v1/seat-holds/:token` releases
only a live hold owned by that account and session.

## Quote

`POST /api/v1/bookings/quote` returns HTTP 200 and does not write booking data.
The optional `holdToken` lets a customer quote seats they already hold.

```json
{
  "tripId": 42,
  "seatIds": [101, 102],
  "holdToken": "<64 lowercase hexadecimal characters>",
  "promotionCode": "SUMMER10"
}
```

The response is `{ "data": { ... } }`. Money fields are decimal strings:
`unitPrice`, `subtotal`, `discountAmount`, and `totalAmount`. The server resolves
the active fare for the trip date and calculates an eligible promotion against
the whole order subtotal.

## Create booking

`POST /api/v1/bookings` returns HTTP 201. It accepts the same fields as quote,
but requires `holdToken`.

The server locks the trip and selected seats, then rechecks trip availability,
the exact owned hold, seat states, current fare, and promotion in one database
transaction. It creates one transaction, one booking, one ticket per selected
seat, marks those seats booked, and consumes the hold atomically. No payment
record is created by this endpoint.

`subtotal` and `discountAmount` apply to the complete booking. For two tickets
priced at 100,000 VND with a 10% promotion, the transaction total is 180,000
VND. Ticket `price` values and `PhieuDatVe.tongTienBanDau` remain at the gross
fare; `DonGiaoDich.tongTien` stores the amount due after the order-level
discount. Booking and transaction start in `CHO_THANH_TOAN`; tickets and seats
start in `DA_DAT`.

## Errors

Domain errors use the standard API error envelope. Relevant codes include:

- `TRIP_NOT_FOUND`, `TRIP_NOT_AVAILABLE`, `TRIP_ALREADY_DEPARTED`
- `SEAT_SELECTION_INVALID`, `SEAT_UNAVAILABLE`, `SEAT_HOLD_NOT_FOUND`,
  `SEAT_HOLD_MISMATCH`
- `APPLICABLE_FARE_NOT_FOUND`
- `PROMOTION_NOT_APPLICABLE`, `PROMOTION_MINIMUM_NOT_MET`,
  `PROMOTION_CONDITION_UNSUPPORTED`, `PROMOTION_AMBIGUOUS`
- `BOOKING_CONFLICT`

Validation failures use `VALIDATION_ERROR`. A hold token is single-use for
booking creation, so concurrent submissions cannot create duplicate bookings.
