# Shared support chat integration

The Customer Web, Admin Web and Flutter client use the same NestJS support-chat
service and MySQL models. REST uses `/api/v1/support-chat`; Socket.IO uses the
`/chat` namespace with the existing access JWT in `auth.token`.

Environment examples, non-default API ports and realtime troubleshooting:
[Chat realtime configuration](CHAT_REALTIME_CONFIGURATION.md).

Post-merge realtime follow-up: Web/Admin now derive the socket origin from their
configured REST URL unless an explicit socket origin is supplied. Admin resyncs
the inbox on the first authenticated connection as well as reconnects. Both env
examples document the optional override and restart/rebuild requirement. This
follow-up changes frontend connection setup only; auth and tenant scope remain
enforced by the shared backend.

## Integration corrections

- Integrate develop without dropping shipment/promotion permissions, navigation,
  CI migration checks, or the persisted ticket-review contract.
- Global Express authentication/authorization guards leave `ws` contexts to the
  gateway. `SupportChatGateway` is currently the only WebSocket gateway and must
  authenticate its handshake, revalidate the session on commands and enforce
  service-level customer/tenant scope. A future gateway must provide equivalent
  protection; bypassing HTTP guards does not authenticate a socket.
- Close uses a conditional database update inside the transaction. Only the
  request that changes the state inserts the close system message.
- Admin chat derives its versioned REST URL from the shared Admin API origin,
  just as login and other Admin features do. `NEXT_PUBLIC_API_URL` is an origin
  in Admin; Web's existing chat configuration uses a versioned API base.
- Customer Web marks explicit staff-message IDs read only when the actual text
  bubble intersects the clipped transcript viewport in a visible document.
  History preload, offscreen bubbles and header/avatar visibility do not count.
  It never sends empty IDs, which the Backend interprets as mark-all.
- Customer Web ignores unrelated conversation events and own read receipts,
  merges late HTTP snapshots with realtime messages and resets mounted state
  when the authenticated account changes.
- Web chat uses the existing authenticated retry path with one shared refresh
  operation and rejects responses from a replaced session. Admin chat uses
  `adminApiFetch`; socket authentication errors delegate to the existing Admin
  refresh helper. Authenticated socket readiness triggers room rejoin/resync.
- Admin discovers new conversations without a manual reload, retains active
  list filters, ignores own read receipts and restores its session on direct
  navigation. Staff bubbles use the existing Admin blue color token.

## Client delivery and session requirements

An ACK failure or timeout does not prove that a message was not saved. Keep the
same `clientMessageId` for REST fallback/retry and reconcile it with server IDs.
The server currently checks closed-conversation state before idempotency replay;
if a conversation closes after a successful send, recover through GET history
rather than inventing a new message ID. Reconnect must refresh conversation state
and bridge missing history, not only rejoin the socket room. Drop old responses
and callbacks when the account/conversation changes. Refresh access credentials
before reconnecting after authentication rejection.

## Executed validation

On the integrated working tree, 21 October 2026:

- API unit suite: 827 passed; API build, typecheck and lint passed.
- Admin suite: 436 passed; typecheck passed; lint had no errors and three existing
  shipment warnings.
- Web suites: 133 Node tests and 125 Vitest tests passed; typecheck passed.
- Customer chat component suite: 19 passed, covering read state, late responses,
  account changes, document/history visibility and authenticated refresh.
- Web and Admin production builds passed.
- Dedicated MySQL + real HTTP/JWT/Socket.IO: 16 checks passed. These include
  cross-tenant isolation, invalid/revoked credentials, lost-ACK deduplication,
  read receipts, reconnect history, pagination and parallel close. The earlier
  failing WS-guard and duplicate-close evidence is retained outside Git.

Actual browser acceptance passed for Web/Admin message delivery, read receipts,
history pagination, tenant isolation, offline/retry with one database row,
new-conversation discovery, direct Admin navigation and naturally expired JWT
recovery without signing in again. Admin colors were checked at 1440x900 and
375x667. Browser close-confirmation UI was not exercised; API concurrency and
physical Android close were exercised separately.

Physical Android acceptance used the installed APK matching Mobile commit
`5c7ea756592f19305a9da83108528284a83f4554`: real QA login, create conversation,
send to Admin, receive replies, background/resume without manual refresh,
reopen persisted history, close conversation with composer disabled, and logout
followed by the anonymous chat gate. Mobile validation separately passed 358
tests, analyze, APK build and 10 real Dart-adapter/API/socket checks. Mobile PR #7
has successful format/analyze/test and debug APK CI checks for that commit.

Local fixture credentials, database URLs, raw logs and screenshots stay outside
Git in `mobile-qa-evidence/`. No production/payment or shared-QA data was used.

## Graph scope and remaining gates

GitNexus impact reported CRITICAL for shared Admin access/layout, and UNKNOWN for
framework hooks/plain-object exports. Direct source registration/call sites and
runtime authorization checks corroborate those paths. The overall merge diff
from the old chat HEAD exceeds the tool's hard 1000-symbol listing cap even after
rerunning with a larger CLI limit; its aggregate risk remains CRITICAL. Comparing
the intended PR against develop was uncapped at an earlier checkpoint, but the
final index reports 79 files/1016 symbols and also hits that cap. Repeating with
CLI limit 5000 retains the cap. The full merge reports 274 files/3302 symbols;
both aggregate risk levels remain CRITICAL. These are not clean graph gates;
process coverage is bounded, so an absent graph edge is not proof of no impact.

