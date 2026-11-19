import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BLUEPRINT_CONSTRAINTS,
  DEFAULT_BREAKFAST_OPTIONS,
  DEFAULT_DINNER_OPTIONS,
  DEFAULT_RESORT_SEED,
  DEFAULT_ROOMS_SEED,
  RESORT_ID,
  type Booking,
  type BookingFormInput,
  type ResortSettings,
  type Room,
  type StaffProfile,
} from '../types/resort';
import { doDateRangesOverlap, getNightsBetween, getNightsCount } from '../utils/dateUtils';

export class DoubleBookingError extends Error {
  public readonly conflictingRooms: string[];

  constructor(conflictingRooms: string[]) {
    const roomListText = conflictingRooms.join(', ');
    super(`ไม่สามารถบันทึกได้ เนื่องจากห้อง ${roomListText} ถูกจองแล้วในวันที่ดังกล่าว`);
    this.name = 'DoubleBookingError';
    this.conflictingRooms = conflictingRooms;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function sanitizeStringList(items: string[], maxCount: number, maxLen: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const clean = clampString(raw, maxLen);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
      if (result.length >= maxCount) break;
    }
  }
  return result;
}

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getStaffDisplayName(user: User, profile?: StaffProfile | null): string {
  if (profile?.displayName && profile.displayName.trim()) {
    return clampString(profile.displayName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX);
  }
  if (user.displayName && user.displayName.trim()) {
    return clampString(user.displayName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX);
  }
  if (user.email) {
    return clampString(user.email.split('@')[0], BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX);
  }
  return 'พนักงานรีสอร์ท';
}

