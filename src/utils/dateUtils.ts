import type { Timestamp } from 'firebase/firestore';

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

export const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] as const;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(iso: string, days: number): string {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function getNightsCount(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = parseISODate(checkIn).getTime();
  const end = parseISODate(checkOut).getTime();
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/**
 * Returns every night date string in [checkIn, checkOut) (half-open interval).
 * Check-out day is NOT occupied by the departing guest.
 */
export function getNightsBetween(checkIn: string, checkOut: string): string[] {
  const count = getNightsCount(checkIn, checkOut);
  const nights: string[] = [];
  for (let i = 0; i < count; i++) {
    nights.push(addDaysISO(checkIn, i));
  }
  return nights;
}

/**
 * Standard hotel date-range overlap check using half-open intervals [checkIn, checkOut).
 * Returns true if any night overlaps.
 */
export function doDateRangesOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string,
): boolean {
  if (!checkInA || !checkOutA || !checkInB || !checkOutB) return false;
  return checkInA < checkOutB && checkOutA > checkInB;
}

/**
 * Checks whether a single date `dayISO` is occupied by booking [checkIn, checkOut).
 */
export function isDateOccupiedByBooking(dayISO: string, checkIn: string, checkOut: string): boolean {
  return dayISO >= checkIn && dayISO < checkOut;
}

export interface CalendarCell {
  iso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthCalendarCells(year: number, monthIndex: number): CalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const totalDaysInMonth = lastDay.getDate();

  const todayISO = toISODate(new Date());
  const cells: CalendarCell[] = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const dt = new Date(year, monthIndex, -i);
    const iso = toISODate(dt);
    cells.push({
      iso,
      dayNumber: dt.getDate(),
      inCurrentMonth: false,
      isToday: iso === todayISO,
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dt = new Date(year, monthIndex, day);
    const iso = toISODate(dt);
    cells.push({
      iso,
      dayNumber: day,
      inCurrentMonth: true,
      isToday: iso === todayISO,
    });
  }

  // Trailing days to complete week rows (35 or 42 cells)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const needed = 7 - remainder;
    for (let i = 1; i <= needed; i++) {
      const dt = new Date(year, monthIndex + 1, i);
      const iso = toISODate(dt);
      cells.push({
        iso,
        dayNumber: dt.getDate(),
        inCurrentMonth: false,
        isToday: iso === todayISO,
      });
    }
  }

  return cells;
}

export function formatThaiDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  const beYear = y + 543;
  return `${d} ${THAI_MONTHS_SHORT[(m || 1) - 1]} ${beYear}`;
}

export function formatThaiDateLong(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  const beYear = y + 543;
  return `${d} ${THAI_MONTHS[(m || 1) - 1]} ${beYear}`;
}

export function formatThaiTimestamp(ts?: Timestamp | null): string {
  if (!ts) return 'เมื่อสักครู่';
  const dt = ts.toDate();
  const d = dt.getDate();
  const m = THAI_MONTHS_SHORT[dt.getMonth()];
  const beYear = dt.getFullYear() + 543;
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${d} ${m} ${beYear} เวลา ${hh}:${mm} น.`;
}
