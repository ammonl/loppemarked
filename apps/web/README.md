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
│   ├── admin/                      Admin routes
│   ├── cancel/                     Resident self-cancel magic-link landing
│   ├── icon.svg                    Favicon
│   ├── layout.tsx                  Root layout with LanguageProvider
│   └── page.tsx                    Main page (pre-open / landing / map routing)
├── components/
│   ├── AdminAccount.tsx                  Admin account management (CRUD, password change)
│   ├── AdminAuditLog.tsx                 Admin audit log viewer
│   ├── AdminDashboard.tsx                Admin dashboard layout with tab navigation and logout
│   ├── AdminLogin.tsx                    Admin login form
│   ├── AdminMessaging.tsx                Admin bulk messaging composer
│   ├── AdminNotificationPreferences.tsx  Admin notification opt-in toggles
│   ├── AdminPage.tsx                     Admin page container and auth gate
│   ├── AdminRegistrations.tsx            Admin registration management
│   ├── AdminSettings.tsx                 Admin system settings (opening time)
│   ├── AdminStagingTools.tsx             Staging-only fill/clear test utilities
│   ├── AdminTables.tsx                   Admin table management panel
│   ├── AdminWaitlist.tsx                 Admin waitlist management
│   ├── AuditTimeline.tsx                 Audit event timeline display
│   ├── BrandLogo.tsx                     UN17 brand logo component
│   ├── DawaAddressInput.tsx              DAWA address autocomplete input
│   ├── HeroScene.tsx                     Layered raster hero composition primitive
│   ├── LandingPage.tsx                   Public landing page (hero + CTA)
│   ├── LanguageSelector.tsx              da/en language toggle
│   ├── LoadingSplash.tsx                 Initial-load splash screen
│   ├── NotificationComposer.tsx          Admin per-action notification composer
│   ├── PreOpenPage.tsx                   Pre-registration info page
│   ├── ProjectAbout.tsx                  Project info / about content
│   ├── RegistrationForm.tsx              Public registration form
│   ├── SortableHeader.tsx                Sortable table column header
│   ├── SwitchConfirmationDialog.tsx      Apartment-switch confirmation dialog
│   ├── TableControls.tsx                 Floor plan zoom/pan controls
│   ├── TableMap.tsx                      Fælledhuset SVG floor plan
│   ├── TableMapPage.tsx                  Full table map view + booking flow
│   ├── WaitlistBanner.tsx                Waitlist status banner
│   ├── WaitlistForm.tsx                  Public waitlist signup form
│   ├── landing/sceneConfig.ts            Landing-page hero asset slot config
│   └── tableStateColors.ts               Shared color constants for table states
├── hooks/
│   ├── useHistoryState.ts          History-aware view state hook
│   └── useTableControls.ts         Floor plan zoom/pan state hook
├── i18n/
│   ├── LanguageProvider.tsx        React context for language state
│   ├── contactLink.tsx             Contact-link helper for translations
│   └── translations.ts             Danish and English translation strings
├── styles/
│   ├── brandLogo.css               Brand logo styles
│   ├── landing.css                 Landing-page styles
│   ├── table-map.css               Floor-plan styles
│   ├── theme.ts                    TypeScript design tokens (colors, shadows)
│   ├── tokens.css                  CSS custom-property design tokens
│   └── tokens.test.ts              TS↔CSS token parity test
└── utils/
    ├── brandEvents.ts              Brand timeline event helpers
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
