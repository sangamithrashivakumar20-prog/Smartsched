import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { AuthActionResult } from '../hooks/useAuth';

export type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

interface AuthViewProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  isSupabaseConfigured: boolean;
  onSignIn: (email: string, password: string) => Promise<AuthActionResult>;
  onSignUp: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  onRequestPasswordReset: (email: string) => Promise<AuthActionResult>;
  onUpdatePassword: (newPassword: string) => Promise<AuthActionResult>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthView({
  mode,
  onChangeMode,
  isSupabaseConfigured,
  onSignIn,
  onSignUp,
  onRequestPasswordReset,
  onUpdatePassword,
}: AuthViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  const validateForm = (): string | null => {
    if (mode === 'signup') {
      if (name.trim().length < 2) {
        return 'Please enter your full name (at least 2 characters).';
      }
    }

    if (mode !== 'reset-password') {
      if (!email.trim()) {
        return 'Email address is required.';
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        return 'Please enter a valid email address.';
      }
    }

    if (mode === 'login') {
      if (!password) {
        return 'Please enter your password.';
      }
    }

    if (mode === 'signup' || mode === 'reset-password') {
      if (password.length < 6) {
        return 'Password must be at least 6 characters long.';
      }
      if (password !== confirmPassword) {
        return 'Passwords do not match. Please re-enter to confirm.';
      }
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMessage(
        'Supabase authentication is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
      );
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await onSignIn(email, password);
        if (!res.ok) {
          setErrorMessage(res.error ?? 'Unable to sign in. Please try again.');
        }
      } else if (mode === 'signup') {
        const res = await onSignUp(name, email, password);
        if (!res.ok) {
          setErrorMessage(res.error ?? 'Unable to create your account. Please try again.');
        } else if (res.needsEmailConfirmation) {
          setSuccessMessage(
            `Account created for ${email.trim()}. Check your inbox for the verification link to activate your account, then sign in.`
          );
          setPassword('');
          setConfirmPassword('');
        }
      } else if (mode === 'forgot-password') {
        const res = await onRequestPasswordReset(email);
        if (!res.ok) {
          setErrorMessage(res.error ?? 'Could not send password reset email.');
        } else {
          setSuccessMessage(
            `If an account exists for ${email.trim()}, a password reset link has been sent. Please check your inbox.`
          );
        }
      } else if (mode === 'reset-password') {
        const res = await onUpdatePassword(password);
        if (!res.ok) {
          setErrorMessage(res.error ?? 'Could not update password.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const headingCopy: Record<AuthMode, { title: string; subtitle: string }> = {
    login: {
      title: 'Sign in to SmartSched',
      subtitle: 'Access your personal college timetable, assignments, study planner, and alerts.',
    },
    signup: {
      title: 'Create your student account',
      subtitle: 'Keep your coursework, deadlines, and study sessions private to your account.',
    },
    'forgot-password': {
      title: 'Reset your password',
      subtitle: 'Enter your registered email address to receive a password recovery link.',
    },
    'reset-password': {
      title: 'Set a new password',
      subtitle: 'Choose a strong new password for your SmartSched student account.',
    },
  };

  const currentHeading = headingCopy[mode];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Brand & Feature Context Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xs">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-slate-900 block">
                SmartSched
              </span>
              <span className="text-xs font-medium text-indigo-600">
                Smart Student Timetable & Reminder App
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Organize your semester in one focused workspace
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
              Sign in with your student account to track live classes from your college timetable,
              manage assignment deadlines, schedule conflict-free study sessions, and monitor your
              weekly progress.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Live Timetable</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Today&apos;s classes, next lecture countdown & weekly view.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Assignment Tracker</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Priorities, due dates, overdue alerts & completion status.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Study Planner</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Free-slot suggestions built around your college class hours.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Private & Isolated</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protected routes and account-scoped data via Supabase Auth.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            {/* Mode Switch Tabs for Login / Signup */}
            {(mode === 'login' || mode === 'signup') && (
              <div
                className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/70"
                role="tablist"
                aria-label="Authentication mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => onChangeMode('login')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  onClick={() => onChangeMode('signup')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Student Sign Up
                </button>
              </div>
            )}

            {(mode === 'forgot-password' || mode === 'reset-password') && (
              <button
                type="button"
                onClick={() => onChangeMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to Sign In
              </button>
            )}

            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {currentHeading.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {currentHeading.subtitle}
              </p>
            </div>

            {!isSupabaseConfigured && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Supabase configuration required</span>
                </div>
                <p className="leading-relaxed text-amber-800">
                  Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code>{' '}
                  and{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">
                    VITE_SUPABASE_ANON_KEY
                  </code>{' '}
                  in your environment variables, and execute{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema.sql</code> in
                  your Supabase SQL Editor to enable live authentication and per-student database
                  isolation.
                </p>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-rose-800"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-900"
              >
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <p>{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => onChangeMode('login')}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Go to Sign In
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Student Name
                  </label>
                  <div className="relative">
                    <User
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Aarav Sharma"
                      disabled={submitting}
                      className="w-full pl-9 pr-3 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== 'reset-password' && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    College or Personal Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@college.edu"
                      disabled={submitting}
                      className="w-full pl-9 pr-3 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== 'forgot-password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {mode === 'reset-password' ? 'New Password' : 'Password'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => onChangeMode('forgot-password')}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'login' ? 'Enter your password' : 'Minimum 6 characters'
                      }
                      disabled={submitting}
                      className="w-full pl-9 pr-10 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {(mode === 'signup' || mode === 'reset-password') && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      disabled={submitting}
                      className="w-full pl-9 pr-10 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>
                  {mode === 'login'
                    ? submitting
                      ? 'Signing in...'
                      : 'Sign In to Dashboard'
                    : mode === 'signup'
                      ? submitting
                        ? 'Creating account...'
                        : 'Create Student Account'
                      : mode === 'forgot-password'
                        ? submitting
                          ? 'Sending reset link...'
                          : 'Send Password Reset Link'
                        : submitting
                          ? 'Updating password...'
                          : 'Update Password & Continue'}
                </span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <span>
                  New to SmartSched?{' '}
                  <button
                    type="button"
                    onClick={() => onChangeMode('signup')}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Create a student account
                  </button>
                </span>
              ) : mode === 'signup' ? (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onChangeMode('login')}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Sign in instead
                  </button>
                </span>
              ) : (
                <span>
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => onChangeMode('login')}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Return to Sign In
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
