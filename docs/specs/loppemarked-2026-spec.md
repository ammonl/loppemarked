# UN17 Village Loppemarked Product + Technical Specification

## 1. Overview

### 1.1 Product
- Product name: UN17 Village Loppemarked
- URL: `loppemarked.un17hub.com`
- Season: 2026
- Purpose: allow eligible UN17 residents to register for rooftop planter boxes in two greenhouses (Kronen and Søen), with bilingual Danish/English UX and admin management.

### 1.2 Core Requirements
- Public users do not authenticate.
- Admin users authenticate with email + password.
- Only one active planter box per apartment.
- Full audit history for all meaningful data changes.
- Before opening date/time: show info page only.
- After opening: allow box selection and registration.
- If full: waitlist is available with strict ordering.

### 1.3 Initial Registration Opening
- Default opening datetime: `2026-04-01 10:00` in `Europe/Copenhagen`.
- Admins can update opening datetime at any time.

## 2. Roles

### 2.1 Public User
- Can view:
  - opening status
  - greenhouse-level availability counts
  - per-box occupied/free state
  - waitlist status
- Can submit registration or join waitlist.
- Cannot view personal info of any registrant.

### 2.2 Admin
- Can view all registrations with personal data.
- Can add, move, remove reservations (override restrictions).
- Can choose if an admin-freed box becomes public or stays reserved.
- Can assign waitlisted users to boxes.
- Can update opening datetime.
- Can manage admins:
  - create new admins
  - delete other admins (cannot delete self)
  - change own password
- Can trigger notification emails (default ON for admin changes) and edit message before sending.

## 3. Greenhouses and Box Catalog

### 3.1 Greenhouses
- Kronen: local plants, box IDs 1-14
- Søen: local birds, box IDs 15-29

### 3.2 Box Naming and Numbering
- Global numbering must be 1-29, starting at Kronen.

Kronen:
1. Linaria
2. Harebell
3. Stellaria
4. Honeysuckle
5. Daisy
6. Hawthorn
7. Alder
8. Linden
9. Thistle
10. Yarrow
11. Seabuck
12. Anemone
13. Jenny
14. Buttercup

Søen:
15. Robin
16. Mallard
17. Wagtail
18. Greenfinch
19. Blue tit
20. Great tit
21. Mute swan
22. Nuthatch
23. Coot
24. Hooded crow
25. Gray goose
26. Barn swallow
27. Magpie
28. Chaffinch
29. Black bird

### 3.3 Visual Asset Requirement
- Each box card shows:
  - global number
  - name
  - thematic illustration (bird or plant)
- Illustration style target: Audubon-inspired.
- Asset plan: create original custom illustrations (no third-party licensed dependency required for MVP).

## 4. Public Experience

### 4.1 Pre-Open Mode
- Shown when current time < opening datetime.
- Must display:
  - exact opening datetime in local Danish format and timezone
  - short explanation of how registration works
  - eligibility summary
  - contact emails for support

### 4.2 Open Mode
- Shown when current time >= opening datetime.
- Landing shows both greenhouses with:
  - total box count
  - occupied count
  - available count
- User can enter greenhouse view (2D map) and inspect each box.

### 4.3 Greenhouse UI
- 2D map per greenhouse, inspired by provided reference photos.
- Box state visuals:
  - available
  - occupied
  - reserved (admin-held, not public-selectable)
- Public can only select available boxes.

### 4.4 Registration Form Fields
- Name (required)
- Email (required, valid email format)
- Address input with Danish address autocomplete/validation (DAWA):
  - street fixed to `Else Alfelts Vej`
  - house number must be 122-202 inclusive
  - floor/door rules:
    - for 138, 144, and all >160, floor and door are required
    - for other valid numbers, floor/door optional
- Language preference captured (`da` or `en`) based on browser default and user override.

### 4.5 One Apartment Rule
- Uniqueness key: normalized apartment address.
- If apartment already has an active registration and user submits new one:
  - show explicit confirmation that this is a switch, not a second box
  - on confirm:
    - old registration is deactivated
    - newly chosen box becomes active
    - old box becomes publicly available immediately

