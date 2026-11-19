import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BedDouble,
  Check,
  Lock,
  Utensils,
  X,
} from 'lucide-react';
import {
  BOOKING_CHANNELS,
  DEFAULT_BREAKFAST_OPTIONS,
  DEFAULT_DINNER_OPTIONS,
  getNormalizedBookingMeals,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type BookingFormInput,
  type PaymentStatus,
  type ResortSettings,
  type Room,
} from '../types/resort';
import { addDaysISO, doDateRangesOverlap, getNightsCount, toISODate } from '../utils/dateUtils';

interface BookingFormModalProps {
  isOpen: boolean;
  settings: ResortSettings | null;
  rooms: Room[];
  bookings: Booking[];
  initialCheckIn?: string;
  initialRoomIds?: string[];
  editingBooking?: Booking | null;
  onClose: () => void;
  onSubmit: (input: BookingFormInput, editingBooking?: Booking | null) => Promise<void>;
}

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  settings,
  rooms,
  bookings,
  initialCheckIn,
  initialRoomIds,
  editingBooking,
  onClose,
  onSubmit,
}) => {
  const defaultCheckIn = initialCheckIn || toISODate(new Date());
  const defaultCheckOut = addDaysISO(defaultCheckIn, 1);

  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(initialRoomIds || []);
  const [mealBreakfastItems, setMealBreakfastItems] = useState<string[]>([]);
  const [mealDinnerItems, setMealDinnerItems] = useState<string[]>([]);
  const [mealSetsCount, setMealSetsCount] = useState<number>(2);
  const [mealNotes, setMealNotes] = useState<string>('');
  const [extraBed, setExtraBed] = useState<boolean>(false);
  const [extraBedCount, setExtraBedCount] = useState<number>(1);
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [bookingChannel, setBookingChannel] = useState<string>(BOOKING_CHANNELS[0]);
  const [specialRequest, setSpecialRequest] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('deposit');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const configuredBreakfastOptions = useMemo(() => {
    const base =
      settings?.breakfastOptions && settings.breakfastOptions.length > 0
        ? settings.breakfastOptions
        : DEFAULT_BREAKFAST_OPTIONS;
    const merged = [...base];
    for (const item of mealBreakfastItems) {
      if (!merged.includes(item)) merged.push(item);
    }
    return merged;
  }, [settings?.breakfastOptions, mealBreakfastItems]);

  const configuredDinnerOptions = useMemo(() => {
    const base =
      settings?.dinnerOptions && settings.dinnerOptions.length > 0
        ? settings.dinnerOptions
        : DEFAULT_DINNER_OPTIONS;
    const merged = [...base];
    for (const item of mealDinnerItems) {
      if (!merged.includes(item)) merged.push(item);
    }
    return merged;
  }, [settings?.dinnerOptions, mealDinnerItems]);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);

    if (editingBooking) {
      const { breakfastItems, dinnerItems } = getNormalizedBookingMeals(editingBooking);
      setCheckIn(editingBooking.checkIn);
      setCheckOut(editingBooking.checkOut);
      setSelectedRoomIds(editingBooking.roomIds);
      setMealBreakfastItems(breakfastItems);
      setMealDinnerItems(dinnerItems);
      setMealSetsCount(editingBooking.mealSetsCount ?? 2);
      setMealNotes(editingBooking.mealNotes || '');
      setExtraBed(Boolean(editingBooking.extraBed));
      setExtraBedCount(editingBooking.extraBedCount === 2 ? 2 : 1);
      setGuestName(editingBooking.guestName);
      setGuestPhone(editingBooking.guestPhone);
      setBookingChannel(editingBooking.bookingChannel || BOOKING_CHANNELS[0]);
      setSpecialRequest(editingBooking.specialRequest || '');
      setPaymentStatus(editingBooking.paymentStatus);
    } else {
      const start = initialCheckIn || toISODate(new Date());
      setCheckIn(start);
      setCheckOut(addDaysISO(start, 1));
      setSelectedRoomIds(initialRoomIds || []);
      setMealBreakfastItems([]);
      setMealDinnerItems([]);
      setMealSetsCount(2);
      setMealNotes('');
      setExtraBed(false);
      setExtraBedCount(1);
      setGuestName('');
      setGuestPhone('');
      setBookingChannel(BOOKING_CHANNELS[0]);
      setSpecialRequest('');
      setPaymentStatus('deposit');
    }
  }, [isOpen, editingBooking, initialCheckIn, initialRoomIds]);

  const activeRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.isActive || (editingBooking && editingBooking.roomIds.includes(r.id)))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rooms, editingBooking],
  );

  const nights = getNightsCount(checkIn, checkOut);

  const occupiedRoomMap = useMemo(() => {
    const map = new Map<string, Booking>();
    if (!checkIn || !checkOut || nights <= 0) return map;

    for (const b of bookings) {
      if (b.status !== 'confirmed') continue;
      if (editingBooking && b.id === editingBooking.id) continue;
      if (doDateRangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) {
        for (const rId of b.roomIds) {
          map.set(rId, b);
        }
      }
    }
    return map;
  }, [bookings, checkIn, checkOut, nights, editingBooking]);

  useEffect(() => {
    if (occupiedRoomMap.size === 0) return;
    setSelectedRoomIds((prev) => prev.filter((id) => !occupiedRoomMap.has(id)));
  }, [occupiedRoomMap]);

  if (!isOpen) return null;

  const toggleRoom = (roomId: string) => {
    if (occupiedRoomMap.has(roomId)) return;
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  };

  const toggleBreakfastItem = (item: string) => {
    setMealBreakfastItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  };

  const toggleDinnerItem = (item: string) => {
    setMealDinnerItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  };

  const handleCheckInChange = (nextCheckIn: string) => {
    setCheckIn(nextCheckIn);
    if (nextCheckIn && (!checkOut || checkOut <= nextCheckIn)) {
      setCheckOut(addDaysISO(nextCheckIn, 1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (nights <= 0) {
      setFormError('วันที่ Check-out ต้องมากกว่าวันที่ Check-in อย่างน้อย 1 คืน');
      return;
    }
    if (selectedRoomIds.length === 0) {
      setFormError('กรุณาเลือกห้องพักที่ต้องการจองอย่างน้อย 1 ห้อง');
      return;
    }
    if (!guestName.trim()) {
      setFormError('กรุณากรอกชื่อผู้เข้าพัก');
      return;
    }
    if (!guestPhone.trim()) {
      setFormError('กรุณากรอกเบอร์โทรศัพท์ติดต่อ');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(
        {
          checkIn,
          checkOut,
          roomIds: selectedRoomIds,
          mealBreakfastItems,
          mealDinnerItems,
          mealSetsCount,
          mealNotes,
          extraBed,
          extraBedCount: extraBed ? extraBedCount : 0,
          guestName,
          guestPhone,
          bookingChannel,
          specialRequest,
          paymentStatus,
        },
        editingBooking,
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'DoubleBookingError') {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-form-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="booking-form-title" className="text-lg font-bold text-slate-900">
              {editingBooking ? 'แก้ไขข้อมูลการจองห้องพัก' : 'บันทึกการจองห้องพักใหม่'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบจะตรวจสอบห้องว่างอัตโนมัติแบบ Real-time เพื่อป้องกันการจองชนกัน
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดฟอร์ม"
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {formError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Check-in & Check-out */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                1. วันที่เข้าพัก (Check-in) และ วันที่ออก (Check-out)
              </h3>
              <span className="text-xs font-medium text-teal-700 tabular-nums">
                {nights > 0 ? `จำนวน ${nights} คืน` : 'กรุณาเลือกวันออกให้ถูกต้อง'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bk-checkin" className="block text-xs font-medium text-slate-600 mb-1.5">
                  วันที่เข้าพัก (Check-in)
                </label>
                <input
                  id="bk-checkin"
                  type="date"
                  required
                  value={checkIn}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
              <div>
                <label htmlFor="bk-checkout" className="block text-xs font-medium text-slate-600 mb-1.5">
                  วันที่ออก (Check-out)
                </label>
                <input
                  id="bk-checkout"
                  type="date"
                  required
                  min={checkIn ? addDaysISO(checkIn, 1) : undefined}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>
          </section>

          {/* 2. Room Multi-select */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                2. เลือกห้องพัก (เลือกได้หลายห้องในบุ๊กกิ้งเดียว)
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                เลือกแล้ว {selectedRoomIds.length} ห้อง · ห้องสีเทาคือห้องที่ไม่ว่างในช่วงวันที่เลือก
              </span>
            </div>

            {activeRooms.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-500">
                ยังไม่มีห้องพักที่เปิดใช้งาน กรุณาเพิ่มห้องพักในเมนู &ldquo;ตั้งค่ารีสอร์ท&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {activeRooms.map((room) => {
                  const conflictBooking = occupiedRoomMap.get(room.id);
                  const isOccupied = Boolean(conflictBooking);
                  const isSelected = selectedRoomIds.includes(room.id);

                  return (
                    <button
                      key={room.id}
                      type="button"
                      disabled={isOccupied}
                      onClick={() => toggleRoom(room.id)}
                      className={`min-h-[68px] p-3 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                        isOccupied
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : isSelected
                            ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600'
                            : 'bg-white border-slate-200 hover:border-teal-400 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <span className="text-sm font-semibold truncate">{room.name}</span>
                        {isOccupied ? (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : isSelected ? (
                          <span className="w-4 h-4 rounded bg-teal-700 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] truncate mt-1">
                        {isOccupied ? (
                          <span className="text-slate-400">
                            ไม่ว่าง ({conflictBooking?.guestName})
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {room.roomType} · {room.capacity} ท่าน
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. Extra Bed (Yes/No + 1 or 2 beds) */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                3. เตียงเสริม (Extra Bed)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExtraBed(false)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !extraBed
                      ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  ไม่รับ (No)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExtraBed(true);
                    if (extraBedCount !== 1 && extraBedCount !== 2) {
                      setExtraBedCount(1);
                    }
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    extraBed
                      ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  รับเตียงเสริม (Yes)
                </button>
              </div>

              {extraBed && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-medium text-slate-700">จำนวนเตียงเสริม</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setExtraBedCount(count)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${
                          extraBedCount === count
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-teal-400'
                        }`}
                      >
                        {count} เตียง
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. Multi-select Meal Checkboxes */}
          <section className="p-4 rounded-lg bg-orange-50/50 border border-orange-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-orange-950">
                  4. ตัวเลือกอาหาร (เลือกได้หลายรายการ)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                เพิ่มรายการอาหารเช้า/เย็นได้ที่เมนู &ldquo;ตั้งค่ารีสอร์ท&rdquo;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Breakfast Checkboxes */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">รายการอาหารเช้า</div>
                <div className="space-y-2 bg-white p-3 rounded-lg border border-orange-200/80">
                  {configuredBreakfastOptions.map((item) => {
                    const checked = mealBreakfastItems.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBreakfastItem(item)}
                          className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dinner Checkboxes */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">รายการอาหารเย็น</div>
                <div className="space-y-2 bg-white p-3 rounded-lg border border-orange-200/80">
                  {configuredDinnerOptions.map((item) => {
                    const checked = mealDinnerItems.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDinnerItem(item)}
                          className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="bk-meal-sets" className="block text-xs font-medium text-slate-700 mb-1.5">
                  จำนวนชุดอาหาร
                </label>
                <input
                  id="bk-meal-sets"
                  type="number"
                  min={0}
                  max={100}
                  value={mealSetsCount}
                  onChange={(e) => setMealSetsCount(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="bk-meal-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
                  หมายเหตุอาหาร / การแพ้อาหาร
                </label>
                <input
                  id="bk-meal-notes"
                  type="text"
                  maxLength={500}
                  value={mealNotes}
                  onChange={(e) => setMealNotes(e.target.value)}
                  placeholder="เช่น แพ้อาหารทะเล, ไม่ทานเนื้อวัว, เสิร์ฟหมูกระทะเวลา 18:30 น."
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          </section>

          {/* 5. Guest Info */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">5. ข้อมูลผู้เข้าพัก</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="bk-guest-name" className="block text-xs font-medium text-slate-600 mb-1.5">
                  ชื่อลูกค้า *
                </label>
                <input
                  id="bk-guest-name"
                  type="text"
                  required
                  maxLength={120}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="เช่น คุณสมชาย ใจดี"
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="bk-guest-phone" className="block text-xs font-medium text-slate-600 mb-1.5">
                  เบอร์โทรศัพท์ *
                </label>
                <input
                  id="bk-guest-phone"
                  type="tel"
                  required
                  maxLength={40}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="bk-channel" className="block text-xs font-medium text-slate-600 mb-1.5">
                  ช่องทางที่จอง
                </label>
                <select
                  id="bk-channel"
                  value={bookingChannel}
                  onChange={(e) => setBookingChannel(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {BOOKING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 6. Special Request & 7. Payment Status */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="sm:col-span-2">
              <label htmlFor="bk-special-req" className="block text-sm font-semibold text-slate-900 mb-1.5">
                6. Special Request (คำขอพิเศษ)
              </label>
              <textarea
                id="bk-special-req"
                rows={3}
                maxLength={1000}
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                placeholder="เช่น เตรียมเค้กวันเกิด, ขอห้องใกล้สระน้ำ, รถรับ-ส่งสนามบิน"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-900 mb-1.5">
                7. สถานะการชำระเงิน
              </span>
              <div className="space-y-2">
                {(['pending', 'deposit', 'paid'] as PaymentStatus[]).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setPaymentStatus(statusKey)}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-lg border text-sm font-medium text-left flex items-center justify-between transition-colors ${
                      paymentStatus === statusKey
                        ? 'bg-teal-50 border-teal-600 text-teal-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span>{PAYMENT_STATUS_LABELS[statusKey]}</span>
                    {paymentStatus === statusKey && <Check className="w-4 h-4 text-teal-700" />}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || activeRooms.length === 0}
              className="min-h-[44px] px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {submitting
                ? 'กำลังตรวจสอบและบันทึก...'
                : editingBooking
                  ? 'บันทึกการแก้ไข'
                  : 'ยืนยันบันทึกการจอง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
