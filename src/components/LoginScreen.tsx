import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { auth } from '../lib/firebase';

interface LoginScreenProps {
  unverifiedUser?: User | null;
  onEmailVerifiedRefresh?: () => Promise<void>;
  onPendingDisplayName?: (name: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  unverifiedUser,
  onEmailVerifiedRefresh,
  onPendingDisplayName,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);
  const [verificationSentMsg, setVerificationSentMsg] = useState<string | null>(null);

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      setShowConsoleGuide(true);
      return 'ผู้ดูแลระบบยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วยอีเมลและรหัสผ่านใน Firebase Console (สามารถใช้ปุ่ม "เข้าสู่ระบบด้วย Google" ด้านล่างได้ทันที หรือเปิดใช้งานตามคำแนะนำด้านล่าง)';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    }
    if (code === 'auth/email-already-in-use') {
      return 'อีเมลนี้ถูกลงทะเบียนไว้ในระบบแล้ว กรุณาสลับไปหน้าเข้าสู่ระบบ';
    }
    if (code === 'auth/weak-password') {
      return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
    }
    if (code === 'auth/invalid-email') {
      return 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'ยกเลิกการเข้าสู่ระบบด้วย Google';
    }
    if (code === 'auth/too-many-requests') {
      return 'มีการทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
    }
    return err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const cleanName = displayName.trim();
        if (!cleanName) {
          setErrorText('กรุณากรอกชื่อ-นามสกุล หรือชื่อเล่นพนักงาน');
          setLoading(false);
          return;
        }
        onPendingDisplayName?.(cleanName);
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanName });
        await sendEmailVerification(cred.user);
        setVerificationSentMsg('ส่งลิงก์ยืนยันอีเมลไปที่กล่องจดหมายของคุณแล้ว กรุณายืนยันอีเมลก่อนเข้าใช้งาน');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setErrorText(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorText(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setErrorText(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setLoading(true);
    setErrorText(null);
    setVerificationSentMsg(null);
    try {
      await sendEmailVerification(unverifiedUser);
      setVerificationSentMsg('ส่งอีเมลยืนยันใหม่เรียบร้อยแล้ว กรุณาตรวจสอบทั้งกล่องจดหมายและ Spam');
    } catch (err) {
      setErrorText(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      await onEmailVerifiedRefresh?.();
    } catch (err) {
      setErrorText(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (unverifiedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-5">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            ยืนยันอีเมลพนักงานก่อนเข้าใช้งาน
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            เพื่อความปลอดภัยของข้อมูลการจอง ระบบต้องยืนยันตัวตนผ่านอีเมล{' '}
            <span className="font-semibold text-slate-900">{unverifiedUser.email}</span>{' '}
            กรุณาคลิกลิงก์ยืนยันในอีเมลของคุณ แล้วกดปุ่มตรวจสอบสถานะด้านล่าง
          </p>

          {verificationSentMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{verificationSentMsg}</span>
            </div>
          )}

          {errorText && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRefreshVerification}
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              ฉันยืนยันอีเมลแล้ว (เข้าสู่ระบบ)
            </button>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              ส่งลิงก์ยืนยันอีเมลอีกครั้ง
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ / เปลี่ยนบัญชี
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              ระบบจัดการห้องพักรีสอร์ท
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              สำหรับทีมงานภายใน · บันทึกและเช็กห้องว่างแบบ Real-time
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorText(null);
            }}
            className={`min-h-[40px] text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เข้าสู่ระบบพนักงาน
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorText(null);
            }}
            className={`min-h-[40px] text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ลงทะเบียนทีมงานใหม่
          </button>
        </div>

        {errorText && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="staff-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                ชื่อพนักงาน (แสดงในประวัติการจอง)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="staff-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น คุณพลอย (Front Office)"
                  className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="staff-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              อีเมลพนักงาน
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@resort.com"
                className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="staff-password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading
              ? 'กำลังดำเนินการ...'
              : mode === 'signin'
                ? 'เข้าสู่ระบบ'
                : 'ลงทะเบียนบัญชีพนักงาน'}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-500">หรือเข้าสู่ระบบด่วน</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowConsoleGuide((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 py-1"
          >
            <span>คำแนะนำผู้ดูแล: การเปิดใช้งาน Email/Password ใน Firebase</span>
            {showConsoleGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showConsoleGuide && (
            <ol className="mt-2 text-xs text-slate-600 space-y-1.5 list-decimal list-inside bg-slate-50 p-3 rounded-lg border border-slate-200">
              <li>เปิด Firebase Console ของโปรเจกต์นี้</li>
              <li>ไปที่เมนู <strong>Authentication</strong> &gt; แท็บ <strong>Sign-in method</strong></li>
              <li>กด <strong>Add new provider</strong> แล้วเลือก <strong>Email/Password</strong></li>
              <li>เปิดสวิตช์ <strong>Enable</strong> และกด <strong>Save</strong></li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