### 4.6 Unregister Policy
- Residents can self-cancel their own booking via a secure magic link sent in
  the registration confirmation email.
  - Link carries a cryptographically random, single-use token that is stored
    hashed (SHA-256) and expires on a bounded timeline (default 60 days).
  - Link resolves to a public cancellation page that shows the booked table,
    a masked recipient-name hint, and an explanation of the effects before the
    resident confirms.
  - Confirmation deactivates the booking and parks the table in `reserved`
    state with the label `Awaiting Admin Review` — it is NOT automatically
    returned to the public pool.
  - Admins are notified when a resident self-cancels so they can decide
    whether to release the held table publicly (reusing the existing
    admin reserved/release workflow).
- The link is tied to a specific registration and cannot be reused to cancel
  any other booking, guessed, or replayed after use.
- UI still directs users to email organizers for anything outside the
  self-cancellation flow (e.g., help when the link has expired).

### 4.7 Full Capacity and Waitlist
- If no public boxes are available, user can join waitlist.
- Waitlist ordering is FIFO by initial waitlist timestamp.
- If same apartment joins waitlist again, preserve earliest timestamp.
- Admin assignment from waitlist removes assigned entry automatically.

## 5. Eligibility and Validation Rules

### 5.1 Address Eligibility
- Valid street: `Else Alfelts Vej` only.
- Valid house number range: 122-202 inclusive.
- Apartment identifier required (full normalized key includes floor/door).
- Stricter requirement:
  - floor + door mandatory for 138, 144, and house numbers 161-202.

### 5.2 Data Validation
- Server-side validation is mandatory for all rules.
- Client-side validation mirrors server rules for UX only.

## 6. Admin Experience

### 6.1 Admin Authentication
- Email + password.
- Seed initial admin:
  - `ammonl@hotmail.com`
- Initial password stored as hash in DB seed; admins can change own password after first login.

### 6.2 Reservation Management
- Admin can:
  - create reservation for any box and any address (override mode)
  - move reservation between boxes
  - remove reservation
- On admin removal:
  - prompt: make box public now? (default configurable)
  - if no, keep as `reserved` with special reserved label (default: `Admin Hold`) and hidden from public selection

### 6.3 Waitlist Management
- View ordered waitlist.
- Assign waitlist entry to a selected box.
- Assigned entry is automatically removed from waitlist.

### 6.4 Email on Admin Changes
- For add/move/remove, email toggle defaults to ON.
- Admin can edit default message before sending.
- Emails sent from `loppemarked@un17hub.com`.
- Reply-To set to `ammonl@hotmail.com`.

### 6.5 Opening Window Management
- Admin UI allows updating opening datetime.
- All public access gates use this value in `Europe/Copenhagen`.

### 6.6 Admin Account Management
- Admin can create additional admins.
- Admin can delete admins except self.
- Admin can change own password.

## 7. Email Behavior

### 7.1 Sender Setup
- From: `loppemarked@un17hub.com`
- Reply-To: `ammonl@hotmail.com`
- Provider: AWS SES

### 7.2 Language
- Email language follows registration language preference.
- Supported languages: Danish and English.

### 7.3 User Registration Email Content
- Confirmation of accepted registration.
- If switch occurred, include note that prior box was released.
- Include:
  - greenhouse name
  - box number + name
  - greenhouse map with box location highlighted
  - support contacts
  - care guidelines

### 7.4 Required Care Guidelines Block
- Care for your plants through the season.
- Inform admins if you no longer want the box before season end.
- Ask for help when you are away.
- Help others when asked, when possible.
- Join Gardens & Rooftops WhatsApp group:
  - `https://chat.whatsapp.com/FqYOqLLsz98HmDcdsr8a3i`
- Questions should be directed to:
  - `elise7284@gmail.com` (Elise Larson)
  - `lena.filthaut@yahoo.com` (Lena Filthaut)

