import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
} from 'lucide-react';
import {
  getNormalizedBookingMeals,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type PaymentStatus,
} from '../types/resort';
import { formatThaiDate, getNightsCount } from '../utils/dateUtils';

interface BookingsListViewProps {
  bookings: Booking[];
  onSelectBooking: (booking: Booking) => void;
  onAddBooking: () => void;
}

export const BookingsListView: React.FC<BookingsListViewProps> = ({
  bookings,
  onSelectBooking,
  onAddBooking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'confirmed' | 'cancelled' | 'all'>('confirmed');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter) return false;
        if (!q) return true;
        return (
          b.guestName.toLowerCase().includes(q) ||
          b.guestPhone.toLowerCase().includes(q) ||
          b.roomNames.some((rn) => rn.toLowerCase().includes(q)) ||
          b.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [bookings, searchQuery, statusFilter, paymentFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ชื่อห้อง หรือรหัสบุ๊กกิ้ง..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="กรองสถานะการจอง"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'confirmed' | 'cancelled' | 'all')}
            className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="confirmed">รายการจองที่ยืนยัน</option>
            <option value="cancelled">รายการที่ยกเลิกแล้ว</option>
            <option value="all">ทุกสถานะ</option>
          </select>

          <select
            aria-label="กรองสถานะชำระเงิน"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentStatus)}
            className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="all">การชำระเงินทั้งหมด</option>
            <option value="pending">รอชำระ</option>
            <option value="deposit">มัดจำแล้ว</option>
            <option value="paid">ชำระเต็มจำนวน</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            ไม่พบรายการจองตามเงื่อนไขที่เลือก
          </h3>
          <p className="text-sm text-slate-500 mb-5">
            ลองปรับตัวกรองการค้นหา หรือบันทึกการจองห้องพักรายการใหม่
          </p>
          <button
            type="button"
            onClick={onAddBooking}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            บันทึกการจองใหม่
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">วันเข้าพัก – ออก</th>
                  <th className="py-3 px-4 whitespace-nowrap">ห้องพัก</th>
                  <th className="py-3 px-4 whitespace-nowrap">อาหาร / เตียงเสริม</th>
                  <th className="py-3 px-4 whitespace-nowrap">ผู้เข้าพัก</th>
                  <th className="py-3 px-4 whitespace-nowrap">ช่องทาง</th>
                  <th className="py-3 px-4 whitespace-nowrap">ชำระเงิน</th>
                  <th className="py-3 px-4 whitespace-nowrap">ผู้บันทึกล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredBookings.map((b) => {
                  const nights = getNightsCount(b.checkIn, b.checkOut);
                  const isCancelled = b.status === 'cancelled';
                  const { breakfastItems, dinnerItems } = getNormalizedBookingMeals(b);
                  const allMeals = [...breakfastItems, ...dinnerItems];

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBooking(b)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        isCancelled ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        <div className="font-medium text-slate-900">
                          {formatThaiDate(b.checkIn)} – {formatThaiDate(b.checkOut)}
                        </div>
                        <div className="text-xs text-slate-500">{nights} คืน</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {b.roomNames.join(', ')}
                        </div>
                        {isCancelled && (
                          <div className="text-xs text-rose-600 font-medium">ยกเลิกแล้ว</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div className="truncate max-w-[220px]">
                          {allMeals.length > 0 ? allMeals.join(', ') : 'ไม่ระบุอาหาร'}
                        </div>
                        <div className="text-slate-500 mt-0.5 tabular-nums">
                          {b.extraBed
                            ? `เตียงเสริม ${b.extraBedCount || 1} เตียง`
                            : 'ไม่รับเตียงเสริม'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{b.guestName}</div>
                        <div className="text-xs text-slate-500 tabular-nums">{b.guestPhone}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        {b.bookingChannel}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold">
                        <span
                          className={
                            b.paymentStatus === 'paid'
                              ? 'text-emerald-700'
                              : b.paymentStatus === 'deposit'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }
                        >
                          {PAYMENT_STATUS_LABELS[b.paymentStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        {b.updatedByName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
