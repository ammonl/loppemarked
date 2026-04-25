# Data Contract and Invariants

This document captures key data constraints from the product specification.

## Core Entities

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

## Critical Invariants

1. One active occupant per table (partial unique index on `registrations.table_id` where `status = 'active'`).
2. Table states are constrained to:
   - `available`
   - `occupied`
   - `reserved`
3. Waitlist ordering is FIFO by first waitlist timestamp.
4. If an apartment joins waitlist again, preserve earliest timestamp.
5. Every critical mutation writes an immutable `audit_events` row with actor + before/after.

## Address Normalization Rules

- Street must be `Else Alfelts Vej`.
- House number range: 122-202 inclusive.
- Floor + door required for house numbers:
  - 138
  - 144
  - 161-202
- Uniqueness key should include street, house number, floor, and door in normalized form.

## Access Rules

- Public users never see personal registration data.
- Admin users can view and manage personal registration data.
