# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Verified Staff Gate**: Unauthenticated users and unverified email accounts (`email_verified != true`) cannot read or write any resort, room, booking, lock, or staff records.
2. **Double-Booking Lock Integrity**: A `roomLocks/{roomId}_{date}` document cannot be created without an accompanying confirmed `Booking` document present in the same atomic transaction (`existsAfter`), and cannot be updated in-place.
3. **Immutable Audit Origin**: On `bookings`, `createdByUid`, `createdByName`, and `createdAt` are immutable after creation; `updatedAt` and `createdAt` must strictly equal `request.time`.
4. **Terminal State Lock on Cancelled Bookings**: Once a booking reaches `status == 'cancelled'`, non-admin staff cannot mutate it back to `'confirmed'` or alter its fields.
5. **PII Isolation**: Staff emails stored in `/staff/{uid}/private/info` are readable and writable only by the owning staff member or an admin.
6. **Self-Assigned Role Prevention**: Staff self-registration on `/staff/{uid}` cannot assign `role: 'admin'` unless performed by an existing admin or the bootstrapped owner account.
7. **Strict Key & Size Boundaries**: Every write validates exact required and allowed keys (`hasAll` + `hasOnly`), type checks, regex ID checks (`^[a-zA-Z0-9_\-]+$`), and string/array length limits.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: Request with `auth: null` reading `/bookings` or writing `/rooms`. -> `PERMISSION_DENIED`
2. **Unverified Email Bypass**: Request with `auth: { uid: "u1", token: { email: "staff@resort.com", email_verified: false } }` creating a booking. -> `PERMISSION_DENIED`
3. **Shadow Field Injection on Booking Create**: Payload includes all valid booking fields plus `isApprovedFree: true`. -> `PERMISSION_DENIED`
4. **Client Timestamp Forgery**: Booking create with `createdAt` set to a past timestamp instead of `request.time`. -> `PERMISSION_DENIED`
5. **Identity Spoofing on Audit Fields**: Staff `u2` creates a booking with `createdByUid: "u1"` (another staff member). -> `PERMISSION_DENIED`
6. **Path ID Poisoning**: Creating `/bookings/invalid$$id` or a 500-char document ID. -> `PERMISSION_DENIED`
7. **Self-Privilege Escalation**: Staff `u2` writes `/staff/u2` with `role: "admin"`. -> `PERMISSION_DENIED`
8. **PII Leakage Across Staff**: Staff `u2` attempts `get` on `/staff/u1/private/info`. -> `PERMISSION_DENIED`
9. **Orphaned Room Lock**: Creating `/roomLocks/v1_2026-12-01` referencing a non-existent `bookingId` outside a booking transaction. -> `PERMISSION_DENIED`
10. **In-Place Lock Mutation**: Attempting `update` on `/roomLocks/v1_2026-12-01` to steal a night for another `bookingId`. -> `PERMISSION_DENIED`
11. **Cancelled Booking Resurrection**: Non-admin staff attempting to update a booking whose existing `status == 'cancelled'`. -> `PERMISSION_DENIED`
12. **Array / String Resource Exhaustion**: Sending a 5,000-character `specialRequest` or 25-item `roomIds` array on a booking. -> `PERMISSION_DENIED`
