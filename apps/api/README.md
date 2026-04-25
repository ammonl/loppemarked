# apps/api

Backend API application (Node.js/TypeScript).

## Responsibilities

- Public endpoints for status, availability, registration, waitlist.
- Admin endpoints for authentication and management operations.
- Audit event recording and outbound email orchestration.

Must not contain:
- Frontend rendering code.
- Infrastructure provisioning logic.

## Tech Stack

- **Runtime:** Node.js (TypeScript)
- **Database:** PostgreSQL 16 via [Kysely](https://kysely.dev/)
- **Auth:** Argon2id password hashing, HttpOnly session cookies
- **Testing:** Vitest
- **Linting:** ESLint

## Source Structure

```
src/
├── db/
│   ├── connection.ts        Database connection factory
│   ├── index.ts             DB module entry point
│   ├── migrate.ts           Migration runner
│   ├── migrations/          Kysely migration files
│   ├── seed.ts              Seed data (tables, admins, system settings)
│   ├── setup.ts             Combined migrate + seed entry point
│   └── types.ts             Database table type definitions
├── lib/
│   ├── admin-email-templates.ts  Admin notification email templates
│   ├── audit.ts             Audit event recording helpers
│   ├── email-service.ts     SES email delivery service
│   ├── email-templates.ts   Public-facing email templates
│   ├── errors.ts            Typed API error classes
│   ├── logger.ts            Structured JSON logger (Lambda) / text logger (dev)
│   ├── password.ts          Argon2id hashing and verification
│   └── session.ts           Session token generation
├── middleware/
│   └── auth.ts              Admin session authentication middleware
├── routes/
│   ├── admin/
│   │   ├── admins.ts        Admin account CRUD
│   │   ├── audit.ts         Audit timeline retrieval
│   │   ├── auth.ts          Admin login and password change
│   │   ├── registrations.ts Registration management (create, move, remove)
│   │   ├── settings.ts      System settings (opening time)
│   │   └── waitlist.ts      Waitlist assignment
│   ├── health.ts            Health check endpoint
│   └── public.ts            Public status, boxes, register, and waitlist
├── router.ts                Route registration
├── dev-server.ts            Local development HTTP server
├── lambda.ts                AWS Lambda handler entry point
└── index.ts                 Application entry point
```

## Database

Uses [Kysely](https://kysely.dev/) as a type-safe query builder with PostgreSQL.

### Schema

The schema is managed as a single Kysely baseline migration in `src/db/migrations/`:

- `tables` - Numbered flea-market tables in Fælledhuset, with state tracking
- `admins` - Admin accounts
- `admin_credentials` - Hashed admin passwords
- `admin_notification_preferences` - Per-admin opt-in flags for ops emails
- `sessions` - Admin session management
- `system_settings` - Opening datetime configuration
- `registrations` - Table bookings with address normalization
- `waitlist_entries` - Ordered waitlist by apartment
- `emails` - Outbound email log with edit tracking
- `audit_events` - Immutable audit trail (protected by trigger)
- `registration_cancellation_tokens` - Resident self-cancellation magic links

### Key constraints

- One active occupant per table (partial unique index)
- Table state restricted to: available, occupied, reserved
- Table id constrained to the visible Fælledhuset catalog (1–24, with 22 skipped)
- Audit events are immutable (UPDATE/DELETE blocked by trigger)
- Waitlist FIFO ordering by `created_at`

### Seed data

The seed module (`src/db/seed.ts`) populates:
- One row per visible flea-market table, all in the `available` state
- Default opening datetime (2026-04-01 10:00 Europe/Copenhagen)
- Initial admin account(s) from `SEED_ADMIN_EMAILS` (passwords hashed at seed time)

## Scripts

```bash
npm run dev        # Start dev server (port 3001)
npm run build      # Compile TypeScript
npm run test       # Run Vitest tests
npm run lint       # Run ESLint
npm run typecheck  # Type checking
npm run db:setup   # Run migrations + seed (requires DB_PASSWORD)
```
