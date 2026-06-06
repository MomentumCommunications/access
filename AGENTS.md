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

**Authentication Flow**:
- Convex Auth is configured in `convex/auth.ts` and provided to React by `ConvexAuthProvider`
- Use `api.users.current` or the `useCurrentUser()` hook to retrieve the signed-in user
- Backend functions use `getCurrentUser()` / `getCurrentUserOrThrow()` from `convex/users.ts`
- Role-based UI access uses the user `role` field and `RoleGate`; backend functions must enforce authorization independently

**State Management**:
- TanStack Query + Convex Query Client for server state
- Real-time updates via Convex subscriptions
- Global router context exposes `queryClient`; Convex clients are created in `src/lib/query-client.ts`

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
- `RESEND_API_KEY` - Convex deployment variable for verification and password reset email

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
