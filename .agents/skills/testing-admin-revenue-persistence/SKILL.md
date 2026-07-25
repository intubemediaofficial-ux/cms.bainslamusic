---
name: testing-admin-revenue-persistence
description: Test Admin Dashboard revenue display and cache preservation during YouTube Analytics outages. Use when changing revenue aggregation, Admin summary fields, or sync behavior.
---

# Admin Revenue Persistence Testing

## Devin Secrets Needed

- `DO_SERVER_ROOT_PASSWORD` — optional; required only to retrieve a read-only Redis snapshot from the DigitalOcean host.

## Safe test environment

1. Never mutate production Redis for UI testing.
2. Retrieve a read-only RDB snapshot through SSH and load it into a disposable local Redis container.
3. Start Next.js with `REDIS_URL` pointed at the disposable container, a local `NEXTAUTH_URL`, an isolated `NEXTAUTH_SECRET`, and an isolated Admin password override.
4. Use a server-authorized channel already assigned in `bainsla_users`. Do not add an arbitrary cached channel because cached data must never authorize access.

## Revenue fixture

When the snapshot has no positive revenue values, set a known `estimatedRevenue` on one assigned channel in the disposable `client_data_cache:<email>` record and recalculate that record's `totalRevenue`. Record the Company, client, channel ID/title, and expected USD value in the test plan. Clearly disclose that this is controlled local test data.

## Browser assertions

1. Open Admin Dashboard and click the relevant KPI card to open Quick View.
2. Verify the account shows the exact known USD revenue and a non-zero INR conversion.
3. Verify main rows expose only Revenue and Revenue INR; Net Payment and Paid may remain inside expanded payment details.
4. Expand the channel count and verify the same authorized channel and revenue.
5. Refresh during an Analytics quota/error condition and verify the last-known value is not reset to zero.
6. Verify a zero-channel Company remains at zero to guard against cross-tenant cache leakage.
7. Capture Company Overview and Users & Channels in one full-screen screenshot when possible.

## Runtime caveats

- `Syncing...` can cover multiple long-running requests. During quota exhaustion, `dashboardFull` may remain pending even after `/api/sync-client-data` has updated the cache.
- Use the visible `Last synced` timestamp, a page refresh, and the retained exact revenue value together to prove cache preservation.
- Treat a fresh live Analytics revenue response as untested when Google quota is exhausted; do not claim that path passed from cached-fixture evidence.
- Server logs containing `Quota exceeded` are useful supporting evidence, but UI assertions and screenshots remain the primary proof.
