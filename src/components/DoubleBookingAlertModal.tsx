import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface DoubleBookingAlertModalProps {
  isOpen: boolean;
  conflictingRooms: string[];
  checkIn: string;
  checkOut: string;
  onClose: () => void;
}

export const DoubleBookingAlertModal: React.FC<DoubleBookingAlertModalProps> = ({
  isOpen,
  conflictingRooms,
  checkIn,
  checkOut,
  onClose,
}) => {
  if (!isOpen) return null;

  const roomLabel = conflictingRooms.join(', ');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="double-booking-title"
    >
      <div className="w-full max-w-md bg-white border-2 border-rose-500 rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-rose-600 px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h2 id="double-booking-title" className="text-base font-bold">
              แจ้งเตือนการจองซ้อนทับ (Double Booking)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างแจ้งเตือน"
            className="p-1 rounded-lg hover:bg-rose-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-base font-semibold text-rose-700 leading-relaxed mb-3">
            ไม่สามารถบันทึกได้ เนื่องจากห้อง {roomLabel} ถูกจองแล้วในวันที่ดังกล่าว
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            ระบบได้ตรวจสอบฐานข้อมูลแบบ Real-time พบว่าช่วงวันที่{' '}
            <span className="font-mono font-medium text-slate-900 tabular-nums">{checkIn}</span> ถึง{' '}
            <span className="font-mono font-medium text-slate-900 tabular-nums">{checkOut}</span>{' '}
            มีการจองห้องดังกล่าวอยู่แล้ว กรุณาเลือกห้องอื่นที่ยังว่างหรือเปลี่ยนช่วงวันเข้าพัก
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            รับทราบ และกลับไปแก้ไขห้องพัก
          </button>
        </div>
      </div>
    </div>
  );
};
