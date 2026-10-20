# Customer ticket and booking trip identity

Mobile PR [#5](https://github.com/quocan9999/vexgo_mobile/pull/5#discussion_r4322896562)
cannot submit real reviews because ticket/history responses omit the trip ID
required by `POST /api/v1/reviews`. Booking ID, route and departure time are not
substitutes for trip identity.

## Contract

The following existing responses now include an additive, top-level `tripId`
inside each ticket or booking object:

- `GET /api/v1/tickets`: `data[].tripId`
- `GET /api/v1/tickets/:ticketId`: `data.tripId`
- `POST /api/v1/tickets/lookup`: `data.tripId`, after code/phone verification
- `GET /api/v1/bookings`: `data[].tripId`
- `GET /api/v1/bookings/:bookingId`: `data.tripId`
- `GET /api/v1/bookings/:bookingId/detail`: `data.tripId`, after existing owner or
  guest verification

`tripId` is the numeric `ChuyenXe.chuyenXeId` loaded through
`Ve.gheChuyenXe.chuyenXe`. Booking history uses its first ticket's trip, consistent
with the existing route/departure summary and single-trip booking creation rules.
If the relation is unavailable or a booking has no tickets, the field is `null`;
clients must not submit a review until they have a positive authoritative ID.
The schema already contains these relations, so no migration is required.

Existing fields, pagination/envelopes and access checks remain unchanged. Review
eligibility still depends on the server's ownership, payment, departure and
duplicate-review checks; knowing `tripId` does not grant review permission.

## Verification

- Six new unit cases exercise different trip IDs across all six readers and
  missing-relation/empty-booking behavior. All six fail without the two mapper
  additions, so the tests detect the original omission.
- The MySQL reviews integration test now obtains the ID from real ticket and
  booking HTTP responses, posts a review using the returned ticket ID and verifies
  the persisted review's trip. Another customer's detail/review requests must
  remain forbidden. The integration suite supplies test principals through its
  existing guard override; it does not certify real JWT login or phone UI behavior.
- Local DB tests use a separate MySQL 8.4 instance and dedicated test database;
  no shared QA data is reset or seeded.

Local validation on 2026-10-20:

- Tickets/bookings/reviews unit suites: 64 passed.
- MySQL reviews integration suite: 6 passed, including the HTTP-to-persisted-review
  contract regression above.
- API typecheck, lint and build: passed.
- Full API unit suite: 767 passed, 1 failed. The unchanged shipment pricing test
  in `test/unit/shipments/shipments.service.spec.ts` uses departure
  `2026-10-20 07:00` in the business timezone without freezing the clock. It now
  throws `TRIP_ALREADY_DEPARTED`. Running that file alone reproduces the failure;
  shipment source/tests are identical to base `8b33925`. This is an outstanding
  full-suite gate, not a pass. Keep the PR draft until the gate is addressed.

## Mobile follow-up

After this API change is available, update Mobile's flat ticket response mapping
and contract fixtures, then verify review submission and reload. This Backend PR
does not fix Mobile review tags: the API still supports `tripId`, `rating` and
`comment` only. Hide unsupported tag selection in Real Mode in the Mobile follow-up.
