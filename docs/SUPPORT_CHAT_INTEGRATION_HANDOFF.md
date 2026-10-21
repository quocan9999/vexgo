# Shared support chat integration

The Customer Web, Admin Web and Flutter client use the same NestJS support-chat
service and MySQL models. REST uses `/api/v1/support-chat`; Socket.IO uses the
`/chat` namespace with the existing access JWT in `auth.token`.

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
- Customer Web marks explicit loaded staff-message IDs read only in the active,
  shown transcript and a visible document. It does not use empty IDs, which the
  Backend interprets as mark-all. This is loaded-transcript semantics, not
  individual bubble/viewport intersection detection.
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
