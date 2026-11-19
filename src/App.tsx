import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, Loader2 } from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { AssignmentsView } from './components/AssignmentsView';
import { AuthMode, AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { RemindersTab, RemindersView } from './components/RemindersView';
import { Sidebar } from './components/Sidebar';
import { StudyPlannerView } from './components/StudyPlannerView';
import { TimetableView } from './components/TimetableView';
import { ToastContainer } from './components/ToastContainer';
import { TopBar } from './components/TopBar';
import { AssignmentModal } from './components/modals/AssignmentModal';
import { ConfirmDialog } from './components/modals/ConfirmDialog';
import { EventModal } from './components/modals/EventModal';
import { ReminderModal } from './components/modals/ReminderModal';
import { StudySessionModal } from './components/modals/StudySessionModal';
import { useAuth } from './hooks/useAuth';
import { useSmartSchedStore } from './hooks/useSmartSchedStore';
import {
  Assignment,
  DayOfWeek,
  PageView,
  Reminder,
  ReminderOffsetMinutes,
  StudySession,
  TimetableEvent,
} from './types/scheduler';
import { getTodayDayOfWeek } from './utils/dateUtils';

const PAGE_PATHS: Record<PageView, string> = {
  dashboard: '/dashboard',
  timetable: '/timetable',
  'study-planner': '/study-planner',
  assignments: '/assignments',
  reminders: '/reminders',
  analytics: '/analytics',
};

const AUTH_PATHS: Record<AuthMode, string> = {
  login: '/login',
  signup: '/signup',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
};

function parseAuthModeFromPath(pathname: string): AuthMode {
  switch (pathname) {
    case '/signup':
      return 'signup';
    case '/forgot-password':
      return 'forgot-password';
    case '/reset-password':
      return 'reset-password';
    default:
      return 'login';
  }
}

function parsePageFromPath(pathname: string): PageView | null {
  switch (pathname) {
    case '/dashboard':
      return 'dashboard';
    case '/timetable':
      return 'timetable';
    case '/study-planner':
      return 'study-planner';
    case '/assignments':
      return 'assignments';
    case '/reminders':
      return 'reminders';
    case '/analytics':
      return 'analytics';
    default:
      return null;
  }
}

type ConfirmState =
  | {
      kind: 'delete-event';
      event: TimetableEvent;
    }
  | {
      kind: 'delete-assignment';
      assignment: Assignment;
    }
  | {
      kind: 'delete-reminder';
      reminder: Reminder;
      assignmentTitle: string;
    }
  | {
      kind: 'delete-study-session';
      session: StudySession;
    }
  | {
      kind: 'reset-demo';
    }
  | null;

export default function App() {
  const auth = useAuth();
  const authenticatedUserId = auth.user && !auth.isRecoveryMode ? auth.user.id : null;
  const store = useSmartSchedStore(authenticatedUserId);

  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    typeof window !== 'undefined'
      ? parseAuthModeFromPath(window.location.pathname)
      : 'login'
  );
  const [activePage, setActivePage] = useState<PageView>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return parsePageFromPath(window.location.pathname) ?? 'dashboard';
  });
  const [timetableInitialDay, setTimetableInitialDay] = useState<DayOfWeek | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal states
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const [defaultEventDay, setDefaultEventDay] = useState<DayOfWeek | undefined>(undefined);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [defaultReminderAssignmentId, setDefaultReminderAssignmentId] = useState<
    string | undefined
  >(undefined);

  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [editingStudySession, setEditingStudySession] = useState<StudySession | null>(null);
  const [defaultStudyDate, setDefaultStudyDate] = useState<string | undefined>(undefined);
  const [defaultStudyStartTime, setDefaultStudyStartTime] = useState<string | undefined>(undefined);

  const [remindersTab, setRemindersTab] = useState<RemindersTab>('center');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const prevUserIdRef = useRef<string | null>(null);

  const syncUrlPath = useCallback((path: string, replace = false) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === path) return;
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
  }, []);

  // Protected route synchronization & post-login redirect to Dashboard
  useEffect(() => {
    if (auth.loading) return;

    if (!authenticatedUserId) {
      prevUserIdRef.current = null;
      const targetAuthMode: AuthMode = auth.isRecoveryMode ? 'reset-password' : authMode;
      if (auth.isRecoveryMode && authMode !== 'reset-password') {
        setAuthMode('reset-password');
      }
      const expectedPath = AUTH_PATHS[targetAuthMode];
      syncUrlPath(expectedPath, true);
      return;
    }

    // User just signed in (or switched account): redirect to Dashboard
    if (prevUserIdRef.current !== authenticatedUserId) {
      prevUserIdRef.current = authenticatedUserId;
      const requestedPage =
        typeof window !== 'undefined' ? parsePageFromPath(window.location.pathname) : null;
      const landingPage: PageView = requestedPage ?? 'dashboard';
      setActivePage(landingPage);
      syncUrlPath(PAGE_PATHS[landingPage], true);
    } else {
      const currentPageFromUrl =
        typeof window !== 'undefined' ? parsePageFromPath(window.location.pathname) : null;
      if (!currentPageFromUrl) {
        syncUrlPath(PAGE_PATHS[activePage], true);
      }
    }
  }, [auth.loading, auth.isRecoveryMode, authenticatedUserId, authMode, activePage, syncUrlPath]);

  // Browser Back / Forward route handling with protected route guard
  useEffect(() => {
    const handlePopState = () => {
      if (auth.loading) return;
      const path = window.location.pathname;
      if (!authenticatedUserId) {
        const nextMode = auth.isRecoveryMode
          ? 'reset-password'
          : parseAuthModeFromPath(path);
        setAuthMode(nextMode);
        if (window.location.pathname !== AUTH_PATHS[nextMode]) {
          syncUrlPath(AUTH_PATHS[nextMode], true);
        }
      } else {
        const nextPage = parsePageFromPath(path) ?? 'dashboard';
        setActivePage(nextPage);
        if (window.location.pathname !== PAGE_PATHS[nextPage]) {
          syncUrlPath(PAGE_PATHS[nextPage], true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [auth.loading, auth.isRecoveryMode, authenticatedUserId, syncUrlPath]);

  const handleChangeAuthMode = useCallback(
    (nextMode: AuthMode) => {
      setAuthMode(nextMode);
      syncUrlPath(AUTH_PATHS[nextMode]);
    },
    [syncUrlPath]
  );

  const handleSignIn = useCallback(
    async (email: string, password: string) => {
      const res = await auth.signIn(email, password);
      if (res.ok) {
        setActivePage('dashboard');
        syncUrlPath('/dashboard', true);
      }
      return res;
    },
    [auth, syncUrlPath]
  );

  const handleSignUp = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await auth.signUp(name, email, password);
      if (res.ok && !res.needsEmailConfirmation) {
        setActivePage('dashboard');
        syncUrlPath('/dashboard', true);
      }
      return res;
    },
    [auth, syncUrlPath]
  );

  const handleUpdatePassword = useCallback(
    async (newPassword: string) => {
      const res = await auth.updatePassword(newPassword);
      if (res.ok) {
        setActivePage('dashboard');
        syncUrlPath('/dashboard', true);
      }
      return res;
    },
    [auth, syncUrlPath]
  );

  const handleSignOut = useCallback(async () => {
    setMobileMenuOpen(false);
    setEventModalOpen(false);
    setAssignmentModalOpen(false);
    setReminderModalOpen(false);
    setStudyModalOpen(false);
    setConfirmState(null);
    await auth.signOut();
    setAuthMode('login');
    syncUrlPath('/login', true);
  }, [auth, syncUrlPath]);

  const subjectSuggestions = useMemo(() => {
    const set = new Set<string>();
    store.events.forEach((e) => set.add(e.subject));
    store.assignments.forEach((a) => set.add(a.subject));
    store.studySessions.forEach((s) => set.add(s.subject));
    return Array.from(set).sort();
  }, [store.events, store.assignments, store.studySessions]);

  const todayDay = getTodayDayOfWeek(store.now);
  const todayClassCount = useMemo(
    () => (todayDay ? store.events.filter((e) => e.day === todayDay).length : 0),
    [store.events, todayDay]
  );

  const pendingAssignmentCount = useMemo(
    () => store.assignments.filter((a) => a.status === 'Pending').length,
    [store.assignments]
  );

  const pendingStudyCount = useMemo(
    () => store.studySessions.filter((s) => s.status === 'Pending').length,
    [store.studySessions]
  );

  const activeReminderCount = useMemo(() => {
    return store.reminders.filter((r) => {
      if (!r.enabled) return false;
      const asg = store.assignments.find((a) => a.id === r.assignmentId);
      return Boolean(asg && asg.status === 'Pending');
    }).length;
  }, [store.reminders, store.assignments]);

  const handleNavigate = (page: PageView, dayFilter?: DayOfWeek, tab?: RemindersTab) => {
    if (!authenticatedUserId) {
      syncUrlPath('/login', true);
      return;
    }
    setTimetableInitialDay(dayFilter);
    if (page === 'reminders' && tab) {
      setRemindersTab(tab);
    }
    setActivePage(page);
    syncUrlPath(PAGE_PATHS[page]);
  };

  const openAddClass = (day?: DayOfWeek) => {
    setEditingEvent(null);
    setDefaultEventDay(day);
    setEventModalOpen(true);
  };

  const openEditClass = (event: TimetableEvent) => {
    setEditingEvent(event);
    setDefaultEventDay(undefined);
    setEventModalOpen(true);
  };

  const openAddAssignment = () => {
    setEditingAssignment(null);
    setAssignmentModalOpen(true);
  };

  const openEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setAssignmentModalOpen(true);
  };

  const openAddReminder = (defaultAssignmentId?: string) => {
    setEditingReminder(null);
    setDefaultReminderAssignmentId(defaultAssignmentId);
    setReminderModalOpen(true);
  };

  const openManageReminder = (assignmentId: string, existingReminder?: Reminder) => {
    if (existingReminder) {
      setEditingReminder(existingReminder);
      setDefaultReminderAssignmentId(undefined);
    } else {
      setEditingReminder(null);
      setDefaultReminderAssignmentId(assignmentId);
    }
    setReminderModalOpen(true);
  };

  const openAddStudySession = (date?: string, startTime?: string) => {
    setEditingStudySession(null);
    setDefaultStudyDate(date);
    setDefaultStudyStartTime(startTime);
    setStudyModalOpen(true);
  };

  const openEditStudySession = (session: StudySession) => {
    setEditingStudySession(session);
    setDefaultStudyDate(undefined);
    setDefaultStudyStartTime(undefined);
    setStudyModalOpen(true);
  };

  const handleConfirmAction = () => {
    if (!confirmState) return;
    switch (confirmState.kind) {
      case 'delete-event':
        store.deleteEvent(confirmState.event.id);
        break;
      case 'delete-assignment':
        store.deleteAssignment(confirmState.assignment.id);
        break;
      case 'delete-reminder':
        store.deleteReminder(confirmState.reminder.id);
        break;
      case 'delete-study-session':
        store.deleteStudySession(confirmState.session.id);
        break;
      case 'reset-demo':
        void store.resetToCsvData();
        break;
    }
    setConfirmState(null);
  };

  // Auth loading state (blocks protected content before session check finishes)
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xs">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
          <span>Verifying student session...</span>
        </div>
      </div>
    );
  }

  // Protected Route Gate: render public AuthView unless authenticated & not in password recovery
  if (!authenticatedUserId) {
    return (
      <AuthView
        mode={auth.isRecoveryMode ? 'reset-password' : authMode}
        onChangeMode={handleChangeAuthMode}
        isSupabaseConfigured={auth.isSupabaseConfigured}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onRequestPasswordReset={auth.requestPasswordReset}
        onUpdatePassword={handleUpdatePassword}
      />
    );
  }

  const dueBannerCount = store.dueAlertReminderIds.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => handleNavigate(page)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        pendingCount={pendingAssignmentCount}
        activeReminderCount={activeReminderCount}
        todayClassCount={todayClassCount}
        pendingStudyCount={pendingStudyCount}
        onRequestResetDemo={() => setConfirmState({ kind: 'reset-demo' })}
        studentName={auth.studentName}
        studentEmail={auth.user?.email ?? undefined}
        onSignOut={() => void handleSignOut()}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activePage={activePage}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickAddClass={() => openAddClass()}
          onQuickAddAssignment={openAddAssignment}
          notifications={store.notifications}
          onToggleNotificationRead={store.toggleNotificationRead}
          onMarkAllNotificationsRead={store.markAllNotificationsRead}
          onDeleteNotification={store.deleteNotification}
          onClearAllNotifications={store.clearAllNotifications}
          onOpenNotificationCenter={() => handleNavigate('reminders', undefined, 'center')}
        />

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {store.isLoadingCsv ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading your timetable & workspace...
            </div>
          ) : (
            <>
              {/* Global Live Reminder Banner (shown when a configured reminder triggers) */}
              {dueBannerCount > 0 && activePage !== 'reminders' && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-900">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                    <span>
                      You have <strong>{dueBannerCount}</strong> active{' '}
                      {dueBannerCount === 1 ? 'reminder alert' : 'reminder alerts'} triggered for
                      upcoming assignments.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('reminders', undefined, 'upcoming')}
                    className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-medium text-amber-900 hover:bg-amber-100/70 transition-colors whitespace-nowrap"
                  >
                    Review Reminders
                  </button>
                </div>
              )}

              {activePage === 'dashboard' && (
                <DashboardView
                  now={store.now}
                  events={store.events}
                  assignments={store.assignments}
                  reminders={store.reminders}
                  studySessions={store.studySessions}
                  studentName={auth.studentName}
                  onNavigate={handleNavigate}
                  onAddClass={() => openAddClass()}
                  onAddAssignment={openAddAssignment}
                  onPlanStudy={() => openAddStudySession()}
                  onToggleAssignment={store.toggleAssignmentStatus}
                  onToggleStudySession={store.toggleStudySessionStatus}
                />
              )}

              {activePage === 'timetable' && (
                <TimetableView
                  events={store.events}
                  now={store.now}
                  initialDayFilter={timetableInitialDay}
                  onAddEvent={openAddClass}
                  onEditEvent={openEditClass}
                  onDeleteEvent={(event) => setConfirmState({ kind: 'delete-event', event })}
                />
              )}

              {activePage === 'study-planner' && (
                <StudyPlannerView
                  studySessions={store.studySessions}
                  timetableEvents={store.events}
                  now={store.now}
                  onAddSession={openAddStudySession}
                  onEditSession={openEditStudySession}
                  onDeleteSession={(session) =>
                    setConfirmState({ kind: 'delete-study-session', session })
                  }
                  onToggleStatus={store.toggleStudySessionStatus}
                />
              )}

              {activePage === 'assignments' && (
                <AssignmentsView
                  assignments={store.assignments}
                  reminders={store.reminders}
                  now={store.now}
                  onAddAssignment={openAddAssignment}
                  onEditAssignment={openEditAssignment}
                  onDeleteAssignment={(assignment) =>
                    setConfirmState({ kind: 'delete-assignment', assignment })
                  }
                  onToggleStatus={store.toggleAssignmentStatus}
                  onManageReminderForAssignment={openManageReminder}
                />
              )}

              {activePage === 'reminders' && (
                <RemindersView
                  reminders={store.reminders}
                  assignments={store.assignments}
                  events={store.events}
                  studySessions={store.studySessions}
                  notifications={store.notifications}
                  notificationPrefs={store.notificationPrefs}
                  now={store.now}
                  initialTab={remindersTab}
                  onAddReminder={openAddReminder}
                  onQuickCreateReminder={(assignmentId, offset) =>
                    store.addReminder(assignmentId, offset)
                  }
                  onUpdateReminderOffset={store.updateReminder}
                  onToggleReminderEnabled={store.toggleReminderEnabled}
                  onDismissReminderAlert={store.dismissReminderAlert}
                  onDeleteReminder={(reminder, assignmentTitle) =>
                    setConfirmState({
                      kind: 'delete-reminder',
                      reminder,
                      assignmentTitle,
                    })
                  }
                  onUpdateNotificationPrefs={store.updateNotificationPrefs}
                  onToggleNotificationRead={store.toggleNotificationRead}
                  onMarkAllNotificationsRead={store.markAllNotificationsRead}
                  onDeleteNotification={store.deleteNotification}
                  onClearAllNotifications={store.clearAllNotifications}
                  onTriggerTestNotification={store.triggerTestNotification}
                />
              )}

              {activePage === 'analytics' && (
                <AnalyticsView
                  assignments={store.assignments}
                  studySessions={store.studySessions}
                  now={store.now}
                  onNavigate={(page) => handleNavigate(page)}
                  onPlanStudy={() => openAddStudySession()}
                  onAddAssignment={openAddAssignment}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <EventModal
        open={eventModalOpen}
        initialEvent={editingEvent}
        defaultDay={defaultEventDay}
        onClose={() => setEventModalOpen(false)}
        onSave={(data, existingId) => {
          if (existingId) {
            store.updateEvent(existingId, data);
          } else {
            store.addEvent(data);
          }
        }}
      />

      <AssignmentModal
        open={assignmentModalOpen}
        initialAssignment={editingAssignment}
        subjectSuggestions={subjectSuggestions}
        onClose={() => setAssignmentModalOpen(false)}
        onSave={(data, existingId, initialReminderOffset) => {
          if (existingId) {
            store.updateAssignment(existingId, data);
          } else {
            store.addAssignment(data, initialReminderOffset);
          }
        }}
      />

      <ReminderModal
        open={reminderModalOpen}
        initialReminder={editingReminder}
        defaultAssignmentId={defaultReminderAssignmentId}
        assignments={store.assignments}
        onClose={() => setReminderModalOpen(false)}
        onSave={(
          assignmentId: string,
          offsetMinutes: ReminderOffsetMinutes,
          existingId?: string
        ) => {
          if (existingId) {
            store.updateReminder(existingId, offsetMinutes);
          } else {
            store.addReminder(assignmentId, offsetMinutes);
          }
        }}
      />

      <StudySessionModal
        open={studyModalOpen}
        initialSession={editingStudySession}
        defaultDate={defaultStudyDate}
        defaultStartTime={defaultStudyStartTime}
        subjectSuggestions={subjectSuggestions}
        timetableEvents={store.events}
        studySessions={store.studySessions}
        now={store.now}
        onClose={() => setStudyModalOpen(false)}
        onSave={(data, existingId) => {
          if (existingId) {
            store.updateStudySession(existingId, data);
          } else {
            store.addStudySession(data);
          }
        }}
      />

      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.kind === 'reset-demo'
            ? 'Reload Uploaded CSV Data?'
            : confirmState?.kind === 'delete-event'
              ? 'Delete Timetable Event?'
              : confirmState?.kind === 'delete-assignment'
                ? 'Delete Assignment?'
                : confirmState?.kind === 'delete-study-session'
                  ? 'Delete Study Session?'
                  : 'Delete Reminder?'
        }
        message={
          confirmState?.kind === 'reset-demo'
            ? 'This will reload your timetable and assignments from the uploaded CSV file. Any custom edits for your account will be replaced.'
            : confirmState?.kind === 'delete-event'
              ? `Remove "${confirmState.event.subject}" on ${confirmState.event.day} from your weekly timetable?`
              : confirmState?.kind === 'delete-assignment'
                ? `Delete "${confirmState.assignment.title}" and any linked reminders? This action cannot be undone.`
                : confirmState?.kind === 'delete-study-session'
                  ? `Delete the study session "${confirmState.session.subject} · ${confirmState.session.topic}"?`
                  : confirmState?.kind === 'delete-reminder'
                    ? `Remove the reminder for "${confirmState.assignmentTitle}"?`
                    : ''
        }
        confirmLabel={confirmState?.kind === 'reset-demo' ? 'Reload CSV' : 'Delete'}
        destructive={confirmState?.kind !== 'reset-demo'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />

      <ToastContainer toasts={store.toasts} onDismiss={store.dismissToast} />
    </div>
  );
}
