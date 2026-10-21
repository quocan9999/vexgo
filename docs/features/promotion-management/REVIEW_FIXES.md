# PR #38: reviewer corrections

## F1: populated develop upgrade

The PR owner approved editing the unmerged Feature 10 migration on 2026-10-16.
The migration first adds nullable quota, preserves all existing promotion IDs and references,
backfills a bounded placeholder quota (1), missing codes (`LEGACY-<id>`) and missing end dates
(the existing start date), then makes the fields required. Existing rows get
`LEGACY_UNCONFIGURED`: they cannot be redeemed or activated through the MVP status endpoint.
No usage ledger or historical discount is invented. Financial records remain unchanged.
Create a new configured promotion to resume offers; placeholder quota is not a business allocation.

CI runs `prisma/tests/promotion-migration-upgrade.mjs` against an isolated scratch schema.
It fetches pinned develop commit `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`, generates its
historical client and runs its complete seed (15 promotions, including open-ended dates).
The test also adds nullable-code and booking/shipment-reference cases, verifies preservation
of all historical financial columns, empty ledger and repeat deploy. It refuses local shared DBs.

### Databases that already applied the previous unmerged migration

Do not rerun its ALTER statements, reset a database or delete migration history.
Back up the database and inspect the one migration record and actual schema first.
A successful old migration already has the same final schema. Existing Feature 10 configured
promotions must stay intact; do not apply the legacy backfill to them.
If the recorded checksum is the old checksum below, the schema matches, and the record is
successfully finished (not rolled back), a maintainer may reconcile **only this checksum**.
Compute the new checksum from the exact checked-out bytes (line endings matter):

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath prisma/migrations/20261015184828_add_promotion_quota_usage_ledger/migration.sql).Hash.ToLowerInvariant()
```

Old repository checksum: `2cb512fb2798bb540242d3a37022c2711a5372c22516975846a272932994f5c4`.
Use a parameterized maintenance query, after checking the target DB explicitly:

```sql
UPDATE _prisma_migrations SET checksum = ?
WHERE migration_name = '20261015184828_add_promotion_quota_usage_ledger'
  AND checksum = '2cb512fb2798bb540242d3a37022c2711a5372c22516975846a272932994f5c4'
  AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
```

Expected affected rows: exactly one, or zero if already reconciled. Other checksums or a failed
migration require inspection of which DDL statements committed before repair; do not mark an
incomplete migration applied. No checksum or database metadata was changed automatically by this fix.

## F2: zero-total checkout

The backend decides using the whole order total (discounted tickets plus cargo). Exactly zero
settles order, booking and tickets in the creation transaction. Creation histories are retained;
completion histories use a separate operation UUID shared by booking and tickets, SYSTEM source
and reason `Đơn 0đ – miễn thanh toán`. All writes, seat hold consumption and promotion quota/ledger
roll back together on failure. Expiry ignores settled bookings.

No ThanhToan record is created for a free order: no money was collected, no bank transaction or
provider identity exists. Order/booking status and system history represent internal completion.
Revenue based on ThanhToan remains zero. A zero-ticket subtotal with positive cargo total still
creates a pending SePay payment for the cargo total. SePay positive-amount validation is unchanged.
The Web keeps guest access credentials in the session draft and goes directly to the server-verified
invoice when the booking response is settled and total is zero.

Tests cover fixed and 100% discount, guest/registered access, lifecycle histories, expiry,
retry, last-use race, cargo fee, full rollback after a real completion-history write, and UI routing.

## F3/F4

Seed date scenarios use the fixed seed reference date 2026-10-15, never MySQL CURRENT_DATE.
A MySQL regression executes the verifier's actual queries under three session timestamps and
three timezones. Only PublicPromotionsController registers the legacy validation endpoint;
metadata regression asserts one handler and HTTP regression keeps the 410 contract.

Review conversations stay open for reviewer verification.

## F6: cancellation with zero ticket refund

Cancellation still requires the existing identity, cutoff and successful-payment checks. A fully settled
zero-total order remains eligible without an original payment; positive-total orders without a successful
payment still fail closed. If the ticket's actual refund amount is zero, cancellation updates ticket and
booking/order states, releases the seat and writes status histories without creating a refund payment or
calling the refund processor. The API response states that no refund is generated. Paid cargo is retained,
and promotion quota and usage ledger remain consumed. Positive refunds continue through the existing
refund-payment and processor flow.

The MySQL integration regression settles a cargo-only order through a signed SePay webhook, cancels its
zero-fare ticket, and verifies payment records, shipment charge/status, seat, histories, quota and usage
ledger. A separate paid-ticket case verifies the positive-refund flow; existing cases cover fully free
cancellation and fail-closed cancellation when a positive order lacks a successful payment.
