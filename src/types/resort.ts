import type { Timestamp } from 'firebase/firestore';

export type PaymentStatus = 'pending' | 'deposit' | 'paid';
export type BookingStatus = 'confirmed' | 'cancelled';
export type StaffRole = 'admin' | 'staff';

export const RESORT_ID = 'main';

// Synchronized verbatim with firebase-blueprint.json
export const BLUEPRINT_CONSTRAINTS = {
  RESORT_NAME_MAX: 120,
  RESORT_SUBTITLE_MAX: 160,
  TIME_MAX: 20,
  ROOM_NAME_MAX: 60,
  ROOM_TYPE_MAX: 60,
  ROOM_MAX_ROOMS_PER_BOOKING: 20,
  MEAL_OPTIONS_MAX_COUNT: 30,
  MEAL_OPTION_MAX_LEN: 80,
  MEAL_SETS_MAX: 100,
  MEAL_NOTES_MAX: 500,
  GUEST_NAME_MAX: 120,
  GUEST_PHONE_MAX: 40,
  BOOKING_CHANNEL_MAX: 60,
  SPECIAL_REQUEST_MAX: 1000,
  STAFF_NAME_MAX: 100,
  EMAIL_MAX: 160,
  MAX_NIGHTS_PER_BOOKING: 30,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
} as const;

export const DEFAULT_BREAKFAST_OPTIONS: string[] = [
  'ABF (American Breakfast)',
  'ข้าวต้มทรงเครื่อง',
  'ชุดอาหารเช้าไทย',
];

export const DEFAULT_DINNER_OPTIONS: string[] = [
  'เซ็ตหมูกระทะ',
  'เซ็ตอาหารเย็นพื้นบ้าน',
  'บาร์บีคิวซีฟู้ด',
];

export interface ResortSettings {
  id: string;
  resortName: string;
  resortSubtitle: string;
  checkInTime: string;
  checkOutTime: string;
  breakfastOptions?: string[];
  dinnerOptions?: string[];
  updatedAt?: Timestamp | null;
  updatedByUid: string;
  updatedByName: string;
}

export interface Room {
  id: string;
  resortId: string;
  name: string;
  roomType: string;
  capacity: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  updatedByUid: string;
}

export interface RoomLock {
  id: string;
  resortId: string;
  roomId: string;
  date: string;
  bookingId: string;
}

export interface Booking {
  id: string;
  resortId: string;
  checkIn: string;
  checkOut: string;
  roomIds: string[];
  roomNames: string[];
  mealBreakfastItems?: string[];
  mealDinnerItems?: string[];
  // Legacy optional fields from earlier records for safe UI read fallback
  mealBreakfast?: string;
  mealDinner?: string;
  mealSetsCount: number;
  mealNotes: string;
  extraBed?: boolean;
  extraBedCount?: number;
  guestName: string;
  guestPhone: string;
  bookingChannel: string;
  specialRequest: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp | null;
  updatedByUid: string;
  updatedByName: string;
  updatedAt?: Timestamp | null;
  cancelledByName: string;
}

export interface BookingFormInput {
  checkIn: string;
  checkOut: string;
  roomIds: string[];
  mealBreakfastItems: string[];
  mealDinnerItems: string[];
  mealSetsCount: number;
  mealNotes: string;
  extraBed: boolean;
  extraBedCount: number;
  guestName: string;
  guestPhone: string;
  bookingChannel: string;
  specialRequest: string;
  paymentStatus: PaymentStatus;
}

export interface StaffProfile {
  uid: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CalendarFilters {
  roomId: string; // 'all' or specific roomId
  onlyAvailableDays: boolean;
}

export const BOOKING_CHANNELS = [
  'Line',
  'Facebook',
  'โทรศัพท์',
  'Walk-in',
  'OTA (Agoda / Booking)',
  'อื่นๆ',
] as const;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'รอชำระ',
  deposit: 'มัดจำแล้ว',
  paid: 'ชำระเต็มจำนวน',
};

export const DEFAULT_RESORT_SEED = {
  resortName: 'วิลล่า เวลา รีสอร์ท (Villa Vela Resort)',
  resortSubtitle: 'ระบบจัดการห้องพักและเช็กสถานะห้องว่าง',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  breakfastOptions: DEFAULT_BREAKFAST_OPTIONS,
  dinnerOptions: DEFAULT_DINNER_OPTIONS,
};

export const DEFAULT_ROOMS_SEED: Array<{
  id: string;
  name: string;
  roomType: string;
  capacity: number;
  sortOrder: number;
}> = [
  { id: 'villa-01', name: 'Villa 01', roomType: 'Pool Villa', capacity: 2, sortOrder: 1 },
  { id: 'villa-02', name: 'Villa 02', roomType: 'Pool Villa', capacity: 2, sortOrder: 2 },
  { id: 'villa-03', name: 'Villa 03', roomType: 'Garden Villa', capacity: 2, sortOrder: 3 },
  { id: 'villa-04', name: 'Villa 04', roomType: 'Garden Villa', capacity: 4, sortOrder: 4 },
  { id: 'deluxe-101', name: 'Deluxe 101', roomType: 'Deluxe Room', capacity: 2, sortOrder: 5 },
  { id: 'deluxe-102', name: 'Deluxe 102', roomType: 'Deluxe Room', capacity: 2, sortOrder: 6 },
  { id: 'deluxe-103', name: 'Deluxe 103', roomType: 'Deluxe Room', capacity: 2, sortOrder: 7 },
  { id: 'suite-201', name: 'Suite 201', roomType: 'Family Suite', capacity: 4, sortOrder: 8 },
];

export function getNormalizedBookingMeals(booking: Booking): {
  breakfastItems: string[];
  dinnerItems: string[];
} {
  const breakfastItems = Array.isArray(booking.mealBreakfastItems)
    ? booking.mealBreakfastItems
    : booking.mealBreakfast && booking.mealBreakfast !== 'ไม่รับอาหารเช้า'
      ? [booking.mealBreakfast]
      : [];

  const dinnerItems = Array.isArray(booking.mealDinnerItems)
    ? booking.mealDinnerItems
    : booking.mealDinner && booking.mealDinner !== 'ไม่มีอาหารเย็น'
      ? [booking.mealDinner]
      : [];

  return { breakfastItems, dinnerItems };
}
