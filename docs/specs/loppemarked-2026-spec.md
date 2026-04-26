# UN17 Village Loppemarked Product + Technical Specification

## 1. Overview

### 1.1 Product
- Product name: UN17 Village Loppemarked
- URL: `loppemarked.un17hub.com`
- Season: 2026
- Purpose: allow eligible UN17 residents to register for flea-market tables in
  Fælledhuset for the spring 2026 event, with bilingual Danish/English UX and
  admin management.

### 1.2 Core Requirements
- Public users do not authenticate.
- Admin users authenticate with email + password.
- Only one active table booking per apartment.
- Full audit history for all meaningful data changes.
- Before opening date/time: show info page only.
- After opening: allow table selection and registration.
- If full: waitlist is available with strict ordering.

### 1.3 Initial Registration Opening
- Default opening datetime: `2026-04-01 10:00` in `Europe/Copenhagen`.
- Admins can update opening datetime at any time.

## 2. Roles

### 2.1 Public User
- Can view:
  - opening status
  - hall-level availability counts
  - per-table occupied/free state
  - waitlist status
- Can submit registration or join waitlist.
- Can self-cancel their own booking via a magic link in the confirmation email.
- Cannot view personal info of any registrant.

### 2.2 Admin
- Can view all registrations with personal data.
- Can add, move, remove reservations (override restrictions).
- Can choose if an admin-freed table becomes public or stays reserved.
- Can assign waitlisted users to tables.
- Can update opening datetime.
- Can manage admins (create, delete others, change own password).
- Can trigger notification emails (default ON for admin changes) and edit
  message before sending.

## 3. Table Catalog

The visible Fælledhuset catalog is defined in
`packages/shared/src/constants.ts` (`TABLE_CATALOG`). Table IDs are contiguous
1–24 (24 visible tables). Each entry has a position and a size in meters;
some tables have an adjacent clothing-rack slot.

## 4. Public Experience

### 4.1 Pre-Open Mode
- Shown when current time < opening datetime.
- Displays exact opening datetime in local Danish format and timezone, a short
  explanation of how registration works, eligibility summary, and contact
  emails for support.

### 4.2 Open Mode
- Shown when current time >= opening datetime.
- Landing shows the hero scene and an entry CTA.
- User enters the floor-plan map and inspects each table.

### 4.3 Floor-Plan UI
- 2D floor plan of Fælledhuset showing all visible tables.
- Table state visuals:
  - available
  - occupied
  - reserved (admin-held, not public-selectable)
- Public can only select available tables.

### 4.4 Registration Form Fields
- Name (required)
- Email (required, valid email format)
- Address with Danish address autocomplete/validation (DAWA):
  - street fixed to `Else Alfelts Vej`
  - house number must be 122–202 inclusive
  - floor + door required for 138, 144, and house numbers 161–202; optional
    for other valid numbers
- Language preference captured (`da` or `en`) based on browser default and
  user override.

### 4.5 One Apartment Rule
- Uniqueness key: normalized apartment address.
- If apartment already has an active registration and user submits a new one,
  the UI shows an explicit switch confirmation. On confirm, the old
  registration is deactivated and the new table becomes active; the old table
  is returned to the public pool immediately.

### 4.6 Self-Cancel Policy
- Residents can self-cancel their own booking via a secure magic link sent in
  the registration confirmation email.
  - Link carries a cryptographically random, single-use token stored hashed
    (SHA-256) and expires on a bounded timeline (default 60 days).
  - Confirmation deactivates the booking and parks the table in `reserved`
    state with the label `Awaiting Admin Review` — it is NOT automatically
    returned to the public pool.
  - Admins are notified when a resident self-cancels.

### 4.7 Full Capacity and Waitlist
- If no public tables are available, user can join the waitlist.
- Waitlist ordering is FIFO by initial waitlist timestamp.
- If same apartment joins waitlist again, preserve earliest timestamp.
- Admin assignment from the waitlist removes the assigned entry automatically.

## 5. Eligibility and Validation Rules

- Valid street: `Else Alfelts Vej` only.
- Valid house number range: 122–202 inclusive.
- Apartment identifier required (full normalized key includes floor/door where
  applicable).
- Server-side validation is mandatory; client-side validation mirrors the
  server rules for UX only.

## 6. Admin Experience

- Email + password authentication. Passwords stored as Argon2id hashes.
- Initial admin seed: `ammonl@hotmail.com` (configurable via
  `SEED_ADMIN_EMAILS`).
