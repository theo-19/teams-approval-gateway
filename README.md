# Teams Approval Gateway

A reusable NestJS module that routes approval requests through Microsoft Teams,
using the Graph API, and records the decisions in your own database.

## The problem

Organisations run approvals through an authority matrix: who can approve what, at
which financial threshold, in which department. The routing part is straightforward.
The hard part is where the approval actually happens.

An in-app approval queue means people have to log into another system, which means
they don't, and adoption dies. A third-party e-signature service handles the interface
for you, but it costs per seat and adds another vendor relationship.

This module takes the third option: approvals happen in Teams, where staff already are.

## Why Teams

At the organisation this was built for, the alternative in place was Adobe Sign —
200 licences, roughly $40,000 a year. Teams was already paid for as part of an
existing Microsoft 365 subscription, and staff already used it daily. Moving approvals
into Teams retired those licences entirely, and required no new application, no
adoption period, and no training.

The trade-off was deliberate. A managed e-signature service handles token management,
throttling, retries and callback delivery for you. Building on Graph means owning all
of that: acquiring and caching tokens, honouring rate limits, and dealing with callbacks
that arrive duplicated, late, or not at all. That complexity is the price of not paying
per seat, and most of this repository is that complexity being handled.

Decisions are stored in this service's own PostgreSQL database, not in Microsoft's.
Teams is the interface; the database is the record, which is what an audit needs.

## How it works

Submitting a request writes a `PENDING` record **before** calling Graph. If the send
fails or the process dies mid-call, there is a row to retry or reconcile rather than
a card sitting in Teams that nothing in the system knows about.

The record carries a `correlationId` — an opaque UUID that travels out embedded in the
card's actions and comes back on the callback. It is the only link between a button
press in Teams and a row in the database.

When a decision arrives, the state transition is a single conditional update:

```sql
UPDATE approval_request
SET status = 'APPROVED', decided_by = ..., decided_at = ...
WHERE correlation_id = ... AND status = 'PENDING';
```

The condition lives in the query, so the database decides atomically whether the
transition is legal. Two callbacks arriving at the same instant are serialised by
PostgreSQL: one matches a row, the other matches nothing. No read-then-write race,
no lock.

That is what makes the endpoint idempotent. Duplicate callbacks, late callbacks, and
stale cards actioned an hour after the fact are all logged and discarded rather than
overwriting a recorded decision. A duplicate callback returns **200**, not an error —
it is expected traffic, and returning 4xx would only make Teams retry.

Once a decision is recorded the card is replaced with one that has no action buttons,
so the stale-card case is closed at the interface as well as in the database.

`decidedBy` is taken from the callback's authenticated identity, never from the card's
data payload. Card data is client-controlled.

## Design notes

**The Graph integration sits behind an interface.** `GraphClient` declares two
operations — send a card, update a card. There are two implementations: `LiveGraphClient`,
which acquires a token through MSAL and calls Graph with retry handling, and
`StubGraphClient`, which records calls in memory.

`ApprovalService` depends on the interface and cannot tell which one it has. One config
value decides:

```typescript
TeamsApprovalModule.forRoot({
  tenantId,
  clientId,
  clientSecret,
  teamId,
  mode: 'stub', // or 'live'
});
```

The consequence is that the entire approval flow — including the idempotency guarantee —
is testable with no tenant, no network, and no flakiness. The test suite runs in
milliseconds. Point `mode: 'live'` at a tenant with the permissions below and the same
code path talks to Microsoft.

**Configuration comes from the consumer.** The module takes its settings through
`forRoot()` rather than reading `process.env` itself, so it does not force a particular
configuration strategy on whoever uses it.

**Authentication is the client credentials flow.** The service runs unattended, so it
authenticates as itself rather than on behalf of a user. The `.default` scope means
"whatever an administrator has already consented for this app" — with client credentials
you cannot request permissions at runtime.

**Retries distinguish retryable from non-retryable failures.** 429 and 5xx are retried
with `Retry-After` honoured where Graph supplies it, exponential backoff where it does
not, capped at four attempts. 4xx responses are not retried; retrying a malformed
request only burns the rate limit.

## Running it

```bash
yarn install
npx prisma migrate dev
yarn start:dev
```

Tests run against the stub, so no configuration is needed:

```bash
yarn test
```

Docker:

```bash
docker build --platform linux/amd64 -t teams-approval-gateway .
```

Note the explicit platform: building on an Apple Silicon machine otherwise produces a
multi-platform image, which is considerably larger and will not match an x86 target.

## Graph permissions

Application permissions, admin consent required:

`ChannelMessage.Send` · `Chat.ReadWrite.All` · `User.Read.All`

## Not implemented

- **Delegation.** An approver on leave cannot hand a request to someone else. For audit
  purposes a delegated decision needs to record both the delegate and the original
  approver, which means a second identity on the decision record.
- **Multi-step approval chains.** One approver per request. Routing a request through
  a sequence, where each step is only visible once the previous one completes, is the
  obvious next feature.
- **Reconciliation for missing callbacks.** Duplicate and late callbacks are handled;
  a callback that never arrives is not. A request can sit `PENDING` indefinitely. That
  needs a background job polling Graph for message state.
- **Jitter on retries.** Backoff is currently deterministic, so a batch of requests
  throttled together will wake together and hit Graph as a spike. Randomising the delay
  would spread them.

Each of these matters in production. None is needed to demonstrate the routing and
idempotency model, which is what this repository is for.
