# apps/web

Next.js 15 frontend application (React 19, App Router).

## Responsibilities

- Public registration experience (Fælledhuset table map, table selection, registration form).
- Admin dashboard experience.
- Bilingual UI (`da`, `en`) with browser-default detection and manual switching.
- Pre-open mode (blocks registration before configured opening datetime).

Must not contain:
- Direct database access.
- AWS provisioning logic.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **React:** 19
- **Styling:** Inline styles (no CSS framework)
- **Testing:** Vitest
- **Linting:** ESLint

## Source Structure

```
src/
├── app/
│   ├── layout.tsx                  Root layout with LanguageProvider
│   ├── page.tsx                    Main page (pre-open / landing / map routing)
│   └── page.test.tsx               Integration tests
├── components/
│   ├── AdminAccount.tsx            Admin account management (CRUD, password change)
│   ├── AdminAuditLog.tsx           Admin audit log viewer
│   ├── AdminTables.tsx             Admin table management panel
│   ├── AdminDashboard.tsx          Admin dashboard layout with tab navigation and logout
│   ├── AdminLogin.tsx              Admin login form
│   ├── AdminPage.tsx               Admin page container and auth gate
│   ├── AdminRegistrations.tsx      Admin registration management
│   ├── AdminSettings.tsx           Admin system settings (opening time)
│   ├── AdminWaitlist.tsx           Admin waitlist management
│   ├── AuditTimeline.tsx           Audit event timeline display
│   ├── tableStateColors.ts         Shared color constants for table states
│   ├── DawaAddressInput.tsx        DAWA address autocomplete input
│   ├── LandingPage.tsx             Public landing page (hero + CTA)
│   ├── LanguageSelector.tsx        da/en language toggle
│   ├── PreOpenPage.tsx             Pre-registration info page
│   ├── RegistrationForm.tsx        Public registration form
│   ├── SwitchConfirmationDialog.tsx Apartment-switch confirmation dialog
│   ├── TableMap.tsx                Fælledhuset SVG floor plan
│   ├── TableMapPage.tsx            Full table map view + booking flow
│   ├── WaitlistBanner.tsx          Waitlist status banner
│   └── WaitlistForm.tsx            Public waitlist signup form
├── i18n/
│   ├── LanguageProvider.tsx        React context for language state
│   └── translations.ts            Danish and English translation strings
└── utils/
    ├── formatDate.ts               Date formatting with Europe/Copenhagen timezone
    └── opening.ts                  Opening datetime comparison helper
```

## Scripts

```bash
npm run dev        # Start Next.js dev server (port 3000)
npm run build      # Production build
npm run test       # Run Vitest tests
npm run lint       # Run ESLint
npm run typecheck  # TypeScript type checking
```
