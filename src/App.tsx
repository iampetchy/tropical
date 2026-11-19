import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { BookingDetailModal } from './components/BookingDetailModal';
import { BookingFormModal } from './components/BookingFormModal';
import { BookingsListView } from './components/BookingsListView';
import { DoubleBookingAlertModal } from './components/DoubleBookingAlertModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { ResortSetupView } from './components/ResortSetupView';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  cancelBookingAtomic,
  createOrUpdateBookingAtomic,
  deleteRoom,
  DoubleBookingError,
  ensureStaffProfile,
  getStaffDisplayName,
  saveResortSettings,
  seedInitialResortDataIfEmpty,
  upsertRoom,
} from './services/resortService';
import {
  DEFAULT_RESORT_SEED,
  DEFAULT_ROOMS_SEED,
  RESORT_ID,
  type Booking,
  type BookingFormInput,
  type ResortSettings,
  type Room,
  type RoomLock,
  type StaffProfile,
} from './types/resort';

type ActiveTab = 'calendar' | 'bookings' | 'setup';

function ResortWorkspace() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [staffReady, setStaffReady] = useState(false);
  const pendingDisplayNameRef = useRef<string | undefined>(undefined);

  const [settings, setSettings] = useState<ResortSettings | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomLocks, setRoomLocks] = useState<RoomLock[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Login Modal State (for Landing Page)
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginPromptNotice, setLoginPromptNotice] = useState<string | null>(null);
  const pendingActionRef = useRef<{ dateISO?: string; roomId?: string } | null>(null);

  // Booking & Detail Modals State
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialCheckIn, setFormInitialCheckIn] = useState<string | undefined>(undefined);
  const [formInitialRoomIds, setFormInitialRoomIds] = useState<string[] | undefined>(undefined);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [doubleBookingAlert, setDoubleBookingAlert] = useState<{
    isOpen: boolean;
    rooms: string[];
    checkIn: string;
    checkOut: string;
  }>({
    isOpen: false,
    rooms: [],
    checkIn: '',
    checkOut: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  if (asyncError) {
    throw asyncError;
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser || !nextUser.emailVerified) {
        setStaffProfile(null);
        setStaffReady(false);
        setBookings([]);
        return;
      }

      try {
        const profile = await ensureStaffProfile(nextUser, pendingDisplayNameRef.current);
        pendingDisplayNameRef.current = undefined;
        setStaffProfile(profile);
        const displayName = getStaffDisplayName(nextUser, profile);
        await seedInitialResortDataIfEmpty(nextUser, displayName);
        setStaffReady(true);
        setLoginModalOpen(false);
        setLoginPromptNotice(null);

        // Execute pending quick-book action if user clicked a room before logging in
        if (pendingActionRef.current) {
          const pending = pendingActionRef.current;
          pendingActionRef.current = null;
          setEditingBooking(null);
          setFormInitialCheckIn(pending.dateISO);
          setFormInitialRoomIds(pending.roomId ? [pending.roomId] : undefined);
          setFormOpen(true);
        }
      } catch (err) {
        setAsyncError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => unsub();
  }, []);

  // Public Real-time Firestore listeners (non-PII: resortSettings, rooms, roomLocks)
  // Always active so Landing Page shows live calendar immediately without login!
  useEffect(() => {
    const settingsRef = doc(db, 'resortSettings', RESORT_ID);
    const unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          setSettings({ id: snap.id, ...(snap.data() as Omit<ResortSettings, 'id'>) });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, `resortSettings/${RESORT_ID}`);
        } catch (err) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      },
    );

    const roomsQuery = query(collection(db, 'rooms'), where('resortId', '==', RESORT_ID));
    const unsubRooms = onSnapshot(
      roomsQuery,
      (snap) => {
        const list: Room[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Room, 'id'>),
        }));
        setRooms(list);
        setPublicLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'rooms');
        } catch (err) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      },
    );

    const locksQuery = query(collection(db, 'roomLocks'), where('resortId', '==', RESORT_ID));
    const unsubLocks = onSnapshot(
      locksQuery,
      (snap) => {
        const list: RoomLock[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RoomLock, 'id'>),
        }));
        setRoomLocks(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'roomLocks');
        } catch (err) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      },
    );

    return () => {
      unsubSettings();
      unsubRooms();
      unsubLocks();
    };
  }, []);

  // Authenticated Staff-only listener for full Bookings (guest PII)
  useEffect(() => {
    if (!user || !user.emailVerified || !staffReady) return;

    const bookingsQuery = query(collection(db, 'bookings'), where('resortId', '==', RESORT_ID));
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snap) => {
        const list: Booking[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Booking, 'id'>),
        }));
        setBookings(list);

        setSelectedBooking((curr) => {
          if (!curr) return null;
          return list.find((item) => item.id === curr.id) || null;
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        } catch (err) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      },
    );

    return () => {
      unsubBookings();
    };
  }, [user, staffReady]);

  const handleRefreshEmailVerification = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      setUser({ ...refreshed } as User);
      const profile = await ensureStaffProfile(refreshed, pendingDisplayNameRef.current);
      setStaffProfile(profile);
      const displayName = getStaffDisplayName(refreshed, profile);
      await seedInitialResortDataIfEmpty(refreshed, displayName);
      setStaffReady(true);
      setLoginModalOpen(false);
    } else {
      throw new Error('ระบบยังไม่พบการยืนยันอีเมล กรุณาคลิกลิงก์ในอีเมลของคุณก่อนแล้วลองใหม่อีกครั้ง');
    }
  };

  // Fallback rooms preview when database hasn't been seeded by first staff login yet
  const effectiveRooms = useMemo<Room[]>(() => {
    if (rooms.length > 0) return rooms;
    return DEFAULT_ROOMS_SEED.map((r) => ({
      id: r.id,
      resortId: RESORT_ID,
      name: r.name,
      roomType: r.roomType,
      capacity: r.capacity,
      sortOrder: r.sortOrder,
      isActive: true,
      updatedByUid: '',
    }));
  }, [rooms]);

  const resortDisplayName = settings?.resortName || DEFAULT_RESORT_SEED.resortName;
  const isAuthenticatedStaff = Boolean(user && user.emailVerified && staffReady);
  const staffName = user ? getStaffDisplayName(user, staffProfile) : '';

  const openLoginModal = (reason?: string, pendingBook?: { dateISO?: string; roomId?: string }) => {
    pendingActionRef.current = pendingBook || null;
    setLoginPromptNotice(reason || null);
    setLoginModalOpen(true);
  };

  const openNewBookingModal = (dateISO?: string, roomId?: string) => {
    if (!isAuthenticatedStaff) {
      openLoginModal('กรุณาเข้าสู่ระบบทีมงานเพื่อบันทึกรายละเอียดการจองห้องพัก', {
        dateISO,
        roomId,
      });
      return;
    }
    setEditingBooking(null);
    setFormInitialCheckIn(dateISO);
    setFormInitialRoomIds(roomId ? [roomId] : undefined);
    setFormOpen(true);
  };

  const openEditBookingModal = (booking: Booking) => {
    setSelectedBooking(null);
    setEditingBooking(booking);
    setFormInitialCheckIn(booking.checkIn);
    setFormInitialRoomIds(booking.roomIds);
    setFormOpen(true);
  };

  const handleSubmitBooking = async (input: BookingFormInput, editing?: Booking | null) => {
    if (!user) return;
    try {
      await createOrUpdateBookingAtomic(input, effectiveRooms, user, staffName, editing);
      setFormOpen(false);
      setEditingBooking(null);
      showToast(
        editing
          ? 'อัปเดตข้อมูลการจองเรียบร้อยแล้ว (ซิงก์ปฏิทินทีมงานทันที)'
          : 'บันทึกการจองใหม่เรียบร้อยแล้ว (ซิงก์ปฏิทินทีมงานทันที)',
      );
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        setDoubleBookingAlert({
          isOpen: true,
          rooms: err.conflictingRooms,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
        });
      }
      throw err;
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!user) return;
    await cancelBookingAtomic(booking, user, staffName);
    showToast(`ยกเลิกการจองห้อง ${booking.roomNames.join(', ')} แล้ว (ห้องกลับมามีสถานะว่างทันที)`);
  };

  const handleSaveSettings = async (input: {
    resortName: string;
    resortSubtitle: string;
    checkInTime: string;
    checkOutTime: string;
    breakfastOptions: string[];
    dinnerOptions: string[];
  }) => {
    if (!user) return;
    await saveResortSettings(input, user, staffName);
    showToast('บันทึกข้อมูลรีสอร์ทและรายการอาหารเรียบร้อยแล้ว');
  };

  const handleSaveRoom = async (
    input: {
      name: string;
      roomType: string;
      capacity: number;
      sortOrder: number;
      isActive: boolean;
    },
    existingRoomId?: string,
  ) => {
    if (!user) return;
    await upsertRoom(input, user, existingRoomId);
    showToast(existingRoomId ? 'อัปเดตข้อมูลห้องพักแล้ว' : 'เพิ่มห้องพักใหม่เรียบร้อยแล้ว');
  };

  const handleDeleteRoom = async (roomId: string) => {
    await deleteRoom(roomId);
    showToast('ลบห้องพักเรียบร้อยแล้ว');
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'calendar',
      label: 'ปฏิทินห้องพัก',
      icon: <CalendarDays className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'bookings',
      label: 'รายการจองทั้งหมด',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'setup',
      label: 'ตั้งค่ารีสอร์ท',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  // Unverified email gate when signed in via Email/Password without verification
  if (authReady && user && !user.emailVerified) {
    return (
      <LoginScreen
        resortName={resortDisplayName}
        unverifiedUser={user}
        onEmailVerifiedRefresh={handleRefreshEmailVerification}
      />
    );
  }

  // PUBLIC LANDING PAGE (No Login Required — Header is Resort Name + Login button on top right)
  if (!isAuthenticatedStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Landing Page Header: Resort Name on left, Login button on right */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6">
          <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">
                {resortDisplayName}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => openLoginModal()}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" />
                เข้าสู่ระบบ (Login)
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {publicLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-[480px] bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <MonthlyCalendar
              isAuthenticated={false}
              rooms={effectiveRooms}
              roomLocks={roomLocks}
              bookings={[]}
              onQuickBook={(dateISO, roomId) => openNewBookingModal(dateISO, roomId)}
              onSelectBooking={() => {}}
              onRequireLogin={(reason) => openLoginModal(reason)}
            />
          )}
        </main>

        {loginModalOpen && (
          <LoginScreen
            resortName={resortDisplayName}
            promptNotice={loginPromptNotice}
            onClose={() => {
              setLoginModalOpen(false);
              setLoginPromptNotice(null);
              pendingActionRef.current = null;
            }}
            onPendingDisplayName={(name) => {
              pendingDisplayNameRef.current = name;
            }}
          />
        )}
      </div>
    );
  }

  // AUTHENTICATED STAFF WORKSPACE
  const pageTitle =
    activeTab === 'calendar'
      ? 'ปฏิทินแสดงสถานะห้องพักรายเดือน'
      : activeTab === 'bookings'
        ? 'รายการจองทั้งหมด'
        : 'ตั้งค่าข้อมูลรีสอร์ท ห้องพัก และเมนูอาหาร';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-slate-900 truncate">{resortDisplayName}</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[42px] px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">พนักงานที่เข้าสู่ระบบ</div>
            <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">{staffName}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 truncate">
                  {resortDisplayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="ปิดเมนู"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3">
              <div>
                <div className="text-xs text-slate-500">พนักงานที่เข้าสู่ระบบ</div>
                <div className="text-sm font-semibold text-slate-900 truncate">{staffName}</div>
                <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="เปิดเมนูนำทาง"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openNewBookingModal()}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              บันทึกการจองใหม่
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {toastMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="ปิดการแจ้งเตือน"
                className="text-emerald-700 hover:text-emerald-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'calendar' && (
            <MonthlyCalendar
              isAuthenticated={true}
              rooms={effectiveRooms}
              roomLocks={roomLocks}
              bookings={bookings}
              onQuickBook={(dateISO, roomId) => openNewBookingModal(dateISO, roomId)}
              onSelectBooking={(booking) => setSelectedBooking(booking)}
              onRequireLogin={(reason) => openLoginModal(reason)}
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsListView
              bookings={bookings}
              onSelectBooking={(booking) => setSelectedBooking(booking)}
              onAddBooking={() => openNewBookingModal()}
            />
          )}

          {activeTab === 'setup' && (
            <ResortSetupView
              settings={settings}
              rooms={effectiveRooms}
              bookings={bookings}
              onSaveSettings={handleSaveSettings}
              onSaveRoom={handleSaveRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          )}
        </main>
      </div>

      <BookingFormModal
        isOpen={formOpen}
        settings={settings}
        rooms={effectiveRooms}
        bookings={bookings}
        initialCheckIn={formInitialCheckIn}
        initialRoomIds={formInitialRoomIds}
        editingBooking={editingBooking}
        onClose={() => {
          setFormOpen(false);
          setEditingBooking(null);
        }}
        onSubmit={handleSubmitBooking}
      />

      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onEdit={openEditBookingModal}
        onCancelBooking={handleCancelBooking}
      />

      <DoubleBookingAlertModal
        isOpen={doubleBookingAlert.isOpen}
        conflictingRooms={doubleBookingAlert.rooms}
        checkIn={doubleBookingAlert.checkIn}
        checkOut={doubleBookingAlert.checkOut}
        onClose={() => setDoubleBookingAlert((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ResortWorkspace />
    </ErrorBoundary>
  );
}