## 8. Privacy and Consent

### 8.1 Required Form Consent Copy
- Explain collected data:
  - name, email, apartment address, registration and waitlist records
- Explain purpose:
  - administration of 2026 planter box season
  - communication regarding registration changes
- Explain retention:
  - operational data and audit history retained for administrative traceability
- Link contact emails for data questions:
  - `elise7284@gmail.com`
  - `lena.filthaut@yahoo.com`

### 8.2 Data Visibility
- Public never sees registrant names/emails/addresses.
- Admin-only views expose personal data.

## 9. Audit and Traceability

### 9.1 Audit Requirement
- Every create/update/delete/change-state operation on critical entities must emit immutable audit event.

### 9.2 Must-Audit Operations
- registration create/switch/remove/move
- waitlist add/remove/assign/reorder-preserve decisions
- box state changes (available/occupied/reserved)
- opening datetime changes
- admin account create/delete/password change
- outbound email events and whether edited before send

### 9.3 Audit Event Fields
- event ID
- timestamp (UTC)
- actor type (`public`, `admin`, `system`)
- actor identifier (admin ID or derived context)
- action type
- entity type + entity ID
- before snapshot (JSON)
- after snapshot (JSON)
- reason/notes (optional)

### 9.4 Recovery Support
- Admin UI must include timeline/history view.
- Manual restore is done by creating corrective admin actions, not by mutating history rows.

## 10. Data Model (Logical)

### 10.1 Core Tables
- `admins`
- `admin_credentials`
- `admin_notification_preferences`
- `sessions`
- `system_settings`
- `tables`
- `registrations`
- `waitlist_entries`
- `emails`
- `audit_events`
- `registration_cancellation_tokens`

### 10.2 Key Constraints
- One active occupant per table where table state is occupiable.
- Waitlist uniqueness by apartment key with earliest timestamp preserved.
- Table states:
  - `available`
  - `occupied`
  - `reserved`

## 11. API Surface (High Level)

### 11.1 Public
- `GET /public/status` (open/closed, opening datetime)
- `GET /public/hall` (aggregate hall counts)
- `GET /public/tables` (public-safe table state)
- `POST /public/register`
- `POST /public/waitlist`

### 11.2 Admin
- `POST /admin/auth/login`
- `POST /admin/auth/change-password`
- `GET /admin/registrations`
- `POST /admin/registrations`
- `POST /admin/registrations/move`
- `POST /admin/registrations/remove`
- `POST /admin/waitlist/assign`
- `PATCH /admin/settings/opening-time`
- `POST /admin/admins`
- `DELETE /admin/admins/:id`
- `GET /admin/audit`

## 12. AWS Architecture (Recommended MVP)

### 12.1 Frontend
- Next.js web app deployed to AWS Amplify Hosting.
- Domain mapping for `loppemarked.un17hub.com`.

### 12.2 Backend
- API Gateway + Lambda (Node.js/TypeScript) for public/admin APIs.
- RDS PostgreSQL (or Aurora Serverless v2 Postgres) for transactional data.

### 12.3 Supporting Services
- SES for transactional emails.
- S3 for static map assets and generated email map images.
- Secrets Manager for DB creds, admin seed secret material.
- CloudWatch logs/metrics + alarms.

### 12.4 Security Controls
- Password hashing: Argon2id or bcrypt with strong cost factor.
- HttpOnly secure session cookies for admin auth.
- Least-privilege IAM for Lambda and SES.
- Server-side authorization on all admin routes.

### 12.5 Infrastructure as Code (Mandatory)
- All AWS infrastructure is managed as code only (no manual console provisioning for persistent resources).
- IaC tool: Terraform (OpenTofu-compatible HCL).
- Resource lifecycle policy:
  - create/update/delete through IaC pipelines only
  - emergency console changes allowed only for break-glass incidents and must be back-ported to IaC same day