Final Backend head CI remains a separate gate after pushing. No PR
merge or reviewer-thread resolution is performed by the implementation agent.

## Lead review follow-up

- Admin reads use one REST mutation with explicit visible inbound IDs. No empty
  fallback or parallel socket read mutation is sent. UI read state changes only
  after acknowledgement; a failed request preserves unread state. The detail API
  now supplies `soTinChuaDoc` from the authorized conversation's other-sender
  `DA_GUI` records, so initial open and post-ACK counts include unloaded history.
  This adds one count after scope checks; there is no list N+1 or schema change.
- Web/Admin reconnect traverse cursor pages back to the last complete REST
  history checkpoint. A newer realtime/optimistic message cannot advance that
  checkpoint and hide a gap. Late results are discarded after selection/session
  changes; pending drafts and realtime messages are reconciled without duplicates.
- Web observes text-bubble viewport intersections on scroll, resize and layout
  intersection changes. Read ACK/status changes do not scroll back to the bottom.
- Deterministic Admin/Web regressions first failed on the reviewed implementation.
  API count tests additionally verify authorization before querying unread data.
  Final run counts, actual browser/DB evidence and new-head CI belong in the PR
  handoff; earlier physical Android evidence applies only to Mobile `5c7ea75`.
- Mobile follow-up `7a726fa` fixes delayed background reconnect and paged-list
  refresh with seven red-to-green regressions, 365 full tests and a rebuilt APK.
  The new APK has not been installed or rechecked on the physical phone.

Follow-up validation: 834 API unit tests, 440 Admin tests, 139 Web Node tests and
125 Web Vitest tests passed. Focused components: Admin 17, Web 25. API build,
typecheck/lint and both frontend typecheck/production builds passed. A generated
Next dev validator initially failed typecheck after concurrent dev/typegen;
regenerating it through Next dev and stopping dev before checks restored valid
generated types. The failing logs were retained; no checks were weakened.

Actual browser/MySQL regression verified older 15 unread records stay unread,
one blocked read request retains its badge until ACK, server unread count and
Admin badge both equal 15, and Web/Admin reconnect each recover 55 missed
messages. Web offscreen/unloaded messages remain unread until their text bubbles
intersect the viewport; read ACK preserves the scroll anchor. Smooth scrolling
can expose several bubbles on the way, and those intersections count as viewed.

Final refreshed graph reports this follow-up as 7 files/12 symbols, CRITICAL;
the full PR versus develop is 79 files/230 symbols, also CRITICAL, without a
capped listing at this checkpoint. This supersedes the earlier listing-cap
observation, not the shared API impact warning or Lead review requirement.

## Admin viewport follow-up

Admin now uses the same visible-text-bubble semantics as Customer Web and Mobile.
Only customer text rectangles intersecting the transcript scroll area, clipped
to the browser viewport in a visible tab, may be sent to the read endpoint.
Header/avatar visibility, loaded offscreen messages and empty ID lists do not
qualify. Scroll, resize, tab visibility and intersection changes recheck the
geometry. No API/schema or Mobile changes are part of this follow-up.

The existing single REST mutation/ACK/count flow remains authoritative. A scroll
while a read is pending queues the newly visible IDs for the next acknowledged
batch. Failed reads retain state and do not start a retry loop; another viewport
event can retry currently visible IDs. Status-only ACKs keep the scroll anchor.

Three new viewport component regressions failed on `349c451`, then passed after
the correction. Two additional regressions cover pending-ACK serialization and
failure without an automatic retry loop. Existing 17 component regressions also
remain included. Browser/database evidence and exact-head CI are reported in the
PR handoff, separately from these controlled component tests.

Executed validation for this follow-up: all 445 Admin tests (22 focused chat
component tests), scoped ESLint, Admin typecheck and production build passed.
Actual Chrome/API/JWT/Socket.IO/MySQL QA used only the dedicated local test DB.
With 50 loaded customer messages, offscreen records remained unread. Deliberate
scrolling changed the authoritative unread count from 14 to 9, matched the Admin
badge, and emitted customer receipt IDs 277..281, all within the observed visible
text bubbles 277..283. The nine offscreen messages stayed `DA_GUI`; the read ACK
did not jump the viewport. A new message while Admin was backgrounded stayed
unread, and detail count 10 matched MySQL. Same-tab foreground return remains
unverified in this browser run because CUA lost its debugger connection; the
visibility-change component regression passed. No new physical Mobile test is
claimed. Raw evidence/report remain outside Git in
`mobile-qa-evidence/chat-qa/ADMIN_VIEWPORT_P2_QA.md`.

The first incremental graph had incorrect/UNKNOWN node mappings. A full forced
rebuild restored the component identity: its upstream walk reports LOW (two
impacted symbols), while all-scope follow-up analysis reports HIGH across three
files. The aggregate HIGH warning remains applicable; graph results and tests do
not waive Lead review. Final pushed-head CI is checked separately in PR37.