- Reservation management: create, move, remove. On admin removal, prompt for
  whether to release the table publicly or keep it reserved.
- Waitlist management: view ordered list, assign entry to a chosen table.
- Email on admin changes: toggle defaults to ON; admin can edit default message
  before sending. Emails sent from `loppemarked@un17hub.com` with reply-to
  `ammonl@hotmail.com`.
- Opening-window management: admin UI updates the opening datetime in
  `Europe/Copenhagen`.
- Admin account management: create additional admins, delete others, change
  own password.

## 7. Email Behavior

- From: `loppemarked@un17hub.com`
- Reply-To: `ammonl@hotmail.com`
- Provider: AWS SES
- Email language follows the registration's stored language preference
  (`da` or `en`).
- Confirmation email content:
  - Booked table number and size
  - Inline floor plan SVG with the booked table highlighted
  - Seller guidelines (setup time, attendance, clothing-rack rules, leaving
    the table tidy)
  - Cancellation magic-link button
  - Contact information

## 8. Privacy and Consent

- Form consent copy explains:
  - what data is collected (name, email, apartment address)
  - the purpose (administration of the 2026 event and related communication)
  - retention (operational data and audit history retained for administrative
    traceability)
- Public never sees registrant names/emails/addresses.
- Admin-only views expose personal data.

## 9. Audit and Traceability

- Every create/update/delete/state-change operation on critical entities
  emits an immutable audit event.
- Must-audit operations:
  - registration create/switch/remove/move/self-cancel
  - waitlist add/remove/assign/reorder-preserve decisions
  - table state changes (available/occupied/reserved)
  - opening datetime changes
  - admin account create/delete/password change
  - outbound email events and whether edited before send
- Audit event fields: id, timestamp (UTC), actor type
  (`public`/`admin`/`system`), actor identifier, action type, entity type +
  id, before snapshot (JSON), after snapshot (JSON), reason/notes.
- Recovery is done by creating corrective admin actions, not by mutating
  history rows.

## 10. Data Model

See `docs/data/schema.md` for the database schema. Core tables:
`admins`, `admin_credentials`, `admin_notification_preferences`, `sessions`,
`system_settings`, `tables`, `registrations`, `waitlist_entries`, `emails`,
`audit_events`, `registration_cancellation_tokens`.

Key constraints:
- One active occupant per table where state is occupiable.
- Waitlist uniqueness by apartment key with earliest timestamp preserved.
- Table states: `available`, `occupied`, `reserved`.

## 11. API Surface

See `docs/api/openapi.yaml` for the full OpenAPI schema. Public endpoints
cover status, hall summary, table list, registration, waitlist, and self-
cancel. Admin endpoints cover authentication, registrations, waitlist,
settings, admin accounts, audit log, and email composition.

## 12. AWS Architecture

See `docs/architecture.md` for the full architecture diagram. Stack:
- Next.js web app on AWS Amplify Hosting at `loppemarked.un17hub.com`.
- API Gateway-style Lambda function URL (Node.js/TypeScript) for public and
  admin APIs.
- RDS PostgreSQL 16 for transactional data.
- SES for transactional email; S3 for static assets; Secrets Manager for DB
  credentials and admin seed material; CloudWatch for logs/metrics/alarms.

All persistent AWS resources are managed via Terraform under
`infra/terraform/` with isolated `staging` and `prod` environments.

## 13. Localization

- `da` and `en` across the public site, forms, validation messages, emails,
  and admin messaging defaults.
- Default language follows browser locale; user can switch manually.
- Selected language is persisted in the registration record for follow-up
  communications.

## 14. Design Direction

- Warm, community-focused flea-market look inspired by Fælledhuset.
- 2D floor-plan interactions over photorealistic rendering.
- Components: hero scene with layered imagery, floor-plan map with clickable
  tables, clear state badges and legends.

## 15. Acceptance Criteria

- Pre-open mode blocks registration before configured datetime.
- Open mode allows table selection and valid registration.
- Apartment uniqueness is enforced by normalized address key.
- Switch flow explicitly warns and releases previous table on confirm.
- Public never sees personal data.
- Waitlist preserves earliest timestamp for repeat apartment submissions.
- Admin remove flow offers public vs reserved decision.
- Every critical change appears in audit history with actor and before/after.
- Emails are sent from `loppemarked@un17hub.com` with correct language and
  seller guidelines.
- Admins can create/delete other admins and change own password.
- All persistent AWS resources are defined in Terraform and deployed through
  CI/CD.
- `terraform plan` (or OpenTofu equivalent) is clean after apply in each
  environment.