### 12.6 IaC State and Environments
- Remote state backend:
  - S3 bucket for Terraform state
  - DynamoDB table for state locking
  - state versioning enabled
- Environments:
  - `prod` (live at `loppemarked.un17hub.com`)
  - `staging` (pre-release verification)
- Each environment uses isolated state and isolated app/database resources.

### 12.7 IaC Module Scope
- Core network and security:
  - VPC, subnets, security groups, IAM roles/policies
- Data:
  - RDS/Aurora cluster, parameter groups, backups, subnet groups
- API runtime:
  - Lambda functions, API Gateway routes/stages, CloudWatch log groups
- Web hosting:
  - Amplify app, branches, domain association
- Messaging:
  - SES identities/configuration sets
- Storage/secrets:
  - S3 buckets (assets/email maps), Secrets Manager secrets
- DNS/TLS:
  - Route 53 records, ACM certificates (region-appropriate)

### 12.8 IaC Delivery Pipeline
- CI/CD must run `fmt`, `validate`, and `plan` on pull requests.
- Production `apply` runs automatically after staging succeeds.
- Deployments authenticate to AWS via GitHub OIDC role assumption (no long-lived AWS keys in CI).
- Drift detection job runs on a schedule and reports non-empty plans.

### 12.9 IaC Tagging and Naming
- All resources must have consistent tags:
  - `project=loppemarked`
  - `season=2026`
  - `environment=<env>`
  - `managed_by=terraform`
- Naming must be deterministic and environment-scoped.

## 13. Localization

### 13.1 Languages
- `da` and `en` across:
  - public site
  - forms + validation messages
  - emails
  - admin messaging defaults

### 13.2 Language Selection
- Default from browser locale.
- User can switch manually.
- Selected language persisted in registration record for follow-up communications.

## 14. Design Direction

### 14.1 Visual Intent
- Warm, community-focused rooftop-garden look.
- Inspired by UN17 Village architecture and greenhouse atmosphere.
- 2D map interactions over photorealistic rendering.

### 14.2 Components
- Greenhouse cards with occupancy progress.
- Map with clickable planter boxes.
- Box card with number, name, and custom illustration.
- Clear state badges and legends.

## 15. Implementation Phases

### Phase 0: IaC Foundation
- Create IaC repository structure (`infra/` modules + environment stacks).
- Bootstrap Terraform backend (S3 state + DynamoDB lock).
- Configure GitHub OIDC roles and CI workflow for plan/apply.
- Provision baseline AWS resources via IaC only.

### Phase 1: Application Foundation
- Repo scaffolding and app CI
- DB schema + migrations
- Seed data:
  - flea-market tables (Fælledhuset catalog)
  - initial admins
  - default opening datetime
- Basic public read endpoints

### Phase 2: Public Registration
- Greenhouse pages + 2D maps
- Address validation integration (DAWA)
- Registration flow + switch confirmation
- Confirmation emails with care guidelines

### Phase 3: Waitlist + Admin
- Waitlist logic and UI
- Admin authentication and dashboard
- Reservation add/move/remove with optional email editor
- Admin account management

### Phase 4: Hardening
- Full audit timeline UI
- Localization completeness review
- Accessibility pass
- Operational alerts and backup checks
- IaC drift monitoring and disaster-recovery restore drill

## 16. Acceptance Criteria

- Pre-open mode blocks registration before configured datetime.
- Open mode allows box selection and valid registration.
- Apartment uniqueness is enforced by normalized address key.
- Switch flow explicitly warns and releases previous box on confirm.
- Public never sees personal data.
- Waitlist preserves earliest timestamp for repeat apartment submissions.
- Admin remove flow offers public vs reserved decision.
- Every critical change appears in audit history with actor and before/after.
- Emails are sent from `loppemarked@un17hub.com` with correct language and care guidelines.
- Admins can create/delete other admins and change own password.
- All persistent AWS resources are defined in Terraform and deployed through CI/CD.
- `terraform plan` (or OpenTofu equivalent) is clean after apply in each environment.
