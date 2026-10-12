# Stripe subscription autopay synchronization

Access's member and admin autopay switches govern future Access billing invoices
and every subscription on the primary payer's linked Stripe customer. The app's
preference is the source of truth: manual collection-method changes in Stripe
will be reconciled back to that preference. Customers without an unambiguous
active primary payer are flagged for review.

The backend updates subscription collection settings only. It never creates,
finalizes, pays, cancels, or edits an invoice. Already-created invoices, including
drafts, keep their existing collection settings and retries. Turning autopay off
does not stop retries on an older invoice.

With autopay enabled, a subscription/schedule default payment method takes
precedence over the customer's default. Without an attached default method (or a
legacy default source), new invoices use manual collection. An attached method
can still be declined; the app does not attempt a payment to validate it.

Existing manual-payment terms in Stripe take precedence. Access remembers those
terms across switches to automatic collection, because Stripe clears them. Only
objects without existing or remembered terms get the 14-day fallback. Adjust the
terms in Stripe, not Access.

## Configuration and rollout

1. Use a separate Convex development deployment and Stripe sandbox/test account
   for validation. Set `STRIPE_SECRET_KEY` (or `STRIPE_API_KEY`) there to the test
   key. Keep live credentials out of tests.
2. Deploy the backend schema/functions and frontend through the repository's
   normal deployment process. The new tables are additive; existing preference
   values stay intact. Missing legacy preferences continue to mean autopay off.
   **The hourly reconciliation and preference-change jobs become active on
   deployment**, so review existing preferences/customer mappings before
   deploying to production.
3. In Stripe, add an event destination pointing to
   `https://<deployment>.convex.site/stripe/autopay-webhook`. Use the Convex HTTP
   origin, not the application's frontend origin. Configure snapshot events at
   the installed Stripe SDK's API version (`2026-05-27.dahlia`), and subscribe to:
   - `customer.created`, `customer.updated`, `customer.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.paused`,
     `customer.subscription.resumed`
   - `subscription_schedule.created`, `subscription_schedule.updated`,
     `subscription_schedule.released`, `subscription_schedule.canceled`,
     `subscription_schedule.completed`, `subscription_schedule.aborted`
   - `payment_method.attached`, `payment_method.updated`,
     `payment_method.detached`, `payment_method.automatically_updated`
   - `customer.source.created`, `customer.source.updated`, `customer.source.deleted`
4. Set that destination's signing secret as `STRIPE_AUTOPAY_WEBHOOK_SECRET` in
   the matching Convex deployment. The webhook returns 503 until this is set;
   invalid or stale signatures return 400. Accepting an event stores its ID and
   schedules reconciliation in one transaction before acknowledging delivery.
5. After configuration and test validation, run the initial reconciliation:
   ```bash
   npx convex run stripeAutopayData:reconcile '{}'
   ```
   This targets the configured development deployment. For the reviewed
   production deployment, use `npx convex run --prod stripeAutopayData:reconcile '{}'`.
   This changes subscription collection settings across linked customers; it is
   not a dry run. Review the member Payments page or the admin account's household
   billing section for synchronization status.

Use the same setup in production with the production destination/signing secret
and live API key. Do not send test events to the live deployment.

## Creating competition plans in Stripe

Create the five-installment schedule and configure its ending behavior and
failed-payment cancellation exemption in Stripe. Select its initial collection
method to match the Access preference. Webhooks run asynchronously; they cannot
prevent a first charge that occurs immediately during subscription creation.

The app discovers new subscriptions and future schedules automatically. It
preserves plan amounts, quantities, phase dates, discounts, tax settings, metadata,
invoice footers, and ending behavior. Schedules with one-off `add_invoice_items` or unsupported
phase settings require review instead of risking replaying a charge or dropping
configuration. No subscriptions are restarted by synchronization.

Outstanding invoices after the final installment remain the studio's manual
responsibility. Access neither replaces them nor changes their recovery rules.

## Reliability and operations

- Each customer has a durable revision, status, remembered terms, attempt count,
  last successful sync, retry deadline, and sanitized error message.
- One worker holds a customer lease for 15 minutes, longer than Convex's 10-minute
  action limit. Every write is preceded by a transactional checkpoint that
  verifies the latest preference and ownership. Concurrent toggles queue another
  pass; an expired worker is recovered by hourly reconciliation.
- Transient failures retry after 1 minute, 5 minutes, and 30 minutes. Failed
  records remain visible, can be retried by the authorized member/admin, and are
  checked again by the hourly reconciliation. The UI never treats saving the
  local preference as proof that Stripe has synchronized.
- Webhook IDs are retained for 30 days. Events are reconciliation requests, not
  authoritative preference updates, so duplicates and out-of-order delivery are
  safe. No-op reconciliation performs no Stripe writes, preventing webhook loops.
- List operations consume all Stripe pages, including future schedules that do
  not yet have a subscription. The hourly Convex scan paginates users.
- On errors, inspect `stripeAutopaySync` and Convex function logs. Failed workers
  log a sanitized warning with the customer ID, revision, and reason. Unsupported
  schedule errors identify the field without logging its value. Use the retry
  control after correcting customer ownership, credentials, or Stripe settings.
  Avoid manually changing collection settings as a workaround while sync is
  active, because Access will restore its saved preference.

## Validation

Local tests use only mocked Stripe transport and real local webhook signatures:

```bash
npm test
npm run lint
npm run build
```

Run the opt-in Stripe API integration check with a test key in the environment
or local `.env`/`.env.local` files:

```bash
node --experimental-strip-types scripts/verify-stripe-autopay.ts
```

The script refuses live keys, creates an isolated test-clock customer and plans,
checks both collection directions and phase-specific payment terms, verifies
existing invoices are unchanged, and advances through exactly five installments.
It settles fixture invoices in test mode to isolate the check from account-level
failed-payment rules. Finally it deletes the clock/customer/subscriptions and
coupon and archives the fixture price/product. It does not deploy Access or
configure a webhook destination.

For end-to-end validation of the deployed UI and webhook, use a separate Stripe
test-clock customer:

1. Link a test customer with a test default payment method to an active primary
   payer. Create a standalone monthly subscription and a five-month schedule,
   using manual collection and configured terms such as 7 and 21 days.
2. Toggle autopay on from the member page; wait for synchronized status. Confirm
   both use automatic collection. Advance the clock through an invoice boundary.
3. Toggle off from the admin page. Confirm the original payment terms return;
   advance another billing period and verify the new invoice is manual.
4. Leave an existing invoice outstanding while toggling. Confirm that invoice's
   method, auto-advance flag, and retries do not change.
5. Test a future phase transition, a future schedule without a subscription,
   missing/detached defaults, and a new plan created while autopay is already on.
6. Advance past the fifth billing period and verify that Stripe's configured
   schedule ending still applies. Access should not generate a sixth installment.
7. Replay a signed webhook and perform rapid on/off changes. Verify eventual
   state matches the latest preference, without extra invoices or charges.

The end-to-end UI/webhook checks require a deployed test backend, Stripe test
credentials, and a configured webhook destination; the local test suite and
standalone Stripe integration script do not deploy or configure those services.
