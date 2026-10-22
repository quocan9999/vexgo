# Revenue Reports API

`GET /api/v1/revenue-reports` returns the authenticated tenant's revenue report. The endpoint requires a tenant principal and `revenue:read`; the tenant ID is always taken from that principal.

Optional query parameters are `fromDate` and `toDate` (`YYYY-MM-DD`, both required together, inclusive, at most 366 days) and `groupBy` (`day`, `month`, or `quarter`). Without dates, the report covers the current month through the current `Asia/Ho_Chi_Minh` business date. Database reads use a half-open interval from local midnight on `fromDate` to local midnight after `toDate`.

The response uses `{ data, meta }`. Money fields are exact whole-VND decimal strings so JSON serialization cannot round large totals. `successfulPayments` counts only canonical sale settlements; ticket counts also include system-settled 0-VND booking tickets. Breakdown rows group sales by ticket-only, standalone shipment, and combined ticket/shipment order. Refunds are assigned to the order's group while reducing ticket revenue because the current refund writer only refunds tickets.

Sale values come from persisted ticket actual prices and shipment total fees and must equal both the order and payment snapshots. Discount snapshots are not subtracted again. Mismatched source data fails closed with `REVENUE_SOURCE_DATA_INVALID`. Failed, pending, late, duplicate, or reconciliation transfers are not counted. No CSV export route is provided.
