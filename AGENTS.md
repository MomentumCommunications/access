# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run tests (Node.js 24+ built-in test runner)
npm test
```

Tests use the Node.js built-in test runner with TypeScript type stripping.

## Architecture Overview

This is **Access Momentum**, a client information portal built with:

- **Frontend Framework**: TanStack Start (React-based meta-framework)
- **Backend**: Convex (real-time database with serverless functions)
- **Authentication**: Convex Auth with password login, email verification, and password reset
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: TanStack Router with file-based routing

### Key Architecture Patterns

**Database Schema (convex/schema.ts)**:
- Community organization through `groups` and `groupMembers` (these are not tenant boundaries)
- Communication via `channels` (public/private) and `messages`
- User roles (`admin`/`staff`/`member`) for feature and route access
- Bulletin system for announcements with group targeting
- Reaction system for messages and bulletins
- Studio operations through `students`, `classes`, `sessions`, enrollments, and attendance records
- Referral attribution and manual reward tracking through `referrals`, with delivery reservations in `referralSendAttempts` (separate from `accountInvitations`)

**Authentication Flow**:
- Convex Auth is configured in `convex/auth.ts` and provided to React by `ConvexAuthProvider`
- Use `api.users.current` or the `useCurrentUser()` hook to retrieve the signed-in user
- Backend functions use `getCurrentUser()` / `getCurrentUserOrThrow()` from `convex/users.ts`
- Role-based UI access uses the user `role` field and `RoleGate`; backend functions must enforce authorization independently

**State Management**:
- TanStack Query + Convex Query Client for server state
- Real-time updates via Convex subscriptions
- Global router context exposes `queryClient`; Convex clients are created in `src/lib/query-client.ts`

**Public Account Help**:
- `/account-help` is outside the authenticated shell and is linked beneath signup/login verification and both password-reset code inputs. Authenticated email-change screens are separate.
- Preserve the same-tab return behavior in `shared/account-help.ts`, `src/lib/account-help.ts`, and `useCodeEntryEmail`: only the original email, flow, and allowed authentication return route are stored in session storage with an in-memory fallback. Keep invitation/referral/redirect/account-reset parameters, never passwords or OTP values. Clear context on successful verification or cancellation; editing the help form email must not change the original code-entry email.
- `convex/contact.ts` shares fixed-recipient Resend delivery between authenticated `sendContactMessage` and public `sendAccountHelp`. Do not remove authentication from the former or add account-existence lookup/disclosure to the latter. All public contact information is unverified; existing-account recovery needs independent identity verification using trusted details already on file.
- `convex/contactData.ts` transactionally reserves sending limits before email delivery: 60-second per-email cooldown, five attempts per rolling hour per normalized email, and 30 globally. `accountHelpThrottles` stores hashed email keys and timestamps only. Failed sends count; honeypot submissions are silently discarded without consuming quota. Never accept recipient addresses from visitors.
- Tests in `tests/account-help.test.ts` exercise storage, validation, throttle reservations, fixed-recipient delivery, and authentication with mocked email transport. Do not send live help requests during tests.

**Referral System**:
- Client entry is `/refer`; public invitation links use `/referral/$token`. Admin review lives at `/admin/accounts/$userId?tab=referrals` and must remain directly linkable from notifications.
- `convex/referrals.ts` owns queries, send reservations, and admin decisions; `convex/referralActions.ts` sends email through Resend. Shared policy/constants are in `shared/referrals.ts`; the reward is 5,000 cents.
- Preserve server-side verified-email matching in `convex/lib/referrals.ts`, called from email verification in `convex/auth.ts`, verified email changes in `convex/users.ts`, and invitation creation for existing verified accounts. A referral link is an invitation reference, not an authentication credential. Legacy email arrays alone do not establish which address was verified.
- Attribution is transactional and idempotent: normalize emails, reject self-referrals, reuse same-referrer invitations, preserve the earliest referral for an email, and allow only one referrer per referred account. Reserve send attempts transactionally before external delivery: 10 per referrer per rolling 24 hours and a 60-second recipient cooldown, including failed attempts.
- Credit stays manual: payment for a full month of regular classes is required; trials and prorated partial months alone do not qualify. Existing trial accounts may qualify after admin review. Do not interpret `pending_review` as payment confirmation or add automatic Stripe credits as part of routine referral maintenance.
- Only active members with completed onboarding can send/list their referrals. Enforce admin authorization for decisions and account referral views; keep notes/history out of member responses. Preserve credit confirmation, stale-update checks, idempotent decisions, and correction notes/history when reopening; reopening never reverses billing.
- The deduplicated `referral.connected` event notifies admins through the existing notification/push pipeline when attribution connects, not when an invitation is merely sent. Backend handler and email transport tests are in `tests/referrals.test.ts`; they run with `npm test` without sending real email.

**Component Patterns**:
- All UI components use shadcn/ui from `~/components/ui/`
- Consistent import alias `~/` for `src/` directory
- Theme provider with dark/light mode support
- Sidebar-based layout with responsive design

### File Structure Conventions

```
src/
├── components/        # React components
│   ├── ui/           # shadcn/ui components
│   └── *.tsx         # Feature components
├── routes/           # TanStack Router routes
├── hooks/            # Custom React hooks
├── lib/              # Utilities
└── styles/           # Global CSS

convex/               # Backend functions and schema
├── schema.ts         # Database schema
├── *.ts              # Convex functions (queries/mutations)
├── auth.ts           # Convex Auth providers and flows
└── auth.config.ts    # Convex Auth JWT configuration
```

### Environment Setup

Environment variables:
- `VITE_CONVEX_URL` - Frontend connection to the Convex deployment
- `CONVEX_SITE_URL` - Convex site URL used by auth configuration
- `RESEND_API_KEY` - Convex deployment variable for verification, password reset, and account/referral invitation email
- `ACCESS_APP_URL` - Convex deployment variable containing the public app origin for account/referral invitation links
- `ACCESS_CONTACT_EMAIL` - Convex deployment variable for the studio inbox used by contact and public account-help forms (also requires `RESEND_API_KEY`)

### Development Patterns

**Convex Integration**:
- Use `convexQuery()` wrapper for TanStack Query integration
- Access API via `api` from `convex/_generated/api`
- Real-time data automatically syncs across components

**Component Development**:
- Import UI components from `~/components/ui/`
- Use `useCurrentUser()` for user data and `useAuthActions()` for sign-in/sign-out flows
- Leverage form handling with react-hook-form + zod validation

**Routing**:
- File-based routing in `src/routes/`
- Route context provides the TanStack `queryClient`
- Use `Link` from TanStack Router for navigation
