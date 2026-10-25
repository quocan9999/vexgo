# Vehicle seat layouts

Vehicle capacity belongs to each vehicle, not to its vehicle type. A bus company
can therefore create two vehicles of the same type with different seat counts
and layouts.

All endpoints use the shared `/api/v1` prefix and tenant scope. Vehicle and seat
responses use the standard `{ "data": ... }` envelope. The Admin UI uses
`vehicle:create`, `vehicle:delete`, `seat:read`, `seat:create`, `seat:update`,
and `seat:delete` permissions.

## Delete an unused vehicle

`DELETE /api/v1/vehicles/:id`

Requires `vehicle:delete`. A vehicle can only be deleted if it has never been
used by a trip, including cancelled or completed trips. The vehicle and its
configured seats are deleted atomically. A vehicle with any trip history returns
`409 VEHICLE_HAS_TRIPS` so its operational history remains available.

## Create a vehicle with its initial seats

`POST /api/v1/vehicles`

The existing vehicle fields are unchanged. `seats` is optional for compatibility
with existing API clients. When provided, it must contain 1 to 120 seats and is
created atomically with the vehicle.

```json
{
  "licensePlate": "51B-123.45",
  "busCompanyId": 12,
  "vehicleTypeId": 4,
  "status": "HOAT_DONG",
  "seats": [
    { "seatNumber": "A01", "position": null, "floor": 1, "x": 160, "y": 1000 },
    { "seatNumber": "A02", "position": null, "floor": 1, "x": 360, "y": 1000 },
    { "seatNumber": "B01", "position": null, "floor": 2, "x": 160, "y": 1000 }
  ]
}
```

Each seat requires a unique `seatNumber`, `floor` (`1` or `2`), `x` (`110` to
`890`), and `y` (`1000` to `30000`). `x` is a horizontal position normalized to
the vehicle width. The editor maps 1000 vertical units to about 64 screen pixels;
this lets the map grow for vehicles with more rows while retaining the same
horizontal proportions. Positions on the same floor must leave enough space for
the seat controls and may not overlap.

The Admin editor lets the operator choose one to five columns per floor before
adding seats. Choosing a column count lays out that floor's seats in that many
columns; the operator can then drag seats freely. Seats snap to matching
horizontal or vertical alignment guides when close to another seat. Arrow keys
remain available for alignment-preserving movement. A selected seat can be
moved between floors after the second floor is created.

## Read and add vehicle seats

`GET /api/v1/vehicles/:vehicleId/seats` returns each seat with `floor`, `x`, and
`y`. Coordinates can be `null` for seats created by older clients; the Admin and
Customer UIs provide a deterministic fallback arrangement until the layout is
saved.

`POST /api/v1/vehicles/:vehicleId/seats` keeps accepting the existing
`seatNumber` and `position` fields. It also accepts `floor`, `x`, and `y`
together. If omitted, the seat is created on floor 1 with no coordinates.

## Delete a vehicle seat

`DELETE /api/v1/vehicles/:vehicleId/seats/:seatId`

Requires `seat:delete` and returns `204 No Content`. If the deleted seat has a
standard label such as `A04`, later numeric labels in the same floor and label
series are compacted (for example, `A05` becomes `A04`). The delete and
renumbering are atomic. The API returns `409 VEHICLE_SEAT_IN_USE` when the
deleted seat belongs to a trip, and `409 VEHICLE_SEAT_RENUMBER_CONFLICT` when
renumbering would change the label of a seat already used by a trip. This keeps
existing trip and ticket labels stable.

## Save a layout

`PATCH /api/v1/vehicles/:vehicleId/seats/layout`

Requires `seat:update`. The body must include every current seat exactly once;
the endpoint only changes floor and coordinates, never seat numbers or trip
inventory.

```json
{
  "seats": [
    { "seatId": 101, "floor": 1, "x": 160, "y": 1000 },
    { "seatId": 102, "floor": 1, "x": 360, "y": 1000 }
  ]
}
```

The write is transactional and locks the vehicle row. Duplicate seat positions
return `409 VEHICLE_SEAT_POSITION_OCCUPIED`; duplicate or stale seat lists return
a `409` business error so Admin can reload the latest configuration. Layouts are
limited to 120 seats and two floors.

## Delete the upper floor

`DELETE /api/v1/vehicles/:vehicleId/seats/floors/2`

Requires `seat:delete`. The operation deletes all seats on the upper floor in a
single transaction. It returns `409` if any of those seats already belongs to a
trip, and the lower floor cannot be deleted.

## Trip seat maps

When a trip is created, its seat inventory keeps the seat identity and booking
status. The public `GET /api/v1/trips/:id/seats` and tenant seat-inventory API
return `floor`, `x`, and `y` from each seat's current vehicle configuration, so
changing a vehicle layout also updates the map shown for trips that already
exist. The trip's seat IDs and booking statuses remain trip-specific.
