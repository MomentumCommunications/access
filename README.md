# Access Momentum

Access Momentum is the client and staff portal for **Momentum Dance & Events**.

It combines customer onboarding, student/class management, enrollment workflows, billing review, and payments in a single app built on **TanStack Start + Convex**.

## What it does

Access currently includes workflows for:

- **Authentication and account security**
  - Convex Auth password login
  - email verification
  - password reset
  - account email/password management
- **Customer onboarding**
  - multi-step registration
  - student/profile collection
  - contract signing with DocuSeal
- **Studio operations**
  - students, contacts, and households
  - classes, sessions, and attendance
  - recurring and per-session enrollment flows
  - group-based visibility and managed-enrollment restrictions
- **Billing**
  - tuition calculation and household billing views
  - private lesson charge workflows
  - billing adjustments and billing runs
  - customer tuition-plan summaries
- **Payments**
  - Stripe customer mapping
  - Stripe-hosted customer portal launch from `/payments`
  - billing-attention states such as missing default payment method / delinquency
- **Communication**
  - bulletins and group-targeted announcements
  - in-app notifications

## Tech stack

- **Frontend:** [TanStack Start](https://tanstack.com/start/latest), React 19, TanStack Router, TanStack Query
- **Backend / database:** [Convex](https://www.convex.dev/)
- **Authentication:** Convex Auth
- **Styling / UI:** Tailwind CSS, shadcn/ui, Radix UI
- **Payments:** Stripe
- **Transactional email:** Resend
- **Contracts:** DocuSeal
- **Deployment target in repo:** Netlify build integration with Convex deploy

## Repository structure

```text
.
├── convex/                 # Convex schema, queries, mutations, actions
│   ├── schema.ts           # Main data model
│   ├── billing.ts          # Billing and tuition logic
│   ├── billingDispatch.ts  # Stripe invoice dispatch logic
│   ├── payments.ts         # Payments + Stripe portal actions
│   ├── notifications.ts    # Notification APIs
│   └── users.ts            # Current-user / account helpers
├── src/
│   ├── components/         # App and UI components
│   ├── contexts/           # React context providers
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Shared client utilities
│   └── routes/             # TanStack file-based routes
├── shared/                 # Shared client/server helpers and types
├── public/                 # Static assets, icons, splash screens
├── scripts/                # Utility scripts
└── tests/                  # Node built-in test runner tests
```

## Key routes

A few notable route groups in `src/routes/`:

- `/login`, `/signup`, `/register/*`, `/reset-password`
- `/home`, `/account`, `/payments`, `/tuition-plan`
- `/classes`, `/students`
- `/admin/*`
  - `/admin/students`
  - `/admin/classes`
  - `/admin/attendance`
  - `/admin/billing/tuitions`
  - `/admin/billing/charges`
  - `/admin/billing/runs`
  - `/admin/billing/adjustments`
  - `/admin/privates`
- `/staff/*`

## Local development

### Prerequisites

- **Node.js 24+** recommended
- **npm**
- a **Convex** project/deployment

### Install dependencies

```bash
npm install
```

### Start the app

```bash
npm run dev
```

This starts the local app on **http://localhost:3000**.

## Environment variables

This project depends on both client-side and server-side environment variables.

### Client-side

These are read by the frontend:

- `VITE_CONVEX_URL` — Convex deployment URL used by the React client
- `VITE_WEB_PUSH_PUBLIC_KEY` — browser-facing VAPID public key
- `DOCUSEAL_RECREATIONAL_URL` — DocuSeal embed URL for the recreational contract flow

### Server-side / Convex environment

These are used by Convex actions/functions:

- `CONVEX_SITE_URL` — site URL used by auth configuration
- `RESEND_API_KEY` — email delivery for verification and password reset flows
- `STRIPE_SECRET_KEY` or `STRIPE_API_KEY` — Stripe server API access
- `WEB_PUSH_PUBLIC_KEY` — VAPID public key used for push delivery
- `WEB_PUSH_PRIVATE_KEY` — VAPID private key kept in Convex
- `WEB_PUSH_SUBJECT` — VAPID contact URI, such as `mailto:admin@example.com`

> Note: some older deployment comments/files in the repo still reference Clerk-era variables. The active auth stack in the codebase is **Convex Auth**, not Clerk.

## Scripts

```bash
npm run dev                  # Start local dev server
npm run build                # Production build
npm run lint                 # ESLint
npm test                     # Node built-in test runner
npm run generate:pwa-splash  # Generate iOS splash assets
npm run deploy               # Build + deploy command defined in package.json
npm run cf-typegen           # Wrangler type generation helper
```

## Billing model at a glance

Access treats billing as an **application-side calculation and review system** with **Stripe as the payment system of record**.

In practice that means:

- Access computes tuition, private charges, adjustments, and billing-run data
- staff review billing in admin billing screens
- Stripe handles payment methods, customer portal, invoices, and collection

This is why the repo contains both:

- detailed billing logic under `convex/billing*.ts`
- Stripe integration under `convex/payments.ts`, `convex/stripe.ts`, and `convex/lib/stripe.ts`

## Testing

Tests run with the Node.js built-in test runner and TypeScript type stripping:

```bash
npm test
```

For the normal local verification loop:

```bash
npm run lint
npm test
npm run build
```

## Deployment notes

The repository includes `netlify.toml` and uses a Netlify-oriented TanStack Start plugin in `vite.config.ts`.

The current build command in `netlify.toml` is:

```bash
npx convex deploy --cmd 'npm run build'
```

Make sure deployment environment variables are configured in both:

- the hosting provider
- the Convex deployment environment

## Status

This project is an actively evolving internal/business application. Product workflows and billing behavior are being refined in production-oriented increments, so expect ongoing changes in areas like:

- enrollment UX
- billing adjustments
- notifications
- season cloning / operational tooling

## License

This repository is licensed under the terms in [LICENSE](./LICENSE).
