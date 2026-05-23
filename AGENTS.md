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
```

Note: No test framework is currently configured - tests show "Error: no test specified".

## Architecture Overview

This is **Access Momentum**, a client information portal built with:

- **Frontend Framework**: TanStack Start (React-based meta-framework)
- **Backend**: Convex (real-time database with serverless functions)
- **Authentication**: Clerk (integrated throughout the app)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: TanStack Router with file-based routing

### Key Architecture Patterns

**Database Schema (convex/schema.ts)**:
- Multi-tenant system with `groups` and `groupMembers`
- Communication via `channels` (public/private) and `messages`
- User roles (`admin`/`user`) with Clerk integration via `externalId`
- Bulletin system for announcements with group targeting
- Reaction system for messages and bulletins

**Authentication Flow**:
- Clerk handles auth, user data synced to Convex `users` table
- User lookup pattern: `api.users.getUserByClerkId({ ClerkId: user.user?.id })`
- Role-based access control through user `role` field

**State Management**:
- TanStack Query + Convex Query Client for server state
- Real-time updates via Convex subscriptions
- Global router context includes `queryClient`, `convexClient`, `convexQueryClient`

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
└── auth.config.ts    # Clerk integration config
```

### Environment Setup

Required environment variables:
- `VITE_CONVEX_URL` - Convex deployment URL
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication
- `CLERK_FRONTEND_API_URL` - For Convex-Clerk integration

### Development Patterns

**Convex Integration**:
- Use `convexQuery()` wrapper for TanStack Query integration
- Access API via `api` from `convex/_generated/api`
- Real-time data automatically syncs across components

**Component Development**:
- Import UI components from `~/components/ui/`
- Use Clerk hooks (`useUser`, `SignedIn`, `SignedOut`) for auth state
- Leverage form handling with react-hook-form + zod validation

**Routing**:
- File-based routing in `src/routes/`
- Route context provides query and Convex clients
- Use `Link` from TanStack Router for navigation