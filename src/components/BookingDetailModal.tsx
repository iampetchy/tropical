import React, { useState } from 'react';
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  MessageSquare,
  Phone,
  Trash2,
  User as UserIcon,
  Utensils,
  X,
} from 'lucide-react';
import {
  getNormalizedBookingMeals,
  PAYMENT_STATUS_LABELS,
  type Booking,
} from '../types/resort';
import { formatThaiDateLong, formatThaiTimestamp, getNightsCount } from '../utils/dateUtils';

interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => Promise<void>;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  onClose,
  onEdit,
  onCancelBooking,
}) => {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!booking) return null;

  const nights = getNightsCount(booking.checkIn, booking.checkOut);
  const isCancelled = booking.status === 'cancelled';
  const { breakfastItems, dinnerItems } = getNormalizedBookingMeals(booking);
  const hasAnyMeals =
    breakfastItems.length > 0 || dinnerItems.length > 0 || Boolean(booking.mealNotes);

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await onCancelBooking(booking);
      setConfirmingCancel(false);
      onClose();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-mono tabular-nums">#{booking.id}</span>
              <span aria-hidden="true">·</span>
              <span>ช่องทาง {booking.bookingChannel}</span>
              <span aria-hidden="true">·</span>
              <span className={isCancelled ? 'text-slate-500 font-medium' : 'text-teal-700 font-medium'}>
                {isCancelled ? 'ยกเลิกแล้ว' : 'ยืนยันการจอง'}
              </span>
            </div>
            <h2 id="booking-detail-title" className="text-lg font-bold text-slate-900">
              {booking.guestName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Dates & Rooms + Extra Bed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
                <CalendarDays className="w-4 h-4 text-teal-700" />
                <span>วันเข้าพัก – วันออก</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {formatThaiDateLong(booking.checkIn)}
              </p>
              <p className="text-sm text-slate-700 tabular-nums mt-0.5">
                ถึง {formatThaiDateLong(booking.checkOut)} ({nights} คืน)
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
                <BedDouble className="w-4 h-4 text-teal-700" />
                <span>ห้องพักและเตียงเสริม</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {booking.roomNames.join(', ')}
              </p>
              <p className="text-xs text-slate-600 mt-1 tabular-nums">
                เตียงเสริม:{' '}
                {booking.extraBed
                  ? `รับ (${booking.extraBedCount || 1} เตียง)`
                  : 'ไม่รับเตียงเสริม'}
              </p>
            </div>
          </div>

          {/* Guest & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500">ข้อมูลผู้เข้าพัก</h3>
              <div className="flex items-center gap-2.5 text-sm text-slate-800">
                <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{booking.guestName}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-800 tabular-nums">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <a href={`tel:${booking.guestPhone}`} className="hover:text-teal-700 underline-offset-2 hover:underline">
                  {booking.guestPhone}
                </a>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500">สถานะการชำระเงิน</h3>
              <div className="flex items-center gap-2.5 text-sm">
                <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                <span
                  className={`font-semibold ${
                    booking.paymentStatus === 'paid'
                      ? 'text-emerald-700'
                      : booking.paymentStatus === 'deposit'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                </span>
              </div>
            </div>
          </div>

          {/* Meal Details */}
          <div className="p-4 rounded-lg bg-orange-50/60 border border-orange-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-900">
                <Utensils className="w-4 h-4 text-orange-600" />
                <span>รายการอาหารที่เลือก</span>
              </div>
              {hasAnyMeals && (
                <span className="text-xs font-medium text-orange-800 tabular-nums">
                  จำนวน {booking.mealSetsCount} ชุด
                </span>
              )}
            </div>

            {hasAnyMeals ? (
              <div className="space-y-1.5 text-sm text-slate-800">
                <div>
                  <span className="text-slate-500">อาหารเช้า: </span>
                  <span className="font-medium">
                    {breakfastItems.length > 0 ? breakfastItems.join(', ') : 'ไม่ได้เลือก'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">อาหารเย็น: </span>
                  <span className="font-medium">
                    {dinnerItems.length > 0 ? dinnerItems.join(', ') : 'ไม่ได้เลือก'}
                  </span>
                </div>
                {booking.mealNotes && (
                  <p className="text-sm text-orange-900 pt-1 border-t border-orange-200/70">
                    <span className="font-medium">หมายเหตุอาหาร/แพ้อาหาร: </span>
                    {booking.mealNotes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">ไม่มีรายการอาหารที่เลือกไว้</p>
            )}
          </div>

          {/* Special Request */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1.5">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>คำขอพิเศษ (Special Request)</span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {booking.specialRequest ? booking.specialRequest : 'ไม่มีคำขอพิเศษ'}
            </p>
          </div>

          {/* Audit Trail */}
          <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                บันทึกโดย <strong className="text-slate-700">{booking.createdByName}</strong> ·{' '}
                {formatThaiTimestamp(booking.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                อัปเดตล่าสุดโดย <strong className="text-slate-700">{booking.updatedByName}</strong> ·{' '}
                {formatThaiTimestamp(booking.updatedAt)}
              </span>
            </div>
            {isCancelled && booking.cancelledByName && (
              <div className="flex items-center gap-2 text-rose-700">
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ยกเลิกโดย <strong>{booking.cancelledByName}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Inline Cancel Confirmation */}
          {confirmingCancel && !isCancelled && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-3">
              <p className="text-sm font-semibold text-rose-900">
                ยืนยันการยกเลิกการจองห้อง {booking.roomNames.join(', ')}?
              </p>
              <p className="text-xs text-rose-800">
                เมื่อยกเลิกแล้ว ห้องพักในช่วงวันที่ {formatThaiDateLong(booking.checkIn)} –{' '}
                {formatThaiDateLong(booking.checkOut)} จะกลับมามีสถานะ &ldquo;ว่าง&rdquo; บนปฏิทินของทีมงานทันที
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleConfirmCancel}
                  className="min-h-[40px] px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกการจอง'}
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setConfirmingCancel(false)}
                  className="min-h-[40px] px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  ไม่ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          {!isCancelled ? (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              ยกเลิกการจอง
            </button>
          ) : (
            <span className="text-xs text-slate-500">รายการนี้ถูกยกเลิกแล้ว</span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              ปิดหน้าต่าง
            </button>
            {!isCancelled && (
              <button
                type="button"
                onClick={() => onEdit(booking)}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                แก้ไขข้อมูล
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
