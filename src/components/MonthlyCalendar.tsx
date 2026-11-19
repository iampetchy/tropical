import React, { useMemo, useState } from 'react';
import {
  BedDouble,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Utensils,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  type Booking,
  type CalendarFilters,
  type Room,
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
  rooms: Room[];
  bookings: Booking[];
  onQuickBook: (dateISO: string, preselectedRoomId?: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

interface RoomDayStatus {
  room: Room;
  booking: Booking | null;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  rooms,
  bookings,
  onQuickBook,
  onSelectBooking,
}) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedMobileDay, setSelectedMobileDay] = useState<string>(toISODate(now));

  const [filters, setFilters] = useState<CalendarFilters>({
    roomId: 'all',
    onlyAvailableDays: false,
    category: 'all',
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

  const cells = useMemo(
    () => getMonthCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Pre-compute room statuses for every visible calendar date
  const dayDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        statuses: RoomDayStatus[];
        availableCount: number;
        bookedCount: number;
        roomWithMealCount: number;
      }
    >();

    for (const cell of cells) {
      const bookingsOnDay = confirmedBookings.filter((b) =>
        isDateOccupiedByBooking(cell.iso, b.checkIn, b.checkOut),
      );

      const roomBookingLookup = new Map<string, Booking>();
      for (const b of bookingsOnDay) {
        for (const rId of b.roomIds) {
          roomBookingLookup.set(rId, b);
        }
      }

      const statuses: RoomDayStatus[] = visibleRooms.map((room) => ({
        room,
        booking: roomBookingLookup.get(room.id) || null,
      }));

      const availableCount = statuses.filter((s) => s.booking === null).length;
      const bookedCount = statuses.length - availableCount;
      const roomWithMealCount = statuses.filter(
        (s) => s.booking?.category === 'room_with_meal',
      ).length;

      map.set(cell.iso, {
        statuses,
        availableCount,
        bookedCount,
        roomWithMealCount,
      });
    }

    return map;
  }, [cells, confirmedBookings, visibleRooms]);

  const todayISO = toISODate(now);
  const todayStats = useMemo(() => {
    const bookingsToday = confirmedBookings.filter((b) =>
      isDateOccupiedByBooking(todayISO, b.checkIn, b.checkOut),
    );
    const bookedRoomIds = new Set<string>();
    let mealBookingsToday = 0;
    for (const b of bookingsToday) {
      if (b.category === 'room_with_meal') mealBookingsToday += 1;
      for (const rId of b.roomIds) bookedRoomIds.add(rId);
    }
    const bookedCount = activeRooms.filter((r) => bookedRoomIds.has(r.id)).length;
    const availableCount = Math.max(0, activeRooms.length - bookedCount);
    return {
      total: activeRooms.length,
      available: availableCount,
      booked: bookedCount,
      mealBookingsToday,
    };
  }, [activeRooms, confirmedBookings, todayISO]);

  // Month summary: how many days in current month have available rooms
  const monthAvailabilitySummary = useMemo(() => {
    const currentMonthCells = cells.filter((c) => c.inCurrentMonth);
    let daysWithAvailability = 0;
    let totalRoomNightsAvailable = 0;
    for (const c of currentMonthCells) {
      const info = dayDataMap.get(c.iso);
      if (info && info.availableCount > 0) {
        daysWithAvailability += 1;
        totalRoomNightsAvailable += info.availableCount;
      }
    }
    return {
      totalDays: currentMonthCells.length,
      daysWithAvailability,
      totalRoomNightsAvailable,
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
    statuses: visibleRooms.map((room) => ({ room, booking: null })),
    availableCount: visibleRooms.length,
    bookedCount: 0,
    roomWithMealCount: 0,
  };

  return (
    <div className="space-y-4">
      {/* Today & Month Availability Snapshot Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">ห้องว่างวันนี้ ({formatThaiDateLong(todayISO)})</div>
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
          <div className="text-xs text-slate-500 mb-1">บุ๊กกิ้งรวมอาหารวันนี้</div>
          <div className="text-2xl font-bold text-orange-700 tabular-nums">
            {todayStats.mealBookingsToday}
            <span className="text-sm font-normal text-slate-500"> รายการ</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">
            วันที่ขายได้ในเดือน{THAI_MONTHS[viewMonth]}
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

            <select
              aria-label="กรองตาม Category การจอง"
              value={filters.category}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  category: e.target.value as CalendarFilters['category'],
                }))
              }
              className="min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">ทุกสถานะและ Category</option>
              <option value="room_only">เฉพาะจอง: ห้องอย่างเดียว</option>
              <option value="room_with_meal">เฉพาะจอง: ห้อง+อาหาร</option>
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
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-400 inline-block" />
            <span>ห้องว่าง (คลิกเพื่อจองได้ทันที)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-rose-600" />
            <span>จองแล้ว: ห้องอย่างเดียว</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-orange-600" />
            <span>จองแล้ว: ห้อง+อาหาร</span>
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW: Full Monthly Grid */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Weekday Header */}
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

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const info = dayDataMap.get(cell.iso)!;
            const dimmedByAvailabilityFilter =
              filters.onlyAvailableDays && info.availableCount === 0;

            const filteredStatuses = info.statuses.filter((s) => {
              if (filters.category === 'all') return true;
              return s.booking?.category === filters.category;
            });

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
                      onClick={() => onQuickBook(cell.iso)}
                      title={`บันทึกการจองวันที่ ${cell.iso}`}
                      className="p-1 rounded hover:bg-teal-50 text-slate-400 hover:text-teal-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Room Status List */}
                <div className="space-y-1 flex-1">
                  {filteredStatuses.map(({ room, booking }) => {
                    if (!booking) {
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => onQuickBook(cell.iso, room.id)}
                          className="w-full px-1.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium flex items-center justify-between gap-1 text-left transition-colors"
                        >
                          <span className="truncate">{room.name}</span>
                          <span className="text-[10px] text-emerald-700 shrink-0">ว่าง</span>
                        </button>
                      );
                    }

                    const isMeal = booking.category === 'room_with_meal';
                    return (
                      <button
                        key={`${room.id}-${booking.id}`}
                        type="button"
                        onClick={() => onSelectBooking(booking)}
                        title={`${room.name} · ${CATEGORY_LABELS[booking.category]} · ${booking.guestName}`}
                        className={`w-full px-1.5 py-1 rounded border text-[11px] text-left transition-colors ${
                          isMeal
                            ? 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900'
                            : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 font-semibold">
                          <span className="truncate flex items-center gap-1">
                            {isMeal ? (
                              <Utensils className="w-3 h-3 text-orange-600 shrink-0" />
                            ) : (
                              <BedDouble className="w-3 h-3 text-rose-600 shrink-0" />
                            )}
                            <span className="truncate">{room.name}</span>
                          </span>
                          <span className="text-[10px] font-medium shrink-0">
                            {isMeal ? 'ห้อง+อาหาร' : 'ห้องอย่างเดียว'}
                          </span>
                        </div>
                        <div className="text-[10px] opacity-80 truncate pl-4">
                          {booking.guestName}
                        </div>
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
              onClick={() => onQuickBook(selectedMobileDay)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              จองวันนี้
            </button>
          </div>

          <div className="space-y-2">
            {mobileDayInfo.statuses
              .filter((s) =>
                filters.category === 'all' ? true : s.booking?.category === filters.category,
              )
              .map(({ room, booking }) => {
                if (!booking) {
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => onQuickBook(selectedMobileDay, room.id)}
                      className="w-full min-h-[52px] p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-emerald-950">{room.name}</div>
                        <div className="text-xs text-emerald-700">
                          {room.roomType} · ว่าง พร้อมขาย (แตะเพื่อจอง)
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">
                        + จองห้องนี้
                      </span>
                    </button>
                  );
                }

                const isMeal = booking.category === 'room_with_meal';
                return (
                  <button
                    key={`${room.id}-${booking.id}`}
                    type="button"
                    onClick={() => onSelectBooking(booking)}
                    className={`w-full min-h-[56px] p-3 rounded-lg border flex items-center justify-between gap-3 text-left ${
                      isMeal
                        ? 'border-orange-200 bg-orange-50 text-orange-950'
                        : 'border-rose-200 bg-rose-50 text-rose-950'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {isMeal ? (
                          <Utensils className="w-4 h-4 text-orange-600 shrink-0" />
                        ) : (
                          <BedDouble className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="truncate">{room.name}</span>
                        <span className="text-xs font-medium opacity-80 shrink-0">
                          · {CATEGORY_LABELS[booking.category]}
                        </span>
                      </div>
                      <div className="text-xs opacity-80 truncate mt-0.5">
                        ผู้เข้าพัก: {booking.guestName} ({booking.bookingChannel})
                      </div>
                    </div>
                    <span className="text-xs font-semibold shrink-0 underline underline-offset-2">
                      ดูรายละเอียด
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