export async function ensureStaffProfile(
  user: User,
  explicitDisplayName?: string,
): Promise<StaffProfile> {
  const staffRef = doc(db, 'staff', user.uid);
  const privateRef = doc(db, 'staff', user.uid, 'private', 'info');

  try {
    const existingSnap = await getDoc(staffRef);
    const resolvedName = clampString(
      explicitDisplayName || user.displayName || user.email?.split('@')[0] || 'พนักงานรีสอร์ท',
      BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX,
    );

    if (!existingSnap.exists()) {
      const payload = {
        uid: user.uid,
        displayName: resolvedName || 'พนักงานรีสอร์ท',
        role: 'staff' as const,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(staffRef, payload);
    } else if (explicitDisplayName && explicitDisplayName.trim() !== existingSnap.data().displayName) {
      await updateDoc(staffRef, {
        displayName: resolvedName,
        updatedAt: serverTimestamp(),
      });
    }

    if (user.email) {
      const safeEmail = clampString(user.email, BLUEPRINT_CONSTRAINTS.EMAIL_MAX);
      await setDoc(privateRef, {
        email: safeEmail,
        updatedAt: serverTimestamp(),
      });
    }

    const refreshed = await getDoc(staffRef);
    return refreshed.data() as StaffProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff/${user.uid}`);
  }
}

export async function seedInitialResortDataIfEmpty(user: User, staffName: string): Promise<void> {
  const settingsRef = doc(db, 'resortSettings', RESORT_ID);
  try {
    const settingsSnap = await getDocFromServer(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        resortName: clampString(DEFAULT_RESORT_SEED.resortName, BLUEPRINT_CONSTRAINTS.RESORT_NAME_MAX),
        resortSubtitle: clampString(
          DEFAULT_RESORT_SEED.resortSubtitle,
          BLUEPRINT_CONSTRAINTS.RESORT_SUBTITLE_MAX,
        ),
        checkInTime: DEFAULT_RESORT_SEED.checkInTime,
        checkOutTime: DEFAULT_RESORT_SEED.checkOutTime,
        breakfastOptions: DEFAULT_BREAKFAST_OPTIONS,
        dinnerOptions: DEFAULT_DINNER_OPTIONS,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        updatedByName: clampString(staffName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX),
      });
    } else {
      const data = settingsSnap.data();
      if (!Array.isArray(data.breakfastOptions) || !Array.isArray(data.dinnerOptions)) {
        await updateDoc(settingsRef, {
          breakfastOptions: Array.isArray(data.breakfastOptions)
            ? data.breakfastOptions
            : DEFAULT_BREAKFAST_OPTIONS,
          dinnerOptions: Array.isArray(data.dinnerOptions)
            ? data.dinnerOptions
            : DEFAULT_DINNER_OPTIONS,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByName: clampString(staffName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'resortSettings/main');
  }

  try {
    const roomsQuery = query(collection(db, 'rooms'), where('resortId', '==', RESORT_ID));
    const roomsSnap = await getDocsFromServer(roomsQuery);
    if (roomsSnap.empty) {
      const batch = writeBatch(db);
      for (const room of DEFAULT_ROOMS_SEED) {
        const roomRef = doc(db, 'rooms', room.id);
        batch.set(roomRef, {
          resortId: RESORT_ID,
          name: clampString(room.name, BLUEPRINT_CONSTRAINTS.ROOM_NAME_MAX),
          roomType: clampString(room.roomType, BLUEPRINT_CONSTRAINTS.ROOM_TYPE_MAX),
          capacity: room.capacity,
          sortOrder: room.sortOrder,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rooms');
  }
}

export async function saveResortSettings(
  input: Pick<
    ResortSettings,
    'resortName' | 'resortSubtitle' | 'checkInTime' | 'checkOutTime' | 'breakfastOptions' | 'dinnerOptions'
  >,
  user: User,
  staffName: string,
): Promise<void> {
  const resortName = clampString(input.resortName, BLUEPRINT_CONSTRAINTS.RESORT_NAME_MAX);
  if (!resortName) {
    throw new ValidationError('กรุณาระบุชื่อรีสอร์ท');
  }

  const breakfastOptions = sanitizeStringList(
    input.breakfastOptions || DEFAULT_BREAKFAST_OPTIONS,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTIONS_MAX_COUNT,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTION_MAX_LEN,
  );
  const dinnerOptions = sanitizeStringList(
    input.dinnerOptions || DEFAULT_DINNER_OPTIONS,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTIONS_MAX_COUNT,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTION_MAX_LEN,
  );

  const settingsRef = doc(db, 'resortSettings', RESORT_ID);
  try {
    await updateDoc(settingsRef, {
      resortName,
      resortSubtitle: clampString(input.resortSubtitle, BLUEPRINT_CONSTRAINTS.RESORT_SUBTITLE_MAX),
      checkInTime: clampString(input.checkInTime || '14:00', BLUEPRINT_CONSTRAINTS.TIME_MAX),
      checkOutTime: clampString(input.checkOutTime || '12:00', BLUEPRINT_CONSTRAINTS.TIME_MAX),
      breakfastOptions,
      dinnerOptions,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      updatedByName: clampString(staffName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'resortSettings/main');
  }
}

export async function upsertRoom(
  input: {
    name: string;
    roomType: string;
    capacity: number;
    sortOrder: number;
    isActive: boolean;
  },
  user: User,
  existingRoomId?: string,
): Promise<void> {
  const name = clampString(input.name, BLUEPRINT_CONSTRAINTS.ROOM_NAME_MAX);
  const roomType = clampString(input.roomType, BLUEPRINT_CONSTRAINTS.ROOM_TYPE_MAX);
  if (!name) throw new ValidationError('กรุณาระบุชื่อ/หมายเลขห้องพัก');
  if (!roomType) throw new ValidationError('กรุณาระบุประเภทห้องพัก');

  const capacity = Math.max(1, Math.min(20, Math.round(Number(input.capacity) || 2)));
  const sortOrder = Math.max(0, Math.min(1000, Math.round(Number(input.sortOrder) || 0)));

  if (existingRoomId) {
    const roomRef = doc(db, 'rooms', existingRoomId);
    try {
      await updateDoc(roomRef, {
        name,
        roomType,
        capacity,
        sortOrder,
        isActive: Boolean(input.isActive),
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${existingRoomId}`);
    }
  } else {
    const newId = generateSafeId('room');
    const roomRef = doc(db, 'rooms', newId);
    try {
      await setDoc(roomRef, {
        resortId: RESORT_ID,
        name,
        roomType,
        capacity,
        sortOrder,
        isActive: Boolean(input.isActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${newId}`);
    }
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await deleteDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
  }
}

export async function createOrUpdateBookingAtomic(
  input: BookingFormInput,
  rooms: Room[],
  user: User,
  staffName: string,
  editingBooking?: Booking | null,
): Promise<string> {
  if (
    !BLUEPRINT_CONSTRAINTS.DATE_PATTERN.test(input.checkIn) ||
    !BLUEPRINT_CONSTRAINTS.DATE_PATTERN.test(input.checkOut)
  ) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง');
  }
  const nightsCount = getNightsCount(input.checkIn, input.checkOut);
  if (nightsCount <= 0) {
    throw new ValidationError('วันที่ Check-out ต้องมากกว่าวันที่ Check-in อย่างน้อย 1 คืน');
  }
  if (nightsCount > BLUEPRINT_CONSTRAINTS.MAX_NIGHTS_PER_BOOKING) {
    throw new ValidationError(
      `สามารถบันทึกการจองต่อ 1 รายการได้สูงสุด ${BLUEPRINT_CONSTRAINTS.MAX_NIGHTS_PER_BOOKING} คืน`,
    );
  }

  const uniqueRoomIds = Array.from(new Set(input.roomIds)).slice(
    0,
    BLUEPRINT_CONSTRAINTS.ROOM_MAX_ROOMS_PER_BOOKING,
  );
  if (uniqueRoomIds.length === 0) {
    throw new ValidationError('กรุณาเลือกห้องพักอย่างน้อย 1 ห้อง');
  }

  const guestName = clampString(input.guestName, BLUEPRINT_CONSTRAINTS.GUEST_NAME_MAX);
  const guestPhone = clampString(input.guestPhone, BLUEPRINT_CONSTRAINTS.GUEST_PHONE_MAX);
  if (!guestName) throw new ValidationError('กรุณากรอกชื่อลูกค้า');
  if (!guestPhone) throw new ValidationError('กรุณากรอกเบอร์โทรศัพท์ลูกค้า');

  const extraBed = Boolean(input.extraBed);
  const extraBedCount = extraBed ? (input.extraBedCount === 2 ? 2 : 1) : 0;

  const mealBreakfastItems = sanitizeStringList(
    input.mealBreakfastItems,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTIONS_MAX_COUNT,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTION_MAX_LEN,
  );
  const mealDinnerItems = sanitizeStringList(
    input.mealDinnerItems,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTIONS_MAX_COUNT,
    BLUEPRINT_CONSTRAINTS.MEAL_OPTION_MAX_LEN,
  );

  const hasAnyMeals = mealBreakfastItems.length > 0 || mealDinnerItems.length > 0;
  const mealSetsCount = hasAnyMeals
    ? Math.max(0, Math.min(BLUEPRINT_CONSTRAINTS.MEAL_SETS_MAX, Math.round(Number(input.mealSetsCount) || 0)))
    : 0;

  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const roomNames = uniqueRoomIds.map((id) => roomMap.get(id)?.name || id);

  // Authoritative Fresh Server Check against existing confirmed bookings
  try {
    const confirmedQuery = query(
      collection(db, 'bookings'),
      where('resortId', '==', RESORT_ID),
      where('status', '==', 'confirmed'),
    );
    const serverSnapshot = await getDocsFromServer(confirmedQuery);
    const conflictNames = new Set<string>();

    serverSnapshot.forEach((docSnap) => {
      if (editingBooking && docSnap.id === editingBooking.id) return;
      const b = docSnap.data() as Booking;
      if (doDateRangesOverlap(input.checkIn, input.checkOut, b.checkIn, b.checkOut)) {
        for (const rId of uniqueRoomIds) {
          if (b.roomIds.includes(rId)) {
            conflictNames.add(roomMap.get(rId)?.name || rId);
          }
        }
      }
    });

    if (conflictNames.size > 0) {
      throw new DoubleBookingError(Array.from(conflictNames));
    }
  } catch (error) {
    if (error instanceof DoubleBookingError) throw error;
    handleFirestoreError(error, OperationType.LIST, 'bookings');
  }

  // Atomic Firestore Transaction with per-room per-night locks
  const targetBookingId = editingBooking ? editingBooking.id : generateSafeId('bk');
  const bookingRef = doc(db, 'bookings', targetBookingId);

  const newNights = getNightsBetween(input.checkIn, input.checkOut);
  const newLockDescriptors = uniqueRoomIds.flatMap((roomId) =>
    newNights.map((date) => ({
      lockId: `${roomId}_${date}`,
      roomId,
      roomName: roomMap.get(roomId)?.name || roomId,
      date,
    })),
  );

  const oldLockIds = editingBooking
    ? editingBooking.roomIds.flatMap((roomId) =>
        getNightsBetween(editingBooking.checkIn, editingBooking.checkOut).map(
          (date) => `${roomId}_${date}`,
        ),
      )
    : [];
  const newLockIdSet = new Set(newLockDescriptors.map((l) => l.lockId));
  const locksToDelete = oldLockIds.filter((id) => !newLockIdSet.has(id));

  const cleanStaffName = clampString(staffName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX) || 'พนักงานรีสอร์ท';

  try {
    await runTransaction(db, async (transaction) => {
      const conflictRoomsInTx = new Set<string>();
      const locksToCreate: typeof newLockDescriptors = [];

      for (const desc of newLockDescriptors) {
        const lockRef = doc(db, 'roomLocks', desc.lockId);
        const lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists()) {
          const lockData = lockSnap.data();
          if (lockData.bookingId !== targetBookingId) {
            conflictRoomsInTx.add(desc.roomName);
          }
        } else {
          locksToCreate.push(desc);
        }
      }

      if (conflictRoomsInTx.size > 0) {
        throw new DoubleBookingError(Array.from(conflictRoomsInTx));
      }

      const bookingPayload = {
        resortId: RESORT_ID,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        roomIds: uniqueRoomIds,
        roomNames,
        mealBreakfastItems,
        mealDinnerItems,
        mealSetsCount,
        mealNotes: clampString(input.mealNotes, BLUEPRINT_CONSTRAINTS.MEAL_NOTES_MAX),
        extraBed,
        extraBedCount,
        guestName,
        guestPhone,
        bookingChannel: clampString(
          input.bookingChannel || 'Line',
          BLUEPRINT_CONSTRAINTS.BOOKING_CHANNEL_MAX,
        ),
        specialRequest: clampString(
          input.specialRequest,
          BLUEPRINT_CONSTRAINTS.SPECIAL_REQUEST_MAX,
        ),
        paymentStatus: input.paymentStatus,
        status: 'confirmed' as const,
        updatedByUid: user.uid,
        updatedByName: cleanStaffName,
        updatedAt: serverTimestamp(),
        cancelledByName: '',
      };

      if (editingBooking) {
        transaction.update(bookingRef, {
          ...bookingPayload,
          // Clean up any legacy fields if editing a record created prior to schema update
          category: deleteField(),
          mealBreakfast: deleteField(),
          mealDinner: deleteField(),
        });
      } else {
        transaction.set(bookingRef, {
          ...bookingPayload,
          createdByUid: user.uid,
          createdByName: cleanStaffName,
          createdAt: serverTimestamp(),
        });
      }

      for (const lockId of locksToDelete) {
        transaction.delete(doc(db, 'roomLocks', lockId));
      }

      for (const desc of locksToCreate) {
        transaction.set(doc(db, 'roomLocks', desc.lockId), {
          resortId: RESORT_ID,
          roomId: desc.roomId,
          date: desc.date,
          bookingId: targetBookingId,
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    });

    return targetBookingId;
  } catch (error) {
    if (error instanceof DoubleBookingError || error instanceof ValidationError) {
      throw error;
    }
    handleFirestoreError(
      error,
      editingBooking ? OperationType.UPDATE : OperationType.CREATE,
      `bookings/${targetBookingId}`,
    );
  }
}

export async function cancelBookingAtomic(
  booking: Booking,
  user: User,
  staffName: string,
): Promise<void> {
  const bookingRef = doc(db, 'bookings', booking.id);
  const cleanStaffName = clampString(staffName, BLUEPRINT_CONSTRAINTS.STAFF_NAME_MAX) || 'พนักงานรีสอร์ท';
  const lockIds = booking.roomIds.flatMap((roomId) =>
    getNightsBetween(booking.checkIn, booking.checkOut).map((date) => `${roomId}_${date}`),
  );

  try {
    await runTransaction(db, async (transaction) => {
      const existingLockRefs: Array<ReturnType<typeof doc>> = [];
      for (const lockId of lockIds) {
        const ref = doc(db, 'roomLocks', lockId);
        const snap = await transaction.get(ref);
        if (snap.exists() && snap.data().bookingId === booking.id) {
          existingLockRefs.push(ref);
        }
      }

      transaction.update(bookingRef, {
        status: 'cancelled',
        cancelledByName: cleanStaffName,
        updatedByUid: user.uid,
        updatedByName: cleanStaffName,
        updatedAt: serverTimestamp(),
      });

      for (const ref of existingLockRefs) {
        transaction.delete(ref);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
  }
}
