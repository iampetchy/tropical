import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Edit3,
  Plus,
  Save,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import {
  DEFAULT_BREAKFAST_OPTIONS,
  DEFAULT_DINNER_OPTIONS,
  type Booking,
  type ResortSettings,
  type Room,
} from '../types/resort';

interface ResortSetupViewProps {
  settings: ResortSettings | null;
  rooms: Room[];
  bookings: Booking[];
  onSaveSettings: (input: {
    resortName: string;
    resortSubtitle: string;
    checkInTime: string;
    checkOutTime: string;
    breakfastOptions: string[];
    dinnerOptions: string[];
  }) => Promise<void>;
  onSaveRoom: (
    input: {
      name: string;
      roomType: string;
      capacity: number;
      sortOrder: number;
      isActive: boolean;
    },
    existingRoomId?: string,
  ) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
}

export const ResortSetupView: React.FC<ResortSetupViewProps> = ({
  settings,
  rooms,
  bookings,
  onSaveSettings,
  onSaveRoom,
  onDeleteRoom,
}) => {
  const [resortName, setResortName] = useState(settings?.resortName || '');
  const [resortSubtitle, setResortSubtitle] = useState(settings?.resortSubtitle || '');
  const [checkInTime, setCheckInTime] = useState(settings?.checkInTime || '14:00');
  const [checkOutTime, setCheckOutTime] = useState(settings?.checkOutTime || '12:00');
  const [breakfastOptions, setBreakfastOptions] = useState<string[]>(
    settings?.breakfastOptions && settings.breakfastOptions.length > 0
      ? settings.breakfastOptions
      : DEFAULT_BREAKFAST_OPTIONS,
  );
  const [dinnerOptions, setDinnerOptions] = useState<string[]>(
    settings?.dinnerOptions && settings.dinnerOptions.length > 0
      ? settings.dinnerOptions
      : DEFAULT_DINNER_OPTIONS,
  );
  const [newBreakfastInput, setNewBreakfastInput] = useState('');
  const [newDinnerInput, setNewDinnerInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState('Pool Villa');
  const [capacity, setCapacity] = useState(2);
  const [sortOrder, setSortOrder] = useState(rooms.length + 1);
  const [isActive, setIsActive] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setResortName(settings.resortName);
      setResortSubtitle(settings.resortSubtitle);
      setCheckInTime(settings.checkInTime);
      setCheckOutTime(settings.checkOutTime);
      setBreakfastOptions(
        settings.breakfastOptions && settings.breakfastOptions.length > 0
          ? settings.breakfastOptions
          : DEFAULT_BREAKFAST_OPTIONS,
      );
      setDinnerOptions(
        settings.dinnerOptions && settings.dinnerOptions.length > 0
          ? settings.dinnerOptions
          : DEFAULT_DINNER_OPTIONS,
      );
    }
  }, [settings]);

  const sortedRooms = [...rooms].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onSaveSettings({
        resortName,
        resortSubtitle,
        checkInTime,
        checkOutTime,
        breakfastOptions,
        dinnerOptions,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddBreakfastOption = async () => {
    const clean = newBreakfastInput.trim();
    if (!clean) return;
    if (breakfastOptions.includes(clean)) {
      setNewBreakfastInput('');
      return;
    }
    const next = [...breakfastOptions, clean].slice(0, 30);
    setBreakfastOptions(next);
    setNewBreakfastInput('');
    await onSaveSettings({
      resortName,
      resortSubtitle,
      checkInTime,
      checkOutTime,
      breakfastOptions: next,
      dinnerOptions,
    });
  };

  const handleRemoveBreakfastOption = async (item: string) => {
    const next = breakfastOptions.filter((x) => x !== item);
    setBreakfastOptions(next);
    await onSaveSettings({
      resortName,
      resortSubtitle,
      checkInTime,
      checkOutTime,
      breakfastOptions: next,
      dinnerOptions,
    });
  };

  const handleAddDinnerOption = async () => {
    const clean = newDinnerInput.trim();
    if (!clean) return;
    if (dinnerOptions.includes(clean)) {
      setNewDinnerInput('');
      return;
    }
    const next = [...dinnerOptions, clean].slice(0, 30);
    setDinnerOptions(next);
    setNewDinnerInput('');
    await onSaveSettings({
      resortName,
      resortSubtitle,
      checkInTime,
      checkOutTime,
      breakfastOptions,
      dinnerOptions: next,
    });
  };

  const handleRemoveDinnerOption = async (item: string) => {
    const next = dinnerOptions.filter((x) => x !== item);
    setDinnerOptions(next);
    await onSaveSettings({
      resortName,
      resortSubtitle,
      checkInTime,
      checkOutTime,
      breakfastOptions,
      dinnerOptions: next,
    });
  };

  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRoomName('');
    setRoomType('Pool Villa');
    setCapacity(2);
    setSortOrder(rooms.length + 1);
    setIsActive(true);
    setRoomError(null);
  };

  const handleStartEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomName(room.name);
    setRoomType(room.roomType);
    setCapacity(room.capacity);
    setSortOrder(room.sortOrder);
    setIsActive(room.isActive);
    setRoomError(null);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError(null);
    if (!roomName.trim()) {
      setRoomError('กรุณาระบุชื่อหรือหมายเลขห้องพัก');
      return;
    }
    setSavingRoom(true);
    try {
      await onSaveRoom(
        {
          name: roomName,
          roomType,
          capacity,
          sortOrder,
          isActive,
        },
        editingRoomId || undefined,
      );
      resetRoomForm();
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลห้องได้');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleConfirmDeleteRoom = async (room: Room) => {
    const hasConfirmedBooking = bookings.some(
      (b) => b.status === 'confirmed' && b.roomIds.includes(room.id),
    );
    if (hasConfirmedBooking) {
      setRoomError(
        `ไม่สามารถลบห้อง ${room.name} ได้ เนื่องจากยังมีรายการจองที่ยืนยันอยู่ กรุณาปิดใช้งานห้องแทนหรือยกเลิกการจองก่อน`,
      );
      setConfirmDeleteId(null);
      return;
    }
    await onDeleteRoom(room.id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Resort Basic Info */}
      <form
        onSubmit={handleSettingsSubmit}
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Building2 className="w-5 h-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">ข้อมูลพื้นฐานของรีสอร์ท</h2>
            <p className="text-xs text-slate-500">
              ชื่อรีสอร์ท (แสดงบน Header หน้าแรก) และเวลา Check-in / Check-out มาตรฐาน
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="setup-resort-name" className="block text-xs font-medium text-slate-600 mb-1.5">
              ชื่อรีสอร์ท *
            </label>
            <input
              id="setup-resort-name"
              type="text"
              required
              maxLength={120}
              value={resortName}
              onChange={(e) => setResortName(e.target.value)}
              placeholder="เช่น วิลล่า เวลา รีสอร์ท"
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="setup-resort-sub" className="block text-xs font-medium text-slate-600 mb-1.5">
              คำอธิบาย / สาขา
            </label>
            <input
              id="setup-resort-sub"
              type="text"
              maxLength={160}
              value={resortSubtitle}
              onChange={(e) => setResortSubtitle(e.target.value)}
              placeholder="เช่น เชียงใหม่ · โซนแม่ริม"
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="setup-checkin-time" className="block text-xs font-medium text-slate-600 mb-1.5">
              เวลา Check-in มาตรฐาน
            </label>
            <input
              id="setup-checkin-time"
              type="text"
              maxLength={20}
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="setup-checkout-time" className="block text-xs font-medium text-slate-600 mb-1.5">
              เวลา Check-out มาตรฐาน
            </label>
            <input
              id="setup-checkout-time"
              type="text"
              maxLength={20}
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'กำลังบันทึก...' : 'บันทึกข้อมูลรีสอร์ท'}
          </button>
        </div>
      </form>

      {/* Section 2: Customizable Breakfast & Dinner Options */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Utensils className="w-5 h-5 text-orange-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              จัดการรายการอาหารเช้าและอาหารเย็น
            </h2>
            <p className="text-xs text-slate-500">
              รายการเหล่านี้จะแสดงเป็นตัวเลือก Check Box ในฟอร์มบันทึกการจอง
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breakfast Options Editor */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              รายการอาหารเช้า ({breakfastOptions.length} รายการ)
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={80}
                value={newBreakfastInput}
                onChange={(e) => setNewBreakfastInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddBreakfastOption();
                  }
                }}
                placeholder="เพิ่มเมนูอาหารเช้า เช่น ข้าวเหนียวหมูปิ้ง"
                className="flex-1 min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => void handleAddBreakfastOption()}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg whitespace-nowrap transition-colors"
              >
                <Plus className="w-4 h-4" />
                เพิ่ม
              </button>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {breakfastOptions.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">ยังไม่มีรายการอาหารเช้า</div>
              ) : (
                breakfastOptions.map((item) => (
                  <div
                    key={item}
                    className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2 text-sm text-slate-800"
                  >
                    <span className="truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveBreakfastOption(item)}
                      aria-label={`ลบ ${item}`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dinner Options Editor */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              รายการอาหารเย็น ({dinnerOptions.length} รายการ)
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={80}
                value={newDinnerInput}
                onChange={(e) => setNewDinnerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddDinnerOption();
                  }
                }}
                placeholder="เพิ่มเมนูอาหารเย็น เช่น ชาบูเซ็ตพิเศษ"
                className="flex-1 min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => void handleAddDinnerOption()}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg whitespace-nowrap transition-colors"
              >
                <Plus className="w-4 h-4" />
                เพิ่ม
              </button>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {dinnerOptions.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">ยังไม่มีรายการอาหารเย็น</div>
              ) : (
                dinnerOptions.map((item) => (
                  <div
                    key={item}
                    className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2 text-sm text-slate-800"
                  >
                    <span className="truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveDinnerOption(item)}
                      aria-label={`ลบ ${item}`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Rooms Inventory Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={handleRoomSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-base font-bold text-slate-900">
            {editingRoomId ? 'แก้ไขข้อมูลห้องพัก' : 'เพิ่มห้องพักใหม่'}
          </h3>

          {roomError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {roomError}
            </div>
          )}

          <div>
            <label htmlFor="room-name" className="block text-xs font-medium text-slate-600 mb-1.5">
              ชื่อ / หมายเลขห้อง *
            </label>
            <input
              id="room-name"
              type="text"
              required
              maxLength={60}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="เช่น Villa 05, Deluxe 104"
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="room-type" className="block text-xs font-medium text-slate-600 mb-1.5">
              ประเภทห้องพัก *
            </label>
            <input
              id="room-type"
              type="text"
              required
              maxLength={60}
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              placeholder="เช่น Pool Villa, Deluxe Room"
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room-cap" className="block text-xs font-medium text-slate-600 mb-1.5">
                รองรับ (ท่าน)
              </label>
              <input
                id="room-cap"
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="room-order" className="block text-xs font-medium text-slate-600 mb-1.5">
                ลำดับแสดงผล
              </label>
              <input
                id="room-order"
                type="number"
                min={0}
                max={1000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-700 rounded"
            />
            <span>เปิดให้จองบนปฏิทิน (Active)</span>
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={savingRoom}
              className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {editingRoomId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {savingRoom
                ? 'กำลังบันทึก...'
                : editingRoomId
                  ? 'อัปเดตห้องพัก'
                  : 'เพิ่มห้องพัก'}
            </button>
            {editingRoomId && (
              <button
                type="button"
                onClick={resetRoomForm}
                className="min-h-[42px] px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              รายชื่อห้องพักทั้งหมด ({sortedRooms.length} ห้อง)
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              เปิดใช้งาน {sortedRooms.filter((r) => r.isActive).length} ห้อง
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedRooms.map((room) => (
              <div
                key={room.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{room.name}</span>
                    <span className="text-xs text-slate-500">· {room.roomType}</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      · {room.capacity} ท่าน
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        room.isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      · {room.isActive ? 'เปิดขาย' : 'ปิดปรับปรุง'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 tabular-nums">
                    ลำดับ #{room.sortOrder} · ID: {room.id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEditRoom(room)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    แก้ไข
                  </button>

                  {confirmDeleteId === room.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleConfirmDeleteRoom(room)}
                        className="min-h-[38px] px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg"
                      >
                        ไม่ลบ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(room.id)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
