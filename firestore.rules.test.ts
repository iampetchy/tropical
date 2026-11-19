/**
 * Phase 0 TDD Security Rules Verification Specification
 * Covers the 12 "Dirty Dozen" adversarial payloads against DRAFT_firestore.rules.
 *
 * Run with Firebase Emulator Suite when available:
 *   npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export const DIRTY_DOZEN_CASES = [
  {
    id: 1,
    name: 'Unauthenticated Read/Write',
    path: 'bookings/b1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Bypass',
    path: 'bookings/b1',
    operation: 'create',
    auth: { uid: 'staff1', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Booking Create',
    path: 'bookings/b1',
    operation: 'create',
    payloadExtras: { isApprovedFree: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Client Timestamp Forgery',
    path: 'bookings/b1',
    operation: 'create',
    payloadOverride: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Audit Fields',
    path: 'bookings/b1',
    operation: 'create',
    auth: { uid: 'staff2', email_verified: true },
    payloadOverride: { createdByUid: 'staff1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Path ID Poisoning',
    path: 'bookings/invalid$$id',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Self-Privilege Escalation',
    path: 'staff/staff2',
    operation: 'create',
    auth: { uid: 'staff2', email_verified: true },
    payloadOverride: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'PII Leakage Across Staff',
    path: 'staff/staff1/private/info',
    operation: 'get',
    auth: { uid: 'staff2', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Room Lock',
    path: 'roomLocks/villa01_2026-12-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'In-Place Lock Mutation',
    path: 'roomLocks/villa01_2026-12-01',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cancelled Booking Resurrection',
    path: 'bookings/cancelled_b1',
    operation: 'update',
    auth: { uid: 'staff2', email_verified: true },
    payloadOverride: { status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Array / String Resource Exhaustion',
    path: 'bookings/b1',
    operation: 'create',
    payloadOverride: { specialRequestSize: 5000, roomIdsCount: 25 },
    expected: 'PERMISSION_DENIED',
  },
];
