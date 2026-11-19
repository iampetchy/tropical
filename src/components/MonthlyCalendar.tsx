import React, { useMemo, useState } from 'react';
import {
  BedDouble,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  Plus,
  Utensils,
} from 'lucide-react';
import {
  getNormalizedBookingMeals,
  type Booking,
  type CalendarFilters,
  type Room,
  type RoomLock,
} from '../types/resort';
import {
  formatThaiDateLong,
  getMonthCalendarCells,
  isDateOccupiedByBooking,
  THAI_MONTHS,
  THAI_WEEKDAYS_SHORT,
  toISODate,
} from '../utils/dateUtils';

interface MonthlyCalendarProps {
  isAuthenticated: boolean;
  rooms: Room[];
  roomLocks: RoomLock[];
  bookings: Booking[];
  onQuickBook: (dateISO: string, preselectedRoomId?: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onRequireLogin: (reason: string) => void;
}

interface RoomDayStatus {
  room: Room;
  isBooked: boolean;
  booking: Booking | null;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  isAuthenticated,
  rooms,
  roomLocks,
  bookings,
  onQuickBook,
  onSelectBooking,
  onRequireLogin,
}) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedMobileDay, setSelectedMobileDay] = useState<string>(toISODate(now));

  const [filters, setFilters] = useState<CalendarFilters>({
    roomId: 'all',
    onlyAvailableDays: false,
  });

  const activeRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rooms],
  );

  const visibleRooms = useMemo(() => {
    if (filters.roomId === 'all') return activeRooms;
    return activeRooms.filter((r) => r.id === filters.roomId);
  }, [activeRooms, filters.roomId]);

  const confirmedBookings = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed'),
    [bookings],
  );

  // Fast lookup set of locked "roomId_YYYY-MM-DD" for public Landing Page availability
  const lockKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const lock of roomLocks) {
      set.add(`${lock.roomId}_${lock.date}`);
    }
    return set;
  }, [roomLocks]);

  const cells = useMemo(
    () => getMonthCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const dayDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        statuses: RoomDayStatus[];
        availableCount: number;
        bookedCount: number;
      }
    >();

    for (const cell of cells) {
      const roomBookingLookup = new Map<string, Booking>();
      if (isAuthenticated) {
        const bookingsOnDay = confirmedBookings.filter((b) =>
          isDateOccupiedByBooking(cell.iso, b.checkIn, b.checkOut),
        );
        for (const b of bookingsOnDay) {
          for (const rId of b.roomIds) {
            roomBookingLookup.set(rId, b);
          }
        }
      }

      const statuses: RoomDayStatus[] = visibleRooms.map((room) => {
        const booking = roomBookingLookup.get(room.id) || null;
        const isLocked = lockKeySet.has(`${room.id}_${cell.iso}`);
        return {
          room,
          isBooked: Boolean(booking) || isLocked,
          booking,
        };
      });

      const availableCount = statuses.filter((s) => !s.isBooked).length;
      const bookedCount = statuses.length - availableCount;

      map.set(cell.iso, {
        statuses,
        availableCount,
        bookedCount,
      });
    }

    return map;
  }, [cells, confirmedBookings, visibleRooms, lockKeySet, isAuthenticated]);

  const todayISO = toISODate(now);
  const todayStats = useMemo(() => {
    const bookedIds = new Set<string>();
    for (const lock of roomLocks) {
      if (lock.date === todayISO) bookedIds.add(lock.roomId);
    }
    if (isAuthenticated) {
      for (const b of confirmedBookings) {
        if (isDateOccupiedByBooking(todayISO, b.checkIn, b.checkOut)) {
          for (const rId of b.roomIds) bookedIds.add(rId);
        }
      }
    }
    const bookedCount = activeRooms.filter((r) => bookedIds.has(r.id)).length;
    const availableCount = Math.max(0, activeRooms.length - bookedCount);
    return {
      total: activeRooms.length,
      available: availableCount,
      booked: bookedCount,
    };
  }, [activeRooms, confirmedBookings, roomLocks, todayISO, isAuthenticated]);

  const monthAvailabilitySummary = useMemo(() => {
    const currentMonthCells = cells.filter((c) => c.inCurrentMonth);
    let daysWithAvailability = 0;
    for (const c of currentMonthCells) {
      const info = dayDataMap.get(c.iso);
      if (info && info.availableCount > 0) {
        daysWithAvailability += 1;
      }
    }
    return {
      totalDays: currentMonthCells.length,
      daysWithAvailability,
    };
  }, [cells, dayDataMap]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelectedMobileDay(toISODate(t));
  };

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 1, base, base + 1, base + 2];
  }, []);

  const mobileDayInfo = dayDataMap.get(selectedMobileDay) || {
    statuses: visibleRooms.map((room) => ({ room, isBooked: false, booking: null })),
    availableCount: visibleRooms.length,
    bookedCount: 0,
  };

  const handleAvailableRoomClick = (dateISO: string, roomId?: string) => {
    if (!isAuthenticated) {
      onRequireLogin('กรุณาเข้าสู่ระบบทีมงานก่อนบันทึกการจองห้องพักใหม่');
      return;
    }
    onQuickBook(dateISO, roomId);
  };

  const handleBookedRoomClick = (booking: Booking | null) => {
    if (!isAuthenticated) {
      onRequireLogin('กรุณาเข้าสู่ระบบทีมงานเพื่อดูรายละเอียดผู้เข้าพักและแก้ไขการจอง');
      return;
    }
    if (booking) {
      onSelectBooking(booking);
    }
  };

  return (
    <div className="space-y-4">
      {/* Snapshot Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">
            ห้องว่างวันนี้ ({formatThaiDateLong(todayISO)})
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {todayStats.available}
            <span className="text-sm font-normal text-slate-500"> / {todayStats.total} ห้อง</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">ห้องถูกจองวันนี้</div>
          <div className="text-2xl font-bold text-rose-700 tabular-nums">
            {todayStats.booked}
            <span className="text-sm font-normal text-slate-500"> ห้อง</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">
            วันที่ยังมีห้องว่างในเดือน{THAI_MONTHS[viewMonth]}
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {monthAvailabilitySummary.daysWithAvailability}
            <span className="text-sm font-normal text-slate-500">
              {' '}
              / {monthAvailabilitySummary.totalDays} วัน
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Controls & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Month / Year Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="เดือนก่อนหน้า"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className="min-h-[38px] px-3 text-xs font-semibold text-slate-700 hover:bg-white rounded-md transition-colors whitespace-nowrap"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="เดือนถัดไป"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <select
              aria-label="เลือกเดือน"
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {THAI_MONTHS.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="เลือกปี"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  พ.ศ. {yr + 543} ({yr})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>ตัวกรอง:</span>
            </div>

            <select
              aria-label="กรองตามห้องพัก"
              value={filters.roomId}
              onChange={(e) => setFilters((f) => ({ ...f, roomId: e.target.value }))}
              className="min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">ทุกห้องพัก ({activeRooms.length} ห้อง)</option>
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  เฉพาะ {r.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, onlyAvailableDays: !f.onlyAvailableDays }))
              }
              className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                filters.onlyAvailableDays
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {filters.onlyAvailableDays ? 'กำลังแสดงเฉพาะวันที่มีห้องว่าง' : 'เฉพาะวันที่มีห้องว่าง'}
            </button>
          </div>
        </div>

        {/* Status Legend */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-400 inline-block" />
              <span>ห้องว่าง (พร้อมจอง)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-400 inline-block" />
              <span>ห้องถูกจองแล้ว</span>
            </div>
          </div>

          {!isAuthenticated && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              เข้าสู่ระบบพนักงานเพื่อบันทึกรายละเอียดหรือแก้ไขการจอง
            </span>
          )}
        </div>
      </div>

      {/* DESKTOP VIEW: Full Monthly Grid */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {THAI_WEEKDAYS_SHORT.map((dayLabel, idx) => (
            <div
              key={dayLabel}
              className={`py-2.5 px-3 text-xs font-semibold text-center border-r last:border-r-0 border-slate-200 ${
                idx === 0 || idx === 6 ? 'text-rose-700' : 'text-slate-700'
              }`}
            >
              {dayLabel}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const info = dayDataMap.get(cell.iso)!;
            const dimmedByAvailabilityFilter =
              filters.onlyAvailableDays && info.availableCount === 0;

            return (
              <div
                key={cell.iso}
                className={`min-h-[160px] border-r border-b border-slate-200 p-2 flex flex-col transition-opacity ${
                  cell.inCurrentMonth ? 'bg-white' : 'bg-slate-50/70'
                } ${dimmedByAvailabilityFilter ? 'opacity-30' : 'opacity-100'}`}
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-md tabular-nums ${
                        cell.isToday
                          ? 'bg-teal-700 text-white'
                          : cell.inCurrentMonth
                            ? 'text-slate-900'
                            : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        info.availableCount > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {info.availableCount > 0
                        ? `ว่าง ${info.availableCount}/${visibleRooms.length}`
                        : 'เต็ม'}
                    </span>
                  </div>

                  {info.availableCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAvailableRoomClick(cell.iso)}
                      title={`บันทึกการจองวันที่ ${cell.iso}`}
                      className="p-1 rounded hover:bg-teal-50 text-slate-400 hover:text-teal-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Room Status List */}
                <div className="space-y-1 flex-1">
                  {info.statuses.map(({ room, isBooked, booking }) => {
                    if (!isBooked) {
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => handleAvailableRoomClick(cell.iso, room.id)}
                          className="w-full px-1.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium flex items-center justify-between gap-1 text-left transition-colors"
                        >
                          <span className="truncate">{room.name}</span>
                          <span className="text-[10px] text-emerald-700 shrink-0">ว่าง</span>
                        </button>
                      );
                    }

                    const meals = booking ? getNormalizedBookingMeals(booking) : null;
                    const hasMeals = meals
                      ? meals.breakfastItems.length > 0 || meals.dinnerItems.length > 0
                      : false;
                    const hasExtraBed = Boolean(booking?.extraBed);

                    return (
                      <button
                        key={`${room.id}-${booking?.id || cell.iso}`}
                        type="button"
                        onClick={() => handleBookedRoomClick(booking)}
                        title={
                          booking
                            ? `${room.name} · ${booking.guestName}`
                            : `${room.name} · ถูกจองแล้ว`
                        }
                        className="w-full px-1.5 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 text-[11px] text-left transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1 font-semibold">
                          <span className="truncate">{room.name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium shrink-0 text-rose-700">
                            {hasMeals && <Utensils className="w-2.5 h-2.5 text-orange-600" />}
                            {hasExtraBed && <BedDouble className="w-2.5 h-2.5 text-rose-700" />}
                            <span>จองแล้ว</span>
                          </span>
                        </div>
                        {booking && (
                          <div className="text-[10px] opacity-80 truncate">
                            {booking.guestName}
                            {hasExtraBed ? ` · +${booking.extraBedCount || 1} เตียง` : ''}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE VIEW: Compact Month Picker + Full Day Agenda */}
      <div className="md:hidden space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {THAI_WEEKDAYS_SHORT.map((dayLabel, idx) => (
              <div
                key={dayLabel}
                className={`text-[11px] font-semibold text-center py-1 ${
                  idx === 0 || idx === 6 ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const info = dayDataMap.get(cell.iso)!;
              const isSelected = selectedMobileDay === cell.iso;
              const dimmed = filters.onlyAvailableDays && info.availableCount === 0;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedMobileDay(cell.iso)}
                  className={`min-h-[52px] rounded-lg border p-1 flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : cell.inCurrentMonth
                        ? 'bg-white border-slate-200 text-slate-900'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                  } ${dimmed ? 'opacity-30' : ''}`}
                >
                  <span className="text-xs font-bold tabular-nums">{cell.dayNumber}</span>
                  <span
                    className={`text-[10px] font-medium tabular-nums mt-0.5 ${
                      isSelected
                        ? 'text-teal-100'
                        : info.availableCount > 0
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                    }`}
                  >
                    {info.availableCount > 0 ? `ว่าง ${info.availableCount}` : 'เต็ม'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Room Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-700" />
                <span>สถานะห้องพักประจำวัน</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {formatThaiDateLong(selectedMobileDay)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleAvailableRoomClick(selectedMobileDay)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              จองวันนี้
            </button>
          </div>

          <div className="space-y-2">
            {mobileDayInfo.statuses.map(({ room, isBooked, booking }) => {
              if (!isBooked) {
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleAvailableRoomClick(selectedMobileDay, room.id)}
                    className="w-full min-h-[52px] p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-emerald-950">{room.name}</div>
                      <div className="text-xs text-emerald-700">
                        {room.roomType} · ว่าง พร้อมขาย
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">
                      + จองห้องนี้
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={`${room.id}-${booking?.id || selectedMobileDay}`}
                  type="button"
                  onClick={() => handleBookedRoomClick(booking)}
                  className="w-full min-h-[56px] p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-950 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{room.name}</span>
                      <span className="text-xs font-medium text-rose-700 shrink-0">· จองแล้ว</span>
                    </div>
                    {booking ? (
                      <div className="text-xs opacity-80 truncate mt-0.5">
                        ผู้เข้าพัก: {booking.guestName}
                        {booking.extraBed ? ` · เตียงเสริม ${booking.extraBedCount || 1} เตียง` : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-rose-700 mt-0.5">
                        ไม่ว่าง (เข้าสู่ระบบพนักงานเพื่อดูรายละเอียด)
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold shrink-0 underline underline-offset-2">
                    {isAuthenticated ? 'ดูรายละเอียด' : 'เข้าสู่ระบบ'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
