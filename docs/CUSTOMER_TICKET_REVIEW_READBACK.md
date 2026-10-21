# Persisted customer review in ticket reads

Addresses the review-loss finding in Mobile
[PR #5](https://github.com/quocan9999/vexgo_mobile/pull/5#discussion_r4323728455).
Review POST persists correctly, but subsequent ticket reads omitted it and offered
another submission which the server rejected as a duplicate.

## Contract and privacy

Authenticated `GET /api/v1/tickets` and `GET /api/v1/tickets/:ticketId` include
`review: null` or an object with `reviewId`, `tripId`, `rating`, nullable `comment`,
ISO `createdAt`, and `status` in each ticket. Existing envelopes stay unchanged.

The review comes from existing `PhanHoi` records filtered by the authenticated
customer and the ticket's actual trip. All of that customer's seats on the trip
hydrate the same review. One batch query covers each page's distinct trips;
detail verifies ownership before querying reviews. Empty pages skip the query.
Historical duplicates resolve by newest `thoiGian`, then largest `phanHoiId`.

Own submitted reviews remain visible to their author when moderated/hidden:
moderation does not undo submission or permit another POST under existing rules.
This does not publish hidden reviews. Public code/phone ticket lookup always
returns `review: null` and never queries private review content.

No migration, schema change, tag storage or new endpoint is introduced. Existing
POST ownership, payment, departure and duplicate checks remain unchanged. Deploy
this contract before merging the Mobile readback fix.

## Verification

- Unit cases cover multiple seats in one batch, null, empty pages, owner checks,
  public privacy and deterministic own review selection, including moderated state.
- MySQL/HTTP submits a review, reads list/detail twice for two actual seats and
  verifies the saved receipt. A newer other-customer record cannot replace it;
  public lookup exposes no review and another account cannot read the ticket.
  Another POST stays 409 and exactly one own customer/trip review exists.
- Local DB tests use a separate MySQL 8.4 instance and never reset/seed shared QA.
  Existing integration guard overrides supply principals; real JWT login and
  physical Android E2E are not claimed.
- GitNexus mapper/helper symbol impact is LOW. Initial aggregate detect-changes
  reported CRITICAL / 830 processes including generic property symbols after
  formatting. The warning is retained, not waived by narrower results. Full API
  tests and all CI apps are required; static process coverage is bounded. After
  refreshing the formatted working-tree index, aggregate detect-changes reports
  LOW with the six intended service/type symbols and no generic properties.

Local validation: 773 API unit tests, 7 MySQL integration tests, typecheck and
lint passed. Build and remote CI results are recorded in the PR handoff.
